import {
  MongoServerError,
  type ClientSession,
  type Collection,
  type Db,
  type Document,
  type MongoClient,
} from "mongodb";
import { connectToDatabase, db, mongoClient } from "../db.ts";

type RoleDocument = Document & {
  _id: string;
  name: string;
  permissions: string[];
  coordinationVersion: number;
};

type AssignmentDocument = Document & {
  _id: string;
  user: string;
  resource: string;
  role: string;
};

type RoleBasedAccessingStorage = {
  db: Db;
  mongoClient: MongoClient;
  roles: Collection<RoleDocument>;
  assignments: Collection<AssignmentDocument>;
  indexesReady?: Promise<void>;
};

export class RoleNameAlreadyExists extends Error {}
export class RoleNotFound extends Error {}
export class RoleInUse extends Error {}
export class PermissionAlreadyGranted extends Error {}
export class PermissionNotGranted extends Error {}
export class AssignmentAlreadyExists extends Error {}
export class AssignmentNotFound extends Error {}
export class NotAuthorized extends Error {}
export class RoleBasedAccessingIntegrityError extends Error {}

async function ensureConnected(storage: RoleBasedAccessingStorage): Promise<void> {
  if (storage.db === db && storage.mongoClient === mongoClient) {
    await connectToDatabase();
  } else {
    await storage.mongoClient.connect();
    await storage.db.command({ ping: 1 });
  }
}

async function ensureStorage(storage: RoleBasedAccessingStorage): Promise<void> {
  await ensureConnected(storage);
  storage.indexesReady ??= Promise.all([
    storage.roles.createIndex(
      { name: 1 },
      { name: "role_name_unique", unique: true },
    ),
    storage.assignments.createIndex(
      { user: 1, resource: 1, role: 1 },
      { name: "user_resource_role_unique", unique: true },
    ),
    storage.assignments.createIndex(
      { user: 1, resource: 1, _id: 1 },
      { name: "assignments_user_resource_identity" },
    ),
    storage.assignments.createIndex(
      { role: 1, _id: 1 },
      { name: "assignments_role_identity" },
    ),
  ]).then(() => undefined);
  await storage.indexesReady;
}

async function inTransaction<T>(
  storage: RoleBasedAccessingStorage,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await ensureStorage(storage);
  const session = storage.mongoClient.startSession();
  try {
    const result = await session.withTransaction(async () => ({
      value: await work(session),
    }));
    if (result === undefined) {
      throw new Error("MongoDB transaction completed without a result.");
    }
    return result.value;
  } finally {
    await session.endSession();
  }
}

function isUniqueIndexViolation(error: unknown, keys: string[]): boolean {
  if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
  const keyPattern = error.keyPattern;
  return keyPattern !== undefined && keys.every((key) => keyPattern[key] === 1);
}

async function lockRole(
  storage: RoleBasedAccessingStorage,
  role: string,
  session: ClientSession,
): Promise<RoleDocument | null> {
  return storage.roles.findOneAndUpdate(
    { _id: role },
    { $inc: { coordinationVersion: 1 } },
    { session, returnDocument: "after" },
  );
}

export class RoleBasedAccessingConcept {
  private readonly storage: RoleBasedAccessingStorage;

  constructor(database: Db = db, client: MongoClient = mongoClient) {
    this.storage = {
      db: database,
      mongoClient: client,
      roles: database.collection<RoleDocument>("roleBasedAccessing_roles"),
      assignments: database.collection<AssignmentDocument>("roleBasedAccessing_assignments"),
    };
  }

  async createRole({ name }: { name: string }): Promise<{ role: string }> {
    await ensureStorage(this.storage);
    const role = crypto.randomUUID();
    try {
      await this.storage.roles.insertOne({
        _id: role,
        name,
        permissions: [],
        coordinationVersion: 0,
      });
    } catch (error) {
      if (isUniqueIndexViolation(error, ["name"])) {
        throw new RoleNameAlreadyExists("A Role already has that name.");
      }
      throw error;
    }
    return { role };
  }

  async deleteRole({ role }: { role: string }): Promise<Record<string, never>> {
    return inTransaction(this.storage, async (session) => {
      const lockedRole = await lockRole(this.storage, role, session);
      if (lockedRole === null) throw new RoleNotFound("There is no such Role.");

      const assignment = await this.storage.assignments.findOne({ role }, { session });
      if (assignment !== null) {
        throw new RoleInUse("The Role is assigned and cannot be deleted.");
      }

      const result = await this.storage.roles.deleteOne({ _id: role }, { session });
      if (result.deletedCount !== 1) {
        throw new RoleBasedAccessingIntegrityError(`Role ${role} changed during deletion.`);
      }
      return {};
    });
  }

  async permit({
    role,
    permission,
  }: {
    role: string;
    permission: string;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.roles.updateOne(
      { _id: role, permissions: { $ne: permission } },
      { $addToSet: { permissions: permission }, $inc: { coordinationVersion: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const found = await this.storage.roles.findOne({ _id: role }, { projection: { _id: 1 } });
    if (found === null) throw new RoleNotFound("There is no such Role.");
    throw new PermissionAlreadyGranted("The Role already has that Permission.");
  }

  async revokePermission({
    role,
    permission,
  }: {
    role: string;
    permission: string;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.roles.updateOne(
      { _id: role, permissions: permission },
      [
        {
          $set: {
            permissions: {
              $filter: {
                input: "$permissions",
                as: "existingPermission",
                cond: { $ne: ["$$existingPermission", permission] },
              },
            },
            coordinationVersion: { $add: ["$coordinationVersion", 1] },
          },
        },
      ],
    );
    if (result.matchedCount === 1) return {};

    const found = await this.storage.roles.findOne({ _id: role }, { projection: { _id: 1 } });
    if (found === null) throw new RoleNotFound("There is no such Role.");
    throw new PermissionNotGranted("The Role does not have that Permission.");
  }

  async assign({
    user,
    resource,
    role,
  }: {
    user: string;
    resource: string;
    role: string;
  }): Promise<{ assignment: string }> {
    const assignment = crypto.randomUUID();
    try {
      return await inTransaction(this.storage, async (session) => {
        const lockedRole = await lockRole(this.storage, role, session);
        if (lockedRole === null) throw new RoleNotFound("There is no such Role.");

        const existing = await this.storage.assignments.findOne(
          { user, resource, role },
          { session, projection: { _id: 1 } },
        );
        if (existing !== null) {
          throw new AssignmentAlreadyExists(
            "That Role is already assigned to the User for the Resource.",
          );
        }

        await this.storage.assignments.insertOne(
          { _id: assignment, user, resource, role },
          { session },
        );
        return { assignment };
      });
    } catch (error) {
      if (isUniqueIndexViolation(error, ["user", "resource", "role"])) {
        throw new AssignmentAlreadyExists(
          "That Role is already assigned to the User for the Resource.",
        );
      }
      throw error;
    }
  }

  async unassign({ assignment }: { assignment: string }): Promise<Record<string, never>> {
    return inTransaction(this.storage, async (session) => {
      const found = await this.storage.assignments.findOne({ _id: assignment }, { session });
      if (found === null) throw new AssignmentNotFound("There is no such Assignment.");

      const lockedRole = await lockRole(this.storage, found.role, session);
      if (lockedRole === null) {
        throw new RoleBasedAccessingIntegrityError(
          `Assignment ${assignment} refers to missing Role ${found.role}.`,
        );
      }

      const result = await this.storage.assignments.deleteOne(
        { _id: assignment, role: found.role },
        { session },
      );
      if (result.deletedCount !== 1) {
        throw new RoleBasedAccessingIntegrityError(
          `Assignment ${assignment} changed during removal.`,
        );
      }
      return {};
    });
  }

  async authorize<Command>({
    user,
    resource,
    permission,
    command,
  }: {
    user: string;
    resource: string;
    permission: string;
    command: Command;
  }): Promise<{ authorized: Command }> {
    return inTransaction(this.storage, async (session) => {
      const assignments = await this.storage.assignments
        .find({ user, resource }, { session })
        .sort({ _id: 1 })
        .toArray();

      for (const assignment of assignments) {
        const role = await lockRole(this.storage, assignment.role, session);
        if (role === null) {
          throw new RoleBasedAccessingIntegrityError(
            `Assignment ${assignment._id} refers to missing Role ${assignment.role}.`,
          );
        }
        if (!role.permissions.includes(permission)) continue;

        const stillAssigned = await this.storage.assignments.findOne(
          {
            _id: assignment._id,
            user,
            resource,
            role: assignment.role,
          },
          { session, projection: { _id: 1 } },
        );
        if (stillAssigned !== null) return { authorized: command };
      }

      throw new NotAuthorized(
        "The User does not have the required Permission for the Resource.",
      );
    });
  }

  async _roles(): Promise<{ role: string; name: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.roles.find({}).sort({ name: 1, _id: 1 }).toArray();
    return found.map(({ _id, name }) => ({ role: _id, name }));
  }

  async _getRole({ role }: { role: string }): Promise<{ name: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.roles.findOne({ _id: role });
    return found === null ? [] : [{ name: found.name }];
  }

  async _permissions({ role }: { role: string }): Promise<{ permission: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.roles.findOne(
      { _id: role },
      { projection: { permissions: 1 } },
    );
    return found === null
      ? []
      : found.permissions.toSorted().map((permission) => ({ permission }));
  }

  async _assignmentsFor({
    user,
    resource,
  }: {
    user: string;
    resource: string;
  }): Promise<{ assignment: string; role: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.assignments
      .find({ user, resource })
      .sort({ _id: 1 })
      .toArray();
    return found.map(({ _id, role }) => ({ assignment: _id, role }));
  }

  async _getAssignment({
    assignment,
  }: {
    assignment: string;
  }): Promise<{ user: string; resource: string; role: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.assignments.findOne({ _id: assignment });
    return found === null
      ? []
      : [{ user: found.user, resource: found.resource, role: found.role }];
  }
}
