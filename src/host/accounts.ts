import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Collection, Db, Document } from "mongodb";
import {
  AssignmentAlreadyExists,
  NotAuthorized,
  RoleBasedAccessingConcept,
} from "../concepts/RoleBasedAccessing.ts";

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
type WorkspaceDocument = Document & { _id: string; name: string; createdAt: Date };
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
  status: "OPEN" | "ACCEPTED";
  expiresAt: Date;
  acceptedBy?: string;
};

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
  private indexesReady?: Promise<void>;

  constructor(
    database: Db,
    private readonly roleAccess: RoleBasedAccessingConcept,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.users = database.collection<UserDocument>("host_users");
    this.workspaces = database.collection<WorkspaceDocument>("host_workspaces");
    this.sessions = database.collection<SessionDocument>("host_sessions");
    this.invitations = database.collection<InvitationDocument>("host_invitations");
  }

  private async ready(): Promise<void> {
    this.indexesReady ??= Promise.all([
      this.users.createIndex({ email: 1 }, { unique: true, name: "user_email_unique" }),
      this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "session_expiry" }),
      this.invitations.createIndex({ tokenHash: 1 }, { unique: true, name: "invitation_token_unique" }),
      this.invitations.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "invitation_expiry" }),
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

  async createWorkspace(user: string, nameValue: string, officerRole: string): Promise<{ workspace: string }> {
    await this.ready();
    const name = requireText(nameValue, "Club name", 120);
    const workspace = crypto.randomUUID();
    await this.workspaces.insertOne({ _id: workspace, name, createdAt: this.now() });
    try { await this.roleAccess.assign({ user, resource: workspace, role: officerRole }); }
    catch (error) { await this.workspaces.deleteOne({ _id: workspace }); throw error; }
    return { workspace };
  }

  async memberships(user: string): Promise<{ workspace: string; name: string; role: string; permissions: string[] }[]> {
    await this.ready();
    const result: { workspace: string; name: string; role: string; permissions: string[] }[] = [];
    for (const workspace of await this.workspaces.find({}).sort({ name: 1, _id: 1 }).toArray()) {
      const assignments = await this.roleAccess._assignmentsFor({ user, resource: workspace._id });
      for (const assignment of assignments) {
        const [role] = await this.roleAccess._getRole({ role: assignment.role });
        if (!role) continue;
        const permissions = (await this.roleAccess._permissions({ role: assignment.role })).map(({ permission }) => permission);
        result.push({ workspace: workspace._id, name: workspace.name, role: role.name, permissions });
      }
    }
    return result;
  }

  async selectWorkspace(session: AuthenticatedSession, workspace: string): Promise<void> {
    const memberships = await this.memberships(session.user);
    if (!memberships.some((entry) => entry.workspace === workspace)) throw new WorkspaceUnavailable();
    await this.sessions.updateOne({ _id: session.idHash }, { $set: { workspace } });
  }

  async createInvitation(user: string, workspace: string, emailValue: string): Promise<{ token: string; expiresAt: Date }> {
    await this.ready();
    await this.roleAccess.authorize({ user, resource: workspace, permission: "EDIT_PROCEDURE", command: "INVITE_MEMBER" });
    const email = normalizeEmail(emailValue);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + INVITATION_LIFETIME_MS);
    await this.invitations.insertOne({ _id: crypto.randomUUID(), tokenHash: digest(token), workspace, email, invitedBy: user, status: "OPEN", expiresAt });
    return { token, expiresAt };
  }

  async acceptInvitation(user: string, token: string, memberRole: string): Promise<{ workspace: string }> {
    await this.ready();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InvitationUnavailable();
    const account = await this.users.findOne({ _id: user });
    if (!account) throw new InvitationUnavailable();
    const invite = await this.invitations.findOneAndUpdate(
      { tokenHash: digest(token), email: account.email, status: "OPEN", expiresAt: { $gt: this.now() } },
      { $set: { status: "ACCEPTED", acceptedBy: user } },
      { returnDocument: "after" },
    );
    if (!invite) throw new InvitationUnavailable();
    try { await this.roleAccess.assign({ user, resource: invite.workspace, role: memberRole }); }
    catch (error) { if (!(error instanceof AssignmentAlreadyExists)) throw error; }
    return { workspace: invite.workspace };
  }
}

export { NotAuthorized };
