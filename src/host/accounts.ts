import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId, type Collection, type Db, type Document } from "mongodb";
import {
  NotAuthorized,
  RoleBasedAccessingConcept,
  hostAssignmentMutation,
} from "../concepts/RoleBasedAccessing.ts";
import type { OptionalMongoSession } from "../mongoAtomic.ts";

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1_000;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const MEMBER_ROLE_NAME = "Member";

type UserDocument = Document & {
  _id: string;
  email: string;
  name: string;
  password: string;
  createdAt: Date;
};
type WorkspaceDocument = Document & { _id: string; name: string; createdAt: Date; owner?: string };
type SessionDocument = Document & {
  _id: string;
  user: string;
  csrfToken: string;
  workspace?: string;
  expiresAt: Date;
};
type InvitationDocument = Document & {
  _id: string;
  tokenHash: string;
  workspace: string;
  email: string;
  invitedBy: string;
  status: "OPEN" | "ACCEPTED" | "REVOKED";
  expiresAt: Date;
  acceptedBy?: string;
};
export type ActivityEventType =
  | "PLAYBOOK_CREATED"
  | "PLAYBOOK_RENAMED"
  | "PLAYBOOK_ARCHIVED"
  | "STEP_ADDED"
  | "STEP_EDITED"
  | "STEP_REMOVED"
  | "CONTEXT_CREATED"
  | "CONTEXT_ATTACHED"
  | "CONTEXT_CHANGED"
  | "REVIEW_CONFIRMED"
  | "REVIEW_RESOLVED"
  | "QUESTION_ANSWERED"
  | "MEMBER_PROMOTED"
  | "OFFICER_DEMOTED"
  | "MEMBER_REMOVED"
  | "OWNERSHIP_CLAIMED"
  | "OWNERSHIP_TRANSFERRED";
type ActivityDocument = Document & {
  _id: ObjectId;
  workspace: string;
  actor: string;
  actorName: string;
  type: ActivityEventType;
  occurredAt: Date;
  procedure?: string;
  step?: string;
  context?: string;
  attachment?: string;
  review?: string;
  question?: string;
  procedureTitle?: string;
  stepPosition?: number;
  targetUser?: string;
  targetName?: string;
  targetRole?: "Owner" | "Officer" | "Member";
};
export interface WorkspaceMember {
  readonly user: string;
  readonly name: string;
  readonly role: string;
  readonly email?: string;
}

export type ApplicationRoles = {
  readonly ownerRole: string;
  readonly officerRole: string;
  readonly memberRole: string;
};

export interface PendingInvitation {
  readonly invitation: string;
  readonly email: string;
  readonly status: "PENDING";
  readonly expiresAt: Date;
}

export interface ActivityEvent {
  readonly event: string;
  readonly actor: string;
  readonly actorName: string;
  readonly type: ActivityEventType;
  readonly occurredAt: Date;
  readonly procedure?: string;
  readonly step?: string;
  readonly context?: string;
  readonly attachment?: string;
  readonly review?: string;
  readonly question?: string;
  readonly procedureTitle?: string;
  readonly stepPosition?: number;
  readonly targetUser?: string;
  readonly targetName?: string;
  readonly targetRole?: "Owner" | "Officer" | "Member";
}

export interface AuthenticatedSession {
  readonly idHash: string;
  readonly user: string;
  readonly email: string;
  readonly name: string;
  readonly csrfToken: string;
  readonly workspace?: string;
  readonly expiresAt: Date;
}

export class AccountInputError extends Error {}
export class AccountConflict extends Error {}
export class InvalidCredentials extends Error {}
export class InvitationUnavailable extends Error {}
export class WorkspaceUnavailable extends Error {}
export class MembershipConflict extends Error {}
export class OwnershipRequired extends Error {}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountInputError("A valid email address is required.");
  }
  return email;
}

function requireText(value: string, label: string, max: number): string {
  const text = value.trim();
  if (!text || text.length > max) throw new AccountInputError(`${label} is required.`);
  return text;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

async function passwordHash(password: string): Promise<string> {
  if (password.length < 10 || password.length > 128) {
    throw new AccountInputError("Password must contain 10 to 128 characters.");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt-v1.${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

async function passwordMatches(stored: string, supplied: string): Promise<boolean> {
  const [version, saltText, expectedText] = stored.split(".");
  if (version !== "scrypt-v1" || !saltText || !expectedText) return false;
  const expected = Buffer.from(expectedText, "base64url");
  const actual = await scrypt(supplied, Buffer.from(saltText, "base64url"), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class AccountStore {
  private readonly users: Collection<UserDocument>;
  private readonly workspaces: Collection<WorkspaceDocument>;
  private readonly sessions: Collection<SessionDocument>;
  private readonly invitations: Collection<InvitationDocument>;
  private readonly activity: Collection<ActivityDocument>;
  private indexesReady?: Promise<void>;

  constructor(
    private readonly database: Db,
    private readonly roleAccess: RoleBasedAccessingConcept,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.users = database.collection<UserDocument>("host_users");
    this.workspaces = database.collection<WorkspaceDocument>("host_workspaces");
    this.sessions = database.collection<SessionDocument>("host_sessions");
    this.invitations = database.collection<InvitationDocument>("host_invitations");
    this.activity = database.collection<ActivityDocument>("host_activity");
  }

  private async ready(): Promise<void> {
    this.indexesReady ??= Promise.all([
      this.users.createIndex({ email: 1 }, { unique: true, name: "user_email_unique" }),
      this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "session_expiry" }),
      this.invitations.createIndex({ tokenHash: 1 }, { unique: true, name: "invitation_token_unique" }),
      this.invitations.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "invitation_expiry" }),
      this.invitations.createIndex({ workspace: 1, status: 1, expiresAt: 1 }, { name: "invitation_workspace_status" }),
      this.activity.createIndex({ workspace: 1, occurredAt: -1, _id: -1 }, { name: "activity_workspace_recent" }),
    ]).then(() => undefined);
    await this.indexesReady;
  }

  async ensureMemberRole(): Promise<string> {
    await this.ready();
    let matches = (await this.roleAccess._roles()).filter(({ name }) => name === MEMBER_ROLE_NAME);
    if (matches.length === 0) {
      try { await this.roleAccess.createRole({ name: MEMBER_ROLE_NAME }); } catch { /* concurrent setup */ }
      matches = (await this.roleAccess._roles()).filter(({ name }) => name === MEMBER_ROLE_NAME);
    }
    if (matches.length !== 1) throw new Error("Member Role provisioning failed.");
    const role = matches[0].role;
    const permissions = await this.roleAccess._permissions({ role });
    if (!permissions.some(({ permission }) => permission === "ASK_QUESTION")) {
      try { await this.roleAccess.permit({ role, permission: "ASK_QUESTION" }); } catch { /* concurrent setup */ }
    }
    return role;
  }

  async register(emailValue: string, password: string, nameValue: string): Promise<{ user: string }> {
    await this.ready();
    const email = normalizeEmail(emailValue);
    const name = requireText(nameValue, "Name", 100);
    const hashed = await passwordHash(password);
    const user = crypto.randomUUID();
    try {
      await this.users.insertOne({ _id: user, email, name, password: hashed, createdAt: this.now() });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new AccountConflict("An account already uses that email address.");
      }
      throw error;
    }
    return { user };
  }

  async verify(emailValue: string, password: string): Promise<{ user: string }> {
    await this.ready();
    let email: string;
    try { email = normalizeEmail(emailValue); } catch { throw new InvalidCredentials(); }
    const found = await this.users.findOne({ email });
    if (!found || !(await passwordMatches(found.password, password))) throw new InvalidCredentials();
    return { user: found._id };
  }

  async createSession(user: string): Promise<{ token: string; session: AuthenticatedSession }> {
    await this.ready();
    const found = await this.users.findOne({ _id: user });
    if (!found) throw new InvalidCredentials();
    const token = randomBytes(32).toString("base64url");
    const idHash = digest(token);
    const csrfToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + SESSION_LIFETIME_MS);
    await this.sessions.insertOne({ _id: idHash, user, csrfToken, expiresAt });
    return { token, session: { idHash, user, email: found.email, name: found.name, csrfToken, expiresAt } };
  }

  async authenticate(token: string): Promise<AuthenticatedSession | null> {
    await this.ready();
    const idHash = digest(token);
    const session = await this.sessions.findOne({ _id: idHash, expiresAt: { $gt: this.now() } });
    if (!session) return null;
    const user = await this.users.findOne({ _id: session.user });
    if (!user) return null;
    return { idHash, user: user._id, email: user.email, name: user.name, csrfToken: session.csrfToken, workspace: session.workspace, expiresAt: session.expiresAt };
  }

  async logout(idHash: string): Promise<void> { await this.sessions.deleteOne({ _id: idHash }); }

  async createWorkspace(user: string, nameValue: string, roles: ApplicationRoles): Promise<{ workspace: string }> {
    await this.ready();
    const name = requireText(nameValue, "Club name", 120);
    const workspace = crypto.randomUUID();
    await this.roleAccess[hostAssignmentMutation](async ({ session, replaceAssignment }) => {
      await this.workspaces.insertOne({ _id: workspace, name, createdAt: this.now(), owner: user }, { session });
      await replaceAssignment(user, workspace, roles.ownerRole);
    });
    return { workspace };
  }

  async memberships(user: string): Promise<{ workspace: string; name: string; role: string; permissions: string[]; ownershipConfigured: boolean }[]> {
    await this.ready();
    const result: { workspace: string; name: string; role: string; permissions: string[]; ownershipConfigured: boolean }[] = [];
    for (const workspace of await this.workspaces.find({}).sort({ name: 1, _id: 1 }).toArray()) {
      const assignments = await this.roleAccess._assignmentsFor({ user, resource: workspace._id });
      if (assignments.length !== 1) continue;
      const assignment = assignments[0];
      const [role] = await this.roleAccess._getRole({ role: assignment.role });
      if (!role) continue;
      const permissions = (await this.roleAccess._permissions({ role: assignment.role })).map(({ permission }) => permission);
      result.push({ workspace: workspace._id, name: workspace.name, role: role.name, permissions, ownershipConfigured: !!workspace.owner });
    }
    return result;
  }

  async selectWorkspace(session: AuthenticatedSession, workspace: string): Promise<void> {
    const memberships = await this.memberships(session.user);
    if (!memberships.some((entry) => entry.workspace === workspace)) throw new WorkspaceUnavailable();
    await this.sessions.updateOne({ _id: session.idHash }, { $set: { workspace } });
  }

  async workspaceMembers(user: string, workspace: string): Promise<WorkspaceMember[]> {
    await this.ready();
    const ownAssignments = await this.roleAccess._assignmentsFor({ user, resource: workspace });
    if (ownAssignments.length !== 1) throw new WorkspaceUnavailable();

    let includeEmails = true;
    try {
      await this.roleAccess.authorize({ user, resource: workspace, permission: "EDIT_PROCEDURE", command: "READ_MEMBER_EMAILS" });
    } catch (error) {
      if (!(error instanceof NotAuthorized)) throw error;
      includeEmails = false;
    }

    const roles = new Map((await this.roleAccess._roles()).map((role) => [role.role, role.name]));
    const members: WorkspaceMember[] = [];
    for (const account of await this.users.find({}).sort({ name: 1, _id: 1 }).toArray()) {
      const assignments = await this.roleAccess._assignmentsFor({ user: account._id, resource: workspace });
      const assignment = assignments.length === 1 ? assignments[0] : undefined;
      const role = assignment ? roles.get(assignment.role) : undefined;
      if (!role) continue;
      members.push({
        user: account._id,
        name: account.name,
        role,
        ...(includeEmails ? { email: account.email } : {}),
      });
    }
    return members.sort((left, right) =>
      Number(right.role === "Owner") - Number(left.role === "Owner") ||
      Number(right.role === "Officer") - Number(left.role === "Officer") ||
      left.name.localeCompare(right.name) || left.user.localeCompare(right.user));
  }

  private async roleName(role: string): Promise<string | undefined> {
    return (await this.roleAccess._getRole({ role }))[0]?.name;
  }

  private async exactRole(user: string, workspace: string): Promise<{ assignment: string; role: string; name: string }> {
    const assignments = await this.roleAccess._assignmentsFor({ user, resource: workspace });
    if (assignments.length !== 1) throw new WorkspaceUnavailable();
    const name = await this.roleName(assignments[0].role);
    if (!name) throw new WorkspaceUnavailable();
    return { ...assignments[0], name };
  }

  async claimLegacyOwnership(user: string, workspace: string, roles: ApplicationRoles): Promise<void> {
    await this.ready();
    const actor = await this.users.findOne({ _id: user });
    if (!actor) throw new WorkspaceUnavailable();
    await this.roleAccess[hostAssignmentMutation](async ({ session, assignmentsFor, replaceAssignment }) => {
      const club = await this.workspaces.findOne({ _id: workspace }, { session });
      if (!club || club.owner) throw new MembershipConflict("Ownership is already configured.");
      const assignments = await assignmentsFor(user, workspace);
      if (assignments.length !== 1 || await this.roleName(assignments[0].role) !== "Officer") throw new NotAuthorized();
      const claimed = await this.workspaces.updateOne({ _id: workspace, owner: { $exists: false } }, { $set: { owner: user } }, { session });
      if (claimed.modifiedCount !== 1) throw new MembershipConflict("Ownership was claimed concurrently.");
      await replaceAssignment(user, workspace, roles.ownerRole);
      await this.insertMembershipActivity({ workspace, actor: user, actorName: actor.name, type: "OWNERSHIP_CLAIMED", targetUser: user, targetName: actor.name, targetRole: "Owner" }, session);
    });
  }

  async changeMemberRole(actorId: string, workspace: string, targetUser: string, targetRole: "Officer" | "Member", roles: ApplicationRoles): Promise<void> {
    await this.ready();
    await this.roleAccess[hostAssignmentMutation](async ({ session, assignmentsFor, replaceAssignment }) => {
      const club = await this.workspaces.findOne({ _id: workspace }, { session });
      if (!club?.owner) throw new OwnershipRequired();
      const [actorAssignments, targetAssignments, actor, target] = await Promise.all([
        assignmentsFor(actorId, workspace), assignmentsFor(targetUser, workspace),
        this.users.findOne({ _id: actorId }, { session }), this.users.findOne({ _id: targetUser }, { session }),
      ]);
      if (!actor || !target || actorAssignments.length !== 1 || targetAssignments.length !== 1) throw new WorkspaceUnavailable();
      const actorRole = await this.roleName(actorAssignments[0].role);
      const currentTargetRole = await this.roleName(targetAssignments[0].role);
      if (!actorRole || !currentTargetRole) throw new WorkspaceUnavailable();
      if (targetUser === club.owner) {
        if (actorId !== club.owner) throw new NotAuthorized();
        throw new MembershipConflict();
      }
      if (targetUser === actorId || currentTargetRole === targetRole) throw new MembershipConflict();
      const actorIsOwner = club.owner === actorId && actorRole === "Owner";
      const officerPromotion = actorRole === "Officer" && currentTargetRole === "Member" && targetRole === "Officer";
      if (!actorIsOwner && !officerPromotion) throw new NotAuthorized();
      if (currentTargetRole === "Owner") throw new MembershipConflict();
      await replaceAssignment(targetUser, workspace, targetRole === "Officer" ? roles.officerRole : roles.memberRole);
      await this.insertMembershipActivity({ workspace, actor: actorId, actorName: actor.name, type: targetRole === "Officer" ? "MEMBER_PROMOTED" : "OFFICER_DEMOTED", targetUser, targetName: target.name, targetRole }, session);
    });
  }

  async removeMember(actorId: string, workspace: string, targetUser: string): Promise<void> {
    await this.ready();
    await this.roleAccess[hostAssignmentMutation](async ({ session, assignmentsFor, removeAssignments }) => {
      const club = await this.workspaces.findOne({ _id: workspace }, { session });
      if (!club?.owner) throw new OwnershipRequired();
      const [actorAssignments, targetAssignments, actor, target] = await Promise.all([
        assignmentsFor(actorId, workspace), assignmentsFor(targetUser, workspace),
        this.users.findOne({ _id: actorId }, { session }), this.users.findOne({ _id: targetUser }, { session }),
      ]);
      if (!actor || !target || actorAssignments.length !== 1 || targetAssignments.length !== 1) throw new WorkspaceUnavailable();
      const actorRole = await this.roleName(actorAssignments[0].role);
      const targetRole = await this.roleName(targetAssignments[0].role);
      if (!actorRole || !targetRole) throw new WorkspaceUnavailable();
      if (targetUser === club.owner) {
        if (actorId !== club.owner) throw new NotAuthorized();
        throw new MembershipConflict();
      }
      if (targetUser === actorId) throw new MembershipConflict();
      const allowed = club.owner === actorId || (actorRole === "Officer" && targetRole === "Member");
      if (!allowed || (actorRole === "Officer" && targetRole !== "Member")) throw new NotAuthorized();
      await removeAssignments(targetUser, workspace);
      await this.sessions.updateMany({ user: targetUser, workspace }, { $unset: { workspace: "" } }, { session });
      await this.invitations.updateMany({ workspace, email: target.email, status: "OPEN" }, { $set: { status: "REVOKED" } }, { session });
      await this.insertMembershipActivity({ workspace, actor: actorId, actorName: actor.name, type: "MEMBER_REMOVED", targetUser, targetName: target.name, targetRole: targetRole as "Officer" | "Member" }, session);
    });
  }

  async transferOwnership(actorId: string, workspace: string, targetUser: string, formerOwnerRole: "Officer" | "Member", roles: ApplicationRoles): Promise<void> {
    await this.ready();
    await this.roleAccess[hostAssignmentMutation](async ({ session, assignmentsFor, replaceAssignment }) => {
      const club = await this.workspaces.findOne({ _id: workspace }, { session });
      if (!club || club.owner !== actorId || targetUser === actorId) throw new NotAuthorized();
      const [actorAssignments, targetAssignments, actor, target] = await Promise.all([
        assignmentsFor(actorId, workspace), assignmentsFor(targetUser, workspace),
        this.users.findOne({ _id: actorId }, { session }), this.users.findOne({ _id: targetUser }, { session }),
      ]);
      if (!actor || !target || actorAssignments.length !== 1 || targetAssignments.length !== 1) throw new WorkspaceUnavailable();
      if (await this.roleName(actorAssignments[0].role) !== "Owner" || await this.roleName(targetAssignments[0].role) === "Owner") throw new MembershipConflict();
      const changed = await this.workspaces.updateOne({ _id: workspace, owner: actorId }, { $set: { owner: targetUser } }, { session });
      if (changed.modifiedCount !== 1) throw new MembershipConflict("Ownership changed concurrently.");
      await replaceAssignment(targetUser, workspace, roles.ownerRole);
      await replaceAssignment(actorId, workspace, formerOwnerRole === "Officer" ? roles.officerRole : roles.memberRole);
      await this.insertMembershipActivity({ workspace, actor: actorId, actorName: actor.name, type: "OWNERSHIP_TRANSFERRED", targetUser, targetName: target.name, targetRole: "Owner" }, session);
    });
  }

  async pendingInvitations(user: string, workspace: string): Promise<PendingInvitation[]> {
    await this.ready();
    const membership = await this.exactRole(user, workspace);
    if (membership.name !== "Owner" && membership.name !== "Officer") throw new NotAuthorized();
    const invitations = await this.invitations.find({ workspace, status: "OPEN", expiresAt: { $gt: this.now() } })
      .sort({ expiresAt: 1, email: 1, _id: 1 }).toArray();
    return invitations.map((invitation) => ({
      invitation: invitation._id,
      email: invitation.email,
      status: "PENDING",
      expiresAt: invitation.expiresAt,
    }));
  }

  async createInvitation(user: string, workspace: string, emailValue: string): Promise<{ invitation: string; email: string; token: string; expiresAt: Date }> {
    await this.ready();
    const membership = await this.exactRole(user, workspace);
    if (membership.name !== "Owner" && membership.name !== "Officer") throw new NotAuthorized();
    const email = normalizeEmail(emailValue);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + INVITATION_LIFETIME_MS);
    const invitation = crypto.randomUUID();
    await this.invitations.insertOne({ _id: invitation, tokenHash: digest(token), workspace, email, invitedBy: user, status: "OPEN", expiresAt });
    return { invitation, email, token, expiresAt };
  }

  async reissueInvitation(user: string, workspace: string, invitation: string): Promise<{ invitation: string; email: string; token: string; expiresAt: Date }> {
    await this.ready();
    const membership = await this.exactRole(user, workspace);
    if (membership.name !== "Owner" && membership.name !== "Officer") throw new NotAuthorized();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + INVITATION_LIFETIME_MS);
    const replaced = await this.invitations.findOneAndUpdate(
      { _id: invitation, workspace, status: "OPEN", expiresAt: { $gt: this.now() } },
      { $set: { tokenHash: digest(token), expiresAt, invitedBy: user }, $unset: { acceptedBy: "" } },
      { returnDocument: "after" },
    );
    if (!replaced) throw new InvitationUnavailable();
    return { invitation: replaced._id, email: replaced.email, token, expiresAt: replaced.expiresAt };
  }

  async acceptInvitation(user: string, token: string, memberRole: string): Promise<{ workspace: string }> {
    await this.ready();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InvitationUnavailable();
    const account = await this.users.findOne({ _id: user });
    if (!account) throw new InvitationUnavailable();
    return this.roleAccess[hostAssignmentMutation](async ({ session, assignmentsFor, replaceAssignment }) => {
      const invite = await this.invitations.findOne(
        { tokenHash: digest(token), email: account.email, status: "OPEN", expiresAt: { $gt: this.now() } }, { session },
      );
      if (!invite || (await assignmentsFor(user, invite.workspace)).length !== 0) throw new InvitationUnavailable();
      const accepted = await this.invitations.updateOne({ _id: invite._id, status: "OPEN" }, { $set: { status: "ACCEPTED", acceptedBy: user } }, { session });
      if (accepted.modifiedCount !== 1) throw new InvitationUnavailable();
      await replaceAssignment(user, invite.workspace, memberRole);
      return { workspace: invite.workspace };
    });
  }

  async recordActivity(input: {
    workspace: string;
    actor: string;
    actorName: string;
    type: ActivityEventType;
    procedure?: string;
    step?: string;
    context?: string;
    attachment?: string;
    review?: string;
    question?: string;
    procedureTitle?: string;
    stepPosition?: number;
    targetUser?: string;
    targetName?: string;
    targetRole?: "Owner" | "Officer" | "Member";
  }): Promise<void> {
    await this.ready();
    const occurredAt = this.now();
    await this.activity.insertOne({
      _id: new ObjectId(),
      workspace: input.workspace,
      actor: input.actor,
      actorName: input.actorName,
      type: input.type,
      occurredAt,
      ...(input.procedure ? { procedure: input.procedure } : {}),
      ...(input.step ? { step: input.step } : {}),
      ...(input.context ? { context: input.context } : {}),
      ...(input.attachment ? { attachment: input.attachment } : {}),
      ...(input.review ? { review: input.review } : {}),
      ...(input.question ? { question: input.question } : {}),
      ...(input.procedureTitle ? { procedureTitle: input.procedureTitle.slice(0, 200) } : {}),
      ...(input.stepPosition !== undefined ? { stepPosition: input.stepPosition } : {}),
      ...(input.targetUser ? { targetUser: input.targetUser } : {}),
      ...(input.targetName ? { targetName: input.targetName.slice(0, 100) } : {}),
      ...(input.targetRole ? { targetRole: input.targetRole } : {}),
    });
  }

  private async insertMembershipActivity(
    input: {
      workspace: string;
      actor: string;
      actorName: string;
      type: "MEMBER_PROMOTED" | "OFFICER_DEMOTED" | "MEMBER_REMOVED" | "OWNERSHIP_CLAIMED" | "OWNERSHIP_TRANSFERRED";
      targetUser: string;
      targetName: string;
      targetRole: "Owner" | "Officer" | "Member";
    },
    session: OptionalMongoSession,
  ): Promise<void> {
    await this.activity.insertOne({
      _id: new ObjectId(),
      workspace: input.workspace,
      actor: input.actor,
      actorName: input.actorName,
      type: input.type,
      occurredAt: this.now(),
      targetUser: input.targetUser,
      targetName: input.targetName.slice(0, 100),
      targetRole: input.targetRole,
    }, { session });
  }

  async recordContextAttachment(input: {
    workspace: string;
    actor: string;
    actorName: string;
    context: string;
    attachment: string;
    procedure: string;
    procedureTitle: string;
    step?: string;
    stepPosition?: number;
  }): Promise<void> {
    await this.ready();
    const occurredAt = this.now();
    const workflowCutoff = new Date(occurredAt.getTime() - 5 * 60 * 1_000);
    const upgraded = await this.activity.findOneAndUpdate(
      {
        workspace: input.workspace,
        actor: input.actor,
        context: input.context,
        type: "CONTEXT_CREATED",
        occurredAt: { $gte: workflowCutoff },
      },
      {
        $set: {
          type: "CONTEXT_ATTACHED",
          occurredAt,
          attachment: input.attachment,
          procedure: input.procedure,
          procedureTitle: input.procedureTitle.slice(0, 200),
          ...(input.step ? { step: input.step } : {}),
          ...(input.stepPosition !== undefined ? { stepPosition: input.stepPosition } : {}),
        },
      },
      { sort: { occurredAt: -1, _id: -1 }, returnDocument: "after" },
    );
    if (upgraded) return;
    await this.recordActivity({
      ...input,
      type: "CONTEXT_ATTACHED",
    });
  }

  async recentActivity(user: string, workspace: string): Promise<ActivityEvent[]> {
    await this.ready();
    const membership = await this.exactRole(user, workspace);
    if (membership.name !== "Owner" && membership.name !== "Officer") throw new NotAuthorized();
    return (await this.activity.find({ workspace }).sort({ occurredAt: -1, _id: -1 }).limit(5).toArray())
      .map((event) => ({
        event: event._id.toHexString(),
        actor: event.actor,
        actorName: event.actorName,
        type: event.type,
        occurredAt: event.occurredAt,
        ...(event.procedure ? { procedure: event.procedure } : {}),
        ...(event.step ? { step: event.step } : {}),
        ...(event.context ? { context: event.context } : {}),
        ...(event.attachment ? { attachment: event.attachment } : {}),
        ...(event.review ? { review: event.review } : {}),
        ...(event.question ? { question: event.question } : {}),
        ...(event.procedureTitle ? { procedureTitle: event.procedureTitle } : {}),
        ...(event.stepPosition !== undefined ? { stepPosition: event.stepPosition } : {}),
        ...(event.targetUser ? { targetUser: event.targetUser } : {}),
        ...(event.targetName ? { targetName: event.targetName } : {}),
        ...(event.targetRole ? { targetRole: event.targetRole } : {}),
      }));
  }
}

export { NotAuthorized };
