import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { RoleBasedAccessingConcept } from "../../src/concepts/RoleBasedAccessing.ts";
import { validateHostConfig } from "../../src/host/config.ts";
import {
  OfficerProvisioningConflict,
  provisionOfficer,
} from "../../src/host/provision.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = testClient.db().databaseName;
const testDatabaseName = `relay_host_provision_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The host provisioning test database must be isolated from application data.");
}

const testDb = testClient.db(testDatabaseName);
const roleAccess = new RoleBasedAccessingConcept(testDb, testClient);
const additionalTestDatabaseNames = new Set<string>();

function config(workspace = "provision-test-workspace", user = "provision-test-officer") {
  return validateHostConfig({
    CLUB_WORKSPACE_ID: workspace,
    OFFICER_USER_ID: user,
    LOCAL_ACCESS_CREDENTIAL: Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64url"),
    MONGODB_URL: configuredUrl!,
  });
}

describe("host Officer provisioning", () => {
  beforeAll(async () => {
    await testClient.connect();
    await testDb.command({ ping: 1 });
  });

  afterAll(async () => {
    try {
      for (const name of [testDatabaseName, ...additionalTestDatabaseNames]) {
        await testClient.db(name).dropDatabase();
        const remainingTestDatabases = await testClient.db("admin").command({
          listDatabases: 1,
          nameOnly: true,
          filter: { name },
        });
        expect(remainingTestDatabases.databases).toEqual([]);
      }
    } finally {
      await testClient.close();
    }
  });

  test("uses a unique test database separate from the application database", () => {
    expect(testDatabaseName).not.toBe(applicationDatabaseName);
    expect(testDatabaseName).toMatch(/^relay_host_provision_tests_[a-f0-9]+$/);
  });

  test("creates the exact Officer Role, permissions, and configured assignment", async () => {
    const hostConfig = config();
    const result = await provisionOfficer(hostConfig, roleAccess);

    expect(await roleAccess._getRole({ role: result.role })).toEqual([{ name: "Officer" }]);
    expect(await roleAccess._permissions({ role: result.role })).toEqual([
      { permission: "COMPLETE_REVIEW" },
      { permission: "EDIT_CONTEXT" },
      { permission: "EDIT_PROCEDURE" },
    ]);
    expect(await roleAccess._getAssignment({ assignment: result.assignment })).toEqual([
      {
        user: hostConfig.officerUserId,
        resource: hostConfig.clubWorkspaceId,
        role: result.role,
      },
    ]);
  });

  test("is idempotent and preserves Role and Assignment identities", async () => {
    const hostConfig = config("idempotent-workspace", "idempotent-officer");
    const first = await provisionOfficer(hostConfig, roleAccess);
    const second = await provisionOfficer(hostConfig, roleAccess);

    expect(second).toEqual(first);
    expect((await roleAccess._roles()).filter(({ name }) => name === "Officer")).toEqual([
      { role: first.role, name: "Officer" },
    ]);
    expect(await roleAccess._assignmentsFor({
      user: hostConfig.officerUserId,
      resource: hostConfig.clubWorkspaceId,
    })).toEqual([{ assignment: first.assignment, role: first.role }]);
  });

  test("does not assign the Officer Role to another workspace automatically", async () => {
    const hostConfig = config("primary-workspace", "shared-officer");
    const otherWorkspace = "separate-workspace";
    const provisioned = await provisionOfficer(hostConfig, roleAccess);

    expect(await roleAccess._assignmentsFor({
      user: hostConfig.officerUserId,
      resource: otherWorkspace,
    })).toEqual([]);
    expect(await roleAccess._getRole({ role: provisioned.role })).toEqual([{ name: "Officer" }]);
  });

  test("reuses pre-existing expected state created through concept actions", async () => {
    const hostConfig = config("preexisting-workspace", "preexisting-officer");
    const [roleEntry] = (await roleAccess._roles()).filter(({ name }) => name === "Officer");
    const role = roleEntry.role;
    const { assignment } = await roleAccess.assign({
      user: hostConfig.officerUserId,
      resource: hostConfig.clubWorkspaceId,
      role,
    });

    await expect(provisionOfficer(hostConfig, roleAccess)).resolves.toEqual({ role, assignment });
    expect((await roleAccess._roles()).filter(({ name }) => name === "Officer")).toEqual([
      { role, name: "Officer" },
    ]);
  });

  test("concurrent first-time provisioning converges to one Role and Assignment", async () => {
    const concurrentDatabaseName =
      `rhp_${crypto.randomUUID().replaceAll("-", "")}`;
    expect(concurrentDatabaseName).not.toBe(applicationDatabaseName);
    additionalTestDatabaseNames.add(concurrentDatabaseName);
    const concurrentDb = testClient.db(concurrentDatabaseName);
    const concurrentRoleAccess = new RoleBasedAccessingConcept(concurrentDb, testClient);
    const hostConfig = config("concurrent-workspace", "concurrent-officer");
    const results = await Promise.all(
      Array.from({ length: 8 }, () => provisionOfficer(hostConfig, concurrentRoleAccess)),
    );
    const roleIds = new Set(results.map(({ role }) => role));
    const assignmentIds = new Set(results.map(({ assignment }) => assignment));

    expect(roleIds.size).toBe(1);
    expect(assignmentIds.size).toBe(1);
    expect((await concurrentRoleAccess._roles()).filter(({ name }) => name === "Officer")).toHaveLength(1);
    expect(await concurrentRoleAccess._permissions({ role: results[0].role })).toEqual([
      { permission: "COMPLETE_REVIEW" },
      { permission: "EDIT_CONTEXT" },
      { permission: "EDIT_PROCEDURE" },
    ]);
    expect(await concurrentRoleAccess._assignmentsFor({
      user: hostConfig.officerUserId,
      resource: hostConfig.clubWorkspaceId,
    })).toEqual([{ assignment: results[0].assignment, role: results[0].role }]);
  });

  test("refuses to add an Officer assignment over a conflicting existing Role", async () => {
    const hostConfig = config("assignment-conflict-workspace", "assignment-conflict-user");
    const otherRole = await roleAccess.createRole({ name: "Unexpected existing role" });
    const existingAssignment = await roleAccess.assign({
      user: hostConfig.officerUserId,
      resource: hostConfig.clubWorkspaceId,
      role: otherRole.role,
    });

    await expect(provisionOfficer(hostConfig, roleAccess)).rejects
      .toBeInstanceOf(OfficerProvisioningConflict);
    expect(await roleAccess._assignmentsFor({
      user: hostConfig.officerUserId,
      resource: hostConfig.clubWorkspaceId,
    })).toEqual([{ assignment: existingAssignment.assignment, role: otherRole.role }]);
  });

  test("fails closed without modifying an Officer Role with unexpected permissions", async () => {
    const hostConfig = config("conflict-workspace", "conflict-officer");
    const { role } = (await roleAccess._roles()).find(({ name }) => name === "Officer")!;
    await roleAccess.permit({ role, permission: "UNEXPECTED_PERMISSION" });

    await expect(provisionOfficer(hostConfig, roleAccess)).rejects
      .toBeInstanceOf(OfficerProvisioningConflict);
    expect(await roleAccess._permissions({ role })).toEqual([
      { permission: "COMPLETE_REVIEW" },
      { permission: "EDIT_CONTEXT" },
      { permission: "EDIT_PROCEDURE" },
      { permission: "UNEXPECTED_PERMISSION" },
    ]);
    expect(await roleAccess._assignmentsFor({
      user: hostConfig.officerUserId,
      resource: hostConfig.clubWorkspaceId,
    })).toEqual([]);
  });
});
