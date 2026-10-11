import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  AssignmentAlreadyExists,
  AssignmentNotFound,
  NotAuthorized,
  PermissionAlreadyGranted,
  PermissionNotGranted,
  RoleBasedAccessingConcept,
  RoleInUse,
  RoleNameAlreadyExists,
  RoleNotFound,
} from "../../src/concepts/RoleBasedAccessing.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = testClient.db().databaseName;
const testDatabaseName = `relay_role_access_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The RoleBasedAccessing test database must be isolated from application data.");
}

const testDb = testClient.db(testDatabaseName);
const concept = new RoleBasedAccessingConcept(testDb, testClient);

type ActionOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function capture<T>(action: Promise<T>): Promise<ActionOutcome<T>> {
  try {
    return { ok: true, value: await action };
  } catch (error) {
    return { ok: false, error };
  }
}

function isFailure<T, ErrorType extends Error>(
  outcome: ActionOutcome<T>,
  errorClass: new (...args: never[]) => ErrorType,
): outcome is { ok: false; error: ErrorType } {
  return !outcome.ok && outcome.error instanceof errorClass;
}

describe("RoleBasedAccessing concept", () => {
  beforeAll(async () => {
    await testClient.connect();
    await testDb.command({ ping: 1 });
  });

  afterAll(async () => {
    try {
      await testClient.db(testDatabaseName).dropDatabase();
      const remainingTestDatabases = await testClient.db("admin").command({
        listDatabases: 1,
        nameOnly: true,
        filter: { name: testDatabaseName },
      });
      expect(remainingTestDatabases.databases).toEqual([]);
    } finally {
      await testClient.close();
    }
  });

  test("uses a unique database separate from the configured application database", () => {
    expect(testDatabaseName).not.toBe(applicationDatabaseName);
    expect(testDatabaseName).toMatch(/^relay_role_access_tests_[a-f0-9]+$/);
  });

  test("creates and retrieves Roles, ordered by name", async () => {
    const suffix = crypto.randomUUID();
    const second = await concept.createRole({ name: `B role ${suffix}` });
    const first = await concept.createRole({ name: `A role ${suffix}` });

    expect(first.role).not.toBe(second.role);
    expect(await concept._getRole({ role: first.role })).toEqual([{ name: `A role ${suffix}` }]);
    expect(await concept._getRole({ role: "missing-role" })).toEqual([]);
    const roles = await concept._roles();
    expect(roles).toContainEqual({ role: first.role, name: `A role ${suffix}` });
    expect(roles).toContainEqual({ role: second.role, name: `B role ${suffix}` });
    expect(roles.map(({ name }) => name)).toEqual(roles.map(({ name }) => name).toSorted());
  });

  test("rejects duplicate Role names without altering the existing Role", async () => {
    const name = `duplicate name ${crypto.randomUUID()}`;
    const { role } = await concept.createRole({ name });

    await expect(concept.createRole({ name })).rejects.toBeInstanceOf(RoleNameAlreadyExists);

    expect(await concept._roles()).toContainEqual({ role, name });
    expect((await concept._roles()).filter((entry) => entry.name === name)).toHaveLength(1);
    expect(await concept._permissions({ role })).toEqual([]);
  });

  test("grants and retrieves Permissions, refusing a duplicate grant", async () => {
    const { role } = await concept.createRole({ name: `permission role ${crypto.randomUUID()}` });

    expect(await concept._permissions({ role })).toEqual([]);
    expect(await concept.permit({ role, permission: "EDIT" })).toEqual({});
    expect(await concept.permit({ role, permission: "VIEW" })).toEqual({});
    expect(await concept._permissions({ role })).toEqual([
      { permission: "EDIT" },
      { permission: "VIEW" },
    ]);
    await expect(concept.permit({ role, permission: "EDIT" })).rejects
      .toBeInstanceOf(PermissionAlreadyGranted);
    expect(await concept._permissions({ role })).toEqual([
      { permission: "EDIT" },
      { permission: "VIEW" },
    ]);
    expect(await concept._permissions({ role: "missing-role" })).toEqual([]);
  });

  test("revokes a Permission and refuses to revoke an absent Permission", async () => {
    const { role } = await concept.createRole({ name: `revoke role ${crypto.randomUUID()}` });
    await concept.permit({ role, permission: "EDIT" });
    await concept.permit({ role, permission: "VIEW" });

    expect(await concept.revokePermission({ role, permission: "EDIT" })).toEqual({});
    expect(await concept._permissions({ role })).toEqual([{ permission: "VIEW" }]);
    await expect(concept.revokePermission({ role, permission: "ABSENT" })).rejects
      .toBeInstanceOf(PermissionNotGranted);
    expect(await concept._permissions({ role })).toEqual([{ permission: "VIEW" }]);
  });

  test("assigns a Role to a User and Resource and retrieves the Assignment", async () => {
    const { role } = await concept.createRole({ name: `assigned role ${crypto.randomUUID()}` });
    const assignment = await concept.assign({
      user: "member-one",
      resource: "club-one",
      role,
    });

    expect(assignment.assignment).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(await concept._assignmentsFor({ user: "member-one", resource: "club-one" })).toEqual([
      { assignment: assignment.assignment, role },
    ]);
    expect(await concept._getAssignment({ assignment: assignment.assignment })).toEqual([
      { user: "member-one", resource: "club-one", role },
    ]);
    expect(await concept._getAssignment({ assignment: "missing-assignment" })).toEqual([]);
    expect(await concept._assignmentsFor({ user: "member-one", resource: "club-two" })).toEqual([]);
  });

  test("rejects duplicate assignments but permits the same Role on different Resources", async () => {
    const { role } = await concept.createRole({ name: `multi-resource role ${crypto.randomUUID()}` });
    const first = await concept.assign({ user: "same-user", resource: "resource-a", role });

    await expect(
      concept.assign({ user: "same-user", resource: "resource-a", role }),
    ).rejects.toBeInstanceOf(AssignmentAlreadyExists);
    const second = await concept.assign({ user: "same-user", resource: "resource-b", role });

    expect(second.assignment).not.toBe(first.assignment);
    expect(await concept._assignmentsFor({ user: "same-user", resource: "resource-a" })).toEqual([
      { assignment: first.assignment, role },
    ]);
    expect(await concept._assignmentsFor({ user: "same-user", resource: "resource-b" })).toEqual([
      { assignment: second.assignment, role },
    ]);
  });

  test("refuses assignment to a nonexistent Role without creating an Assignment", async () => {
    await expect(
      concept.assign({ user: "user", resource: "resource", role: "missing-role" }),
    ).rejects.toBeInstanceOf(RoleNotFound);
    expect(await concept._assignmentsFor({ user: "user", resource: "resource" })).toEqual([]);
  });

  test("authorizes only matching User, Resource, Role, and Permission and preserves Command identity", async () => {
    const { role } = await concept.createRole({ name: `authorized role ${crypto.randomUUID()}` });
    await concept.permit({ role, permission: "EDIT" });
    await concept.assign({ user: "authorized-user", resource: "resource-one", role });

    const command = { operation: "update", payload: { version: 3 } };
    const result = await concept.authorize({
      user: "authorized-user",
      resource: "resource-one",
      permission: "EDIT",
      command,
    });
    expect(result).toEqual({ authorized: command });
    expect(result.authorized).toBe(command);

    await expect(
      concept.authorize({
        user: "unassigned-user",
        resource: "resource-one",
        permission: "EDIT",
        command,
      }),
    ).rejects.toBeInstanceOf(NotAuthorized);
    await expect(
      concept.authorize({
        user: "authorized-user",
        resource: "resource-one",
        permission: "DELETE",
        command,
      }),
    ).rejects.toBeInstanceOf(NotAuthorized);
    await expect(
      concept.authorize({
        user: "authorized-user",
        resource: "resource-two",
        permission: "EDIT",
        command,
      }),
    ).rejects.toBeInstanceOf(NotAuthorized);
  });

  test("denies immediately after Permission revocation and after unassignment", async () => {
    const { role } = await concept.createRole({ name: `revocable role ${crypto.randomUUID()}` });
    await concept.permit({ role, permission: "PUBLISH" });
    const { assignment } = await concept.assign({
      user: "revocation-user",
      resource: "revocation-resource",
      role,
    });
    const command = { operation: "publish" };

    expect(
      await concept.authorize({
        user: "revocation-user",
        resource: "revocation-resource",
        permission: "PUBLISH",
        command,
      }),
    ).toEqual({ authorized: command });

    await concept.revokePermission({ role, permission: "PUBLISH" });
    await expect(
      concept.authorize({
        user: "revocation-user",
        resource: "revocation-resource",
        permission: "PUBLISH",
        command,
      }),
    ).rejects.toBeInstanceOf(NotAuthorized);

    await concept.permit({ role, permission: "PUBLISH" });
    await concept.unassign({ assignment });
    await expect(
      concept.authorize({
        user: "revocation-user",
        resource: "revocation-resource",
        permission: "PUBLISH",
        command,
      }),
    ).rejects.toBeInstanceOf(NotAuthorized);
  });

  test("refuses deletion for assigned Roles and permits deletion when unassigned", async () => {
    const assigned = await concept.createRole({ name: `role in use ${crypto.randomUUID()}` });
    const { assignment } = await concept.assign({
      user: "delete-user",
      resource: "delete-resource",
      role: assigned.role,
    });
    const beforeDelete = {
      role: await concept._getRole({ role: assigned.role }),
      assignments: await concept._assignmentsFor({ user: "delete-user", resource: "delete-resource" }),
    };

    await expect(concept.deleteRole({ role: assigned.role })).rejects.toBeInstanceOf(RoleInUse);
    expect(await concept._getRole({ role: assigned.role })).toEqual(beforeDelete.role);
    expect(
      await concept._assignmentsFor({ user: "delete-user", resource: "delete-resource" }),
    ).toEqual(beforeDelete.assignments);
    expect(await concept._getAssignment({ assignment })).toHaveLength(1);

    const unusedName = `unused role ${crypto.randomUUID()}`;
    const unused = await concept.createRole({ name: unusedName });
    expect(await concept.deleteRole({ role: unused.role })).toEqual({});
    expect(await concept._getRole({ role: unused.role })).toEqual([]);
    expect(await concept._roles()).not.toContainEqual({
      role: unused.role,
      name: unusedName,
    });
  });

  test("refuses missing Roles and Assignments with the specified error classes", async () => {
    await expect(concept.deleteRole({ role: "missing-delete-role" })).rejects
      .toBeInstanceOf(RoleNotFound);
    await expect(concept.permit({ role: "missing-permit-role", permission: "EDIT" })).rejects
      .toBeInstanceOf(RoleNotFound);
    await expect(
      concept.revokePermission({ role: "missing-revoke-role", permission: "EDIT" }),
    ).rejects.toBeInstanceOf(RoleNotFound);
    await expect(
      concept.assign({ user: "user", resource: "resource", role: "missing-assign-role" }),
    ).rejects.toBeInstanceOf(RoleNotFound);
    await expect(concept.unassign({ assignment: "missing-unassignment" })).rejects
      .toBeInstanceOf(AssignmentNotFound);
  });

  test("concurrent Role creations with the same name produce one Role", async () => {
    const name = `parallel-role-name-${crypto.randomUUID()}`;
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => capture(concept.createRole({ name }))),
    );
    const successes = outcomes.filter(
      (outcome): outcome is { ok: true; value: { role: string } } => outcome.ok,
    );
    const refusals = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(7);
    for (const refusal of refusals) {
      expect(isFailure(refusal, RoleNameAlreadyExists)).toBe(true);
    }
    expect((await concept._roles()).filter((entry) => entry.name === name)).toEqual([
      { role: successes[0].value.role, name },
    ]);
  });

  test("concurrent identical Assignments produce one Assignment", async () => {
    const { role } = await concept.createRole({ name: `parallel-assignment-${crypto.randomUUID()}` });
    const input = { user: "parallel-user", resource: "parallel-resource", role };
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => capture(concept.assign(input))),
    );
    const successes = outcomes.filter(
      (outcome): outcome is { ok: true; value: { assignment: string } } => outcome.ok,
    );
    const refusals = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(7);
    for (const refusal of refusals) {
      expect(isFailure(refusal, AssignmentAlreadyExists)).toBe(true);
    }
    expect(await concept._assignmentsFor({ user: input.user, resource: input.resource })).toEqual([
      { assignment: successes[0].value.assignment, role },
    ]);
  });

  test("racing Role deletion with assignment never leaves an orphan Assignment", async () => {
    const { role } = await concept.createRole({ name: `delete-assign-race-${crypto.randomUUID()}` });
    const assignmentInput = {
      user: "racing-user",
      resource: "racing-resource",
      role,
    };
    const [deletion, assignment] = await Promise.all([
      capture(concept.deleteRole({ role })),
      capture(concept.assign(assignmentInput)),
    ]);

    const currentRole = await concept._getRole({ role });
    const assignments = await concept._assignmentsFor({
      user: assignmentInput.user,
      resource: assignmentInput.resource,
    });
    if (deletion.ok) {
      expect(isFailure(assignment, RoleNotFound)).toBe(true);
      expect(currentRole).toEqual([]);
      expect(assignments).toEqual([]);
    } else {
      expect(isFailure(deletion, RoleInUse)).toBe(true);
      expect(assignment.ok).toBe(true);
      expect(currentRole).toHaveLength(1);
      expect(assignments).toHaveLength(1);
      expect(currentRole).not.toEqual([]);
      expect(await concept._getAssignment({ assignment: assignments[0].assignment })).toEqual([
        {
          user: assignmentInput.user,
          resource: assignmentInput.resource,
          role,
        },
      ]);
    }
  });

  test("authorization racing Permission revocation has a legal serial outcome", async () => {
    const { role } = await concept.createRole({ name: `authorize-revoke-race-${crypto.randomUUID()}` });
    await concept.permit({ role, permission: "RACE_PERMISSION" });
    await concept.assign({ user: "race-user", resource: "race-resource", role });
    const command = { operation: "race" };

    const [authorization, revocation] = await Promise.all([
      capture(
        concept.authorize({
          user: "race-user",
          resource: "race-resource",
          permission: "RACE_PERMISSION",
          command,
        }),
      ),
      capture(concept.revokePermission({ role, permission: "RACE_PERMISSION" })),
    ]);

    expect(revocation).toEqual({ ok: true, value: {} });
    if (authorization.ok) {
      expect(authorization.value.authorized).toBe(command);
    } else {
      expect(authorization.error).toBeInstanceOf(NotAuthorized);
    }
    expect(await concept._permissions({ role })).toEqual([]);
    await expect(
      concept.authorize({
        user: "race-user",
        resource: "race-resource",
        permission: "RACE_PERMISSION",
        command,
      }),
    ).rejects.toBeInstanceOf(NotAuthorized);
  });

  test("concurrent grant and revoke of different Permissions do not lose updates", async () => {
    const { role } = await concept.createRole({ name: `permission-race-${crypto.randomUUID()}` });
    await concept.permit({ role, permission: "KEEP_PERMISSION" });
    await concept.permit({ role, permission: "REMOVE_PERMISSION" });

    const outcomes = await Promise.all([
      capture(concept.permit({ role, permission: "ADD_PERMISSION" })),
      capture(concept.revokePermission({ role, permission: "REMOVE_PERMISSION" })),
    ]);

    expect(outcomes).toEqual([
      { ok: true, value: {} },
      { ok: true, value: {} },
    ]);
    expect(await concept._permissions({ role })).toEqual([
      { permission: "ADD_PERMISSION" },
      { permission: "KEEP_PERMISSION" },
    ]);
  });
});
