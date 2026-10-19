import type { Collection, Db, Document, Filter, MongoClient } from "mongodb";
import { connectToDatabase, db, mongoClient } from "../db.ts";
import { runAtomically, type OptionalMongoSession } from "../mongoAtomic.ts";

type ProcedureStatus = "ACTIVE" | "RETIRED";
type StepStatus = "ACTIVE" | "REMOVED";

type ProcedureDocument = Document & {
  _id: string;
  space: string;
  title: string;
  status: ProcedureStatus;
  stepRevision: number;
  version: number;
};

type StepDocument = Document & {
  _id: string;
  procedure: string;
  text: string;
  position?: number;
  status: StepStatus;
  version: number;
};

type ProcedureStorage = {
  db: Db;
  mongoClient: MongoClient;
  procedures: Collection<ProcedureDocument>;
  steps: Collection<StepDocument>;
  indexesReady?: Promise<void>;
};

export class ProcedureNotFound extends Error {}
export class ProcedureNotActive extends Error {}
export class StepNotFound extends Error {}
export class StepNotActive extends Error {}
export class InvalidPosition extends Error {}
export class VersionConflict extends Error {}

export class StepOrderIntegrityError extends Error {}

async function ensureStorage(storage: ProcedureStorage): Promise<void> {
  if (storage.db === db && storage.mongoClient === mongoClient) {
    await connectToDatabase();
  } else {
    await storage.mongoClient.connect();
    await storage.db.command({ ping: 1 });
  }
  storage.indexesReady ??= Promise.all([
    storage.procedures.updateMany({ version: { $exists: false } }, { $set: { version: 1 } }),
    storage.steps.updateMany({ version: { $exists: false } }, { $set: { version: 1 } }),
    storage.steps.createIndex(
      { procedure: 1, position: 1 },
      {
        name: "procedure_active_position_unique",
        unique: true,
        partialFilterExpression: { status: "ACTIVE", position: { $exists: true } },
      },
    ),
    storage.steps.createIndex(
      { procedure: 1, status: 1, position: 1 },
      { name: "procedure_status_position" },
    ),
    storage.procedures.createIndex(
      { space: 1, title: 1, _id: 1 },
      { name: "space_title_identity" },
    ),
  ]).then(() => undefined);
  await storage.indexesReady;
}

async function inTransaction<T>(
  storage: ProcedureStorage,
  work: (session: OptionalMongoSession) => Promise<T>,
): Promise<T> {
  await ensureStorage(storage);
  return runAtomically(storage.db, storage.mongoClient, work);
}

async function requireActiveProcedure(
  storage: ProcedureStorage,
  procedure: string,
  session: OptionalMongoSession,
  expectedVersion?: number,
): Promise<void> {
  const result = await storage.procedures.updateOne(
    { _id: procedure, status: "ACTIVE", ...(!expectedVersion ? {} : { version: expectedVersion }) },
    { $inc: { stepRevision: 1, version: 1 } },
    { session },
  );
  if (result.matchedCount === 1) return;

  const found = await storage.procedures.findOne(
    { _id: procedure },
    { session, projection: { _id: 1, status: 1, version: 1 } },
  );
  if (found === null) throw new ProcedureNotFound("There is no such Procedure.");
  if (found.status !== "ACTIVE") throw new ProcedureNotActive("The Procedure is retired.");
  throw new VersionConflict("The Procedure changed after it was loaded.");
}

async function ensureActiveProcedure(
  storage: ProcedureStorage,
  procedure: string,
  session: OptionalMongoSession,
): Promise<void> {
  const found = await storage.procedures.findOne({ _id: procedure }, { session, projection: { status: 1 } });
  if (found === null) throw new ProcedureNotFound("There is no such Procedure.");
  if (found.status !== "ACTIVE") throw new ProcedureNotActive("The Procedure is retired.");
}

async function requireActiveStepsAreContiguous(
  storage: ProcedureStorage,
  procedure: string,
  session: OptionalMongoSession,
): Promise<StepDocument[]> {
  const activeSteps = await storage.steps
    .find({ procedure, status: "ACTIVE" }, { session })
    .sort({ position: 1, _id: 1 })
    .toArray();

  for (let index = 0; index < activeSteps.length; index += 1) {
    if (activeSteps[index].position !== index + 1) {
      throw new StepOrderIntegrityError(
        `Active Steps for Procedure ${procedure} are not ordered contiguously.`,
      );
    }
  }
  return activeSteps;
}

async function moveAllToTemporaryPositions(
  storage: ProcedureStorage,
  activeSteps: StepDocument[],
  offset: number,
  session: OptionalMongoSession,
): Promise<void> {
  if (activeSteps.length === 0) return;
  const positionedSteps = activeSteps.map((step) => {
    if (step.position === undefined) {
      throw new StepOrderIntegrityError(`Active Step ${step._id} has no position.`);
    }
    return { step, position: step.position };
  });
  const result = await storage.steps.bulkWrite(
    positionedSteps.map(({ step, position }) => ({
      updateOne: {
        filter: { _id: step._id, status: "ACTIVE" },
        update: { $set: { position: offset + position } },
      },
    })),
    { session },
  );
  if (result.matchedCount !== activeSteps.length) {
    throw new StepOrderIntegrityError("Not every active Step received a temporary position.");
  }
}

async function setPositions(
  storage: ProcedureStorage,
  activeSteps: StepDocument[],
  session: OptionalMongoSession,
): Promise<void> {
  if (activeSteps.length === 0) return;
  const result = await storage.steps.bulkWrite(
    activeSteps.map((step, index) => ({
      updateOne: {
        filter: { _id: step._id, status: "ACTIVE" },
        update: { $set: { position: index + 1 } },
      },
    })),
    { session },
  );
  if (result.matchedCount !== activeSteps.length) {
    throw new StepOrderIntegrityError("Not every active Step received its new position.");
  }
}

function stepFilter(step: string): Filter<StepDocument> {
  return { _id: step };
}

function activeStepFilter(step: string): Filter<StepDocument> {
  return { _id: step, status: "ACTIVE" };
}

export class ProcedureMaintainingConcept {
  private readonly storage: ProcedureStorage;

  constructor(database: Db = db, client: MongoClient = mongoClient) {
    this.storage = {
      db: database,
      mongoClient: client,
      procedures: database.collection<ProcedureDocument>("procedureMaintaining_procedures"),
      steps: database.collection<StepDocument>("procedureMaintaining_steps"),
    };
  }

  async create({
    space,
    title,
  }: {
    space: string;
    title: string;
  }): Promise<{ procedure: string }> {
    await ensureStorage(this.storage);
    const procedure = crypto.randomUUID();
    await this.storage.procedures.insertOne({
      _id: procedure,
      space,
      title,
      status: "ACTIVE",
      stepRevision: 0,
      version: 1,
    });
    return { procedure };
  }

  async addStep({
    procedure,
    text,
    expectedVersion,
  }: {
    procedure: string;
    text: string;
    expectedVersion?: number;
  }): Promise<{ step: string }> {
    const step = crypto.randomUUID();
    await inTransaction(this.storage, async (session) => {
      await requireActiveProcedure(this.storage, procedure, session, expectedVersion);
      const activeSteps = await requireActiveStepsAreContiguous(this.storage, procedure, session);
      await this.storage.steps.insertOne(
        {
          _id: step,
          procedure,
          text,
          position: activeSteps.length + 1,
          status: "ACTIVE",
          version: 1,
        },
        { session },
      );
    });
    return { step };
  }

  async editStep({ step, text, expectedVersion }: { step: string; text: string; expectedVersion?: number }) {
    return inTransaction(this.storage, async (session) => {
      const found = await this.storage.steps.findOne(stepFilter(step), { session });
      if (found === null) throw new StepNotFound("There is no such Step.");
      if (found.status === "REMOVED") throw new StepNotActive("The Step has been removed.");

      await ensureActiveProcedure(this.storage, found.procedure, session);
      const result = await this.storage.steps.updateOne(
        { ...activeStepFilter(step), ...(!expectedVersion ? {} : { version: expectedVersion }) },
        { $set: { text }, $inc: { version: 1 } },
        { session },
      );
      if (result.matchedCount !== 1) {
        throw new VersionConflict(`Step ${step} changed during its edit.`);
      }
      return {};
    });
  }

  async moveStep({
    step,
    position,
    expectedVersion,
  }: {
    step: string;
    position: number;
    expectedVersion?: number;
  }) {
    return inTransaction(this.storage, async (session) => {
      const found = await this.storage.steps.findOne(stepFilter(step), { session });
      if (found === null) throw new StepNotFound("There is no such Step.");
      if (found.status === "REMOVED") throw new StepNotActive("The Step has been removed.");

      await ensureActiveProcedure(this.storage, found.procedure, session);
      const activeSteps = await requireActiveStepsAreContiguous(
        this.storage,
        found.procedure,
        session,
      );
      if (!Number.isInteger(position) || position < 1 || position > activeSteps.length) {
        throw new InvalidPosition("Position must be an integer within the active Step order.");
      }

      const movedSteps = [...activeSteps];
      const currentIndex = movedSteps.findIndex((entry) => entry._id === step);
      if (currentIndex === -1) {
        throw new StepOrderIntegrityError(`Active Step ${step} disappeared during reordering.`);
      }
      const [movedStep] = movedSteps.splice(currentIndex, 1);
      if (currentIndex === position - 1) return {};
      await requireActiveProcedure(this.storage, found.procedure, session, expectedVersion);
      movedSteps.splice(position - 1, 0, movedStep);

      await moveAllToTemporaryPositions(this.storage, activeSteps, activeSteps.length, session);
      await setPositions(this.storage, movedSteps, session);
      return {};
    });
  }

  async removeStep({ step, expectedVersion }: { step: string; expectedVersion?: number }) {
    return inTransaction(this.storage, async (session) => {
      const found = await this.storage.steps.findOne(stepFilter(step), { session });
      if (found === null) throw new StepNotFound("There is no such Step.");
      if (found.status === "REMOVED") throw new StepNotActive("The Step has been removed.");

      await requireActiveProcedure(this.storage, found.procedure, session, expectedVersion);
      const activeSteps = await requireActiveStepsAreContiguous(
        this.storage,
        found.procedure,
        session,
      );

      const result = await this.storage.steps.updateOne(
        activeStepFilter(step),
        { $set: { status: "REMOVED" }, $unset: { position: "" } },
        { session },
      );
      if (result.matchedCount !== 1) {
        throw new StepOrderIntegrityError(`Active Step ${step} changed during its removal.`);
      }

      const remainingSteps = activeSteps.filter((entry) => entry._id !== step);
      await moveAllToTemporaryPositions(this.storage, remainingSteps, activeSteps.length, session);
      await setPositions(this.storage, remainingSteps, session);
      return {};
    });
  }

  async rename({
    procedure,
    title,
    expectedVersion,
  }: {
    procedure: string;
    title: string;
    expectedVersion?: number;
  }) {
    return inTransaction(this.storage, async (session) => {
      const result = await this.storage.procedures.updateOne(
        { _id: procedure, status: "ACTIVE", ...(!expectedVersion ? {} : { version: expectedVersion }) },
        { $set: { title }, $inc: { version: 1 } },
        { session },
      );
      if (result.matchedCount === 1) return {};

      const found = await this.storage.procedures.findOne(
        { _id: procedure },
        { session, projection: { _id: 1, status: 1, version: 1 } },
      );
      if (found === null) throw new ProcedureNotFound("There is no such Procedure.");
      if (found.status !== "ACTIVE") throw new ProcedureNotActive("The Procedure is retired.");
      throw new VersionConflict("The Procedure changed after it was loaded.");
    });
  }

  async retire({ procedure, expectedVersion }: { procedure: string; expectedVersion?: number }) {
    return inTransaction(this.storage, async (session) => {
      const result = await this.storage.procedures.updateOne(
        { _id: procedure, status: "ACTIVE", ...(!expectedVersion ? {} : { version: expectedVersion }) },
        { $set: { status: "RETIRED" }, $inc: { version: 1 } },
        { session },
      );
      if (result.matchedCount === 1) return {};

      const found = await this.storage.procedures.findOne(
        { _id: procedure },
        { session, projection: { _id: 1, status: 1, version: 1 } },
      );
      if (found === null) throw new ProcedureNotFound("There is no such Procedure.");
      if (found.status !== "ACTIVE") throw new ProcedureNotActive("The Procedure is already retired.");
      throw new VersionConflict("The Procedure changed after it was loaded.");
    });
  }

  async _procedures({
    space,
  }: {
    space: string;
  }): Promise<{ procedure: string; title: string; status: ProcedureStatus }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.procedures
      .find({ space })
      .sort({ title: 1, _id: 1 })
      .toArray();
    return found.map(({ _id, title, status }) => ({ procedure: _id, title, status }));
  }

  async _get({
    procedure,
  }: {
    procedure: string;
  }): Promise<{ space: string; title: string; status: ProcedureStatus }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.procedures.findOne({ _id: procedure });
    return found === null
      ? []
      : [{ space: found.space, title: found.title, status: found.status }];
  }

  async _steps({
    procedure,
  }: {
    procedure: string;
  }): Promise<{ step: string; text: string; position: number }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.steps
      .find({ procedure, status: "ACTIVE" })
      .sort({ position: 1, _id: 1 })
      .toArray();
    return found.map(({ _id, text, position }, index) => {
      if (position !== index + 1) {
        throw new StepOrderIntegrityError(
          `Active Steps for Procedure ${procedure} are not ordered contiguously at Step ${_id}.`,
        );
      }
      return { step: _id, text, position };
    });
  }

  async _getStep({
    step,
  }: {
    step: string;
  }): Promise<{ procedure: string; text: string; status: StepStatus }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.steps.findOne(stepFilter(step));
    return found === null
      ? []
      : [{ procedure: found.procedure, text: found.text, status: found.status }];
  }

  async _getVersion({ procedure }: { procedure: string }): Promise<{ version: number }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.procedures.findOne({ _id: procedure }, { projection: { version: 1 } });
    return found === null ? [] : [{ version: found.version }];
  }

  async _getStepVersion({ step }: { step: string }): Promise<{ version: number }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.steps.findOne({ _id: step }, { projection: { version: 1 } });
    return found === null ? [] : [{ version: found.version }];
  }
}
