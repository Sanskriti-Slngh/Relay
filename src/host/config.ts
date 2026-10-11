export interface HostConfig {
  readonly clubWorkspaceId: string;
  readonly officerUserId: string;
  readonly localAccessCredential: string;
  readonly mongodbUrl: string;
}

type HostEnvironment = Readonly<Record<string, string | undefined>>;

const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const credentialPattern = /^[A-Za-z0-9_-]{43}$/;
const placeholderPattern = /placeholder|replace.?me|change.?me|your.?|example|dummy|sample|todo/i;

function requiredValue(environment: HostEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required and must not be blank.`);
  }
  return value;
}

function validateIdentity(value: string, name: string): string {
  if (!identityPattern.test(value) || placeholderPattern.test(value)) {
    throw new Error(
      `${name} must be a stable, non-placeholder identity using letters, numbers, ".", "_", ":" or "-".`,
    );
  }
  return value;
}

function validateMongoUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("MONGODB_URL must be a valid MongoDB connection URI with an explicit database name.");
  }

  const databasePath = parsed.pathname.slice(1);
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(databasePath);
  } catch {
    throw new Error("MONGODB_URL must be a valid MongoDB connection URI with an explicit database name.");
  }

  if (
    (parsed.protocol !== "mongodb:" && parsed.protocol !== "mongodb+srv:") ||
    !parsed.hostname ||
    !databaseName ||
    databaseName.includes("/") ||
    /[.$"*/<>:|?\\\u0000]/.test(databaseName) ||
    (parsed.protocol === "mongodb+srv:" && parsed.port !== "") ||
    parsed.hash
  ) {
    throw new Error("MONGODB_URL must be a valid MongoDB connection URI with an explicit database name.");
  }
  return value;
}

function validateCredential(value: string): string {
  if (
    !credentialPattern.test(value) ||
    new Set(value).size < 16 ||
    placeholderPattern.test(value)
  ) {
    throw new Error(
      "LOCAL_ACCESS_CREDENTIAL must be a 43-character base64url token generated from at least 32 random bytes.",
    );
  }
  return value;
}

/** Validates server-owned configuration without reading process.env or changing state. */
export function validateHostConfig(environment: HostEnvironment): HostConfig {
  const config = {
    clubWorkspaceId: validateIdentity(
      requiredValue(environment, "CLUB_WORKSPACE_ID"),
      "CLUB_WORKSPACE_ID",
    ),
    officerUserId: validateIdentity(requiredValue(environment, "OFFICER_USER_ID"), "OFFICER_USER_ID"),
    localAccessCredential: validateCredential(
      requiredValue(environment, "LOCAL_ACCESS_CREDENTIAL"),
    ),
    mongodbUrl: validateMongoUrl(requiredValue(environment, "MONGODB_URL")),
  } satisfies HostConfig;

  return Object.freeze(config);
}
