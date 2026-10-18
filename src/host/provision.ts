import {
  AssignmentAlreadyExists,
  PermissionAlreadyGranted,
  RoleBasedAccessingConcept,
  RoleNameAlreadyExists,
} from "../concepts/RoleBasedAccessing.ts";
import type { HostConfig } from "./config.ts";

const OFFICER_ROLE_NAME = "Officer";
const OWNER_ROLE_NAME = "Owner";
const OFFICER_PERMISSIONS = [
  "ASK_QUESTION",
  "ANSWER_QUESTION",
  "EDIT_PROCEDURE",
  "EDIT_CONTEXT",
  "COMPLETE_REVIEW",
] as const;

export async function provisionApplicationRoles(
  roleAccess: RoleBasedAccessingConcept,
): Promise<{ ownerRole: string; officerRole: string; memberRole: string }> {
  const officerRole = await ensureOfficerRole(roleAccess);
  await ensureOfficerPermissions(roleAccess, officerRole);
  let owners = (await roleAccess._roles()).filter(({ name }) => name === OWNER_ROLE_NAME);
  if (owners.length === 0) {
    try { await roleAccess.createRole({ name: OWNER_ROLE_NAME }); } catch { /* concurrent startup */ }
    owners = (await roleAccess._roles()).filter(({ name }) => name === OWNER_ROLE_NAME);
  }
  if (owners.length !== 1) throw new OfficerProvisioningConflict("Owner Role provisioning failed.");
  const ownerRole = owners[0].role;
  await ensureOfficerPermissions(roleAccess, ownerRole);
  let members = (await roleAccess._roles()).filter(({ name }) => name === "Member");
  if (members.length === 0) {
    try { await roleAccess.createRole({ name: "Member" }); } catch { /* concurrent startup */ }
    members = (await roleAccess._roles()).filter(({ name }) => name === "Member");
  }
  if (members.length !== 1) throw new OfficerProvisioningConflict("Member Role provisioning failed.");
  const memberRole = members[0].role;
  const permissions = await roleAccess._permissions({ role: memberRole });
  const unexpected = permissions.filter(({ permission }) => permission !== "ASK_QUESTION");
  if (unexpected.length) throw new OfficerProvisioningConflict("Member Role has unexpected permissions.");
  if (!permissions.some(({ permission }) => permission === "ASK_QUESTION")) {
    try { await roleAccess.permit({ role: memberRole, permission: "ASK_QUESTION" }); }
    catch (error) { if (!(error instanceof PermissionAlreadyGranted)) throw error; }
  }
  return { ownerRole, officerRole, memberRole };
}

export class OfficerProvisioningConflict extends Error {}

export interface OfficerProvisioningResult {
  readonly role: string;
  readonly assignment: string;
}

async function findOfficerRole(
  roleAccess: RoleBasedAccessingConcept,
): Promise<string | undefined> {
  const matches = (await roleAccess._roles()).filter(({ name }) => name === OFFICER_ROLE_NAME);
  if (matches.length > 1) {
    throw new OfficerProvisioningConflict("More than one Officer Role exists.");
  }
  return matches[0]?.role;
}

async function ensureOfficerRole(
  roleAccess: RoleBasedAccessingConcept,
): Promise<string> {
  const existingRole = await findOfficerRole(roleAccess);
  if (existingRole !== undefined) return existingRole;

  try {
    return (await roleAccess.createRole({ name: OFFICER_ROLE_NAME })).role;
  } catch (error) {
    if (!(error instanceof RoleNameAlreadyExists)) throw error;

    const concurrentRole = await findOfficerRole(roleAccess);
    if (concurrentRole === undefined) {
      throw new OfficerProvisioningConflict(
        "Officer Role creation was refused, but no Officer Role can be found.",
      );
    }
    return concurrentRole;
  }
}

async function ensureOfficerPermissions(
  roleAccess: RoleBasedAccessingConcept,
  role: string,
): Promise<void> {
  const existing = (await roleAccess._permissions({ role })).map(({ permission }) => permission);
  const existingSet = new Set(existing);
  if (existingSet.size !== existing.length) {
    throw new OfficerProvisioningConflict(
      "Officer Role contains duplicate permissions; provisioning will not modify it.",
    );
  }
  const expectedSet = new Set<string>(OFFICER_PERMISSIONS);
  const unexpected = existing.filter((permission) => !expectedSet.has(permission));
  if (unexpected.length > 0) {
    throw new OfficerProvisioningConflict(
      "Officer Role has unexpected permissions; provisioning will not modify it.",
    );
  }

  for (const permission of OFFICER_PERMISSIONS) {
    if (existingSet.has(permission)) continue;
    try {
      await roleAccess.permit({ role, permission });
    } catch (error) {
      if (!(error instanceof PermissionAlreadyGranted)) throw error;

      const currentPermissions = await roleAccess._permissions({ role });
      if (!currentPermissions.some((entry) => entry.permission === permission)) {
        throw new OfficerProvisioningConflict(
          "Officer permission grant was refused, and the expected permission is absent.",
        );
      }
    }
  }
}

async function ensureOfficerAssignment(
  roleAccess: RoleBasedAccessingConcept,
  user: string,
  resource: string,
  role: string,
): Promise<string> {
  const assignments = await roleAccess._assignmentsFor({ user, resource });
  if (assignments.some((entry) => entry.role !== role)) {
    throw new OfficerProvisioningConflict(
      "The configured Officer already has a different Role in the workspace.",
    );
  }
  const matchingAssignments = assignments.filter((entry) => entry.role === role);
  if (matchingAssignments.length > 1) {
    throw new OfficerProvisioningConflict(
      "More than one Officer Role Assignment exists for the configured User and workspace.",
    );
  }
  if (matchingAssignments[0] !== undefined) return matchingAssignments[0].assignment;

  try {
    return (await roleAccess.assign({ user, resource, role })).assignment;
  } catch (error) {
    if (!(error instanceof AssignmentAlreadyExists)) throw error;

    const concurrentAssignments = await roleAccess._assignmentsFor({ user, resource });
    const concurrentMatch = concurrentAssignments.filter((entry) => entry.role === role);
    if (concurrentMatch.length !== 1) {
      throw new OfficerProvisioningConflict(
        "Officer Assignment was refused, but the expected Assignment could not be verified.",
      );
    }
    return concurrentMatch[0].assignment;
  }
}

/**
 * Explicit host-only bootstrap. Call only from controlled startup/operator code,
 * never from an HTTP request path.
 */
export async function provisionOfficer(
  config: HostConfig,
  roleAccess: RoleBasedAccessingConcept,
): Promise<OfficerProvisioningResult> {
  const role = await ensureOfficerRole(roleAccess);
  await ensureOfficerPermissions(roleAccess, role);
  const assignment = await ensureOfficerAssignment(
    roleAccess,
    config.officerUserId,
    config.clubWorkspaceId,
    role,
  );

  const [roleRows, permissions, assignments, assignmentRows] = await Promise.all([
    roleAccess._getRole({ role }),
    roleAccess._permissions({ role }),
    roleAccess._assignmentsFor({
      user: config.officerUserId,
      resource: config.clubWorkspaceId,
    }),
    roleAccess._getAssignment({ assignment }),
  ]);
  const permissionNames = permissions.map(({ permission }) => permission).toSorted();
  const expectedPermissions = [...OFFICER_PERMISSIONS].toSorted();
  const finalAssignments = assignments.filter((entry) => entry.role === role);

  if (
    roleRows.length !== 1 ||
    roleRows[0].name !== OFFICER_ROLE_NAME ||
    permissionNames.length !== expectedPermissions.length ||
    permissionNames.some((permission, index) => permission !== expectedPermissions[index]) ||
    finalAssignments.length !== 1 ||
    finalAssignments[0].assignment !== assignment ||
    assignmentRows.length !== 1 ||
    assignmentRows[0].user !== config.officerUserId ||
    assignmentRows[0].resource !== config.clubWorkspaceId ||
    assignmentRows[0].role !== role
  ) {
    throw new OfficerProvisioningConflict(
      "Officer provisioning did not result in the exact required Role, permissions, and Assignment.",
    );
  }

  return Object.freeze({ role, assignment });
}
