import { describe, expect, test } from "bun:test";
import { validateDeploymentHostConfig, validateHostConfig } from "../../src/host/config.ts";

const configuredIdentities = {
  CLUB_WORKSPACE_ID: "relay-club-workspace-v1",
  OFFICER_USER_ID: "officer-user-001",
};

function randomCredential(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

function validEnvironment(): Record<string, string> {
  return {
    ...configuredIdentities,
    LOCAL_ACCESS_CREDENTIAL: randomCredential(),
    MONGODB_URL: "mongodb://127.0.0.1:27018/relay?replicaSet=rs0",
  };
}

describe("host configuration validation", () => {
  test("returns a typed, immutable configuration from explicit input", () => {
    const environment = validEnvironment();
    const config = validateHostConfig(environment);

    expect(config).toEqual({
      clubWorkspaceId: configuredIdentities.CLUB_WORKSPACE_ID,
      officerUserId: configuredIdentities.OFFICER_USER_ID,
      localAccessCredential: environment.LOCAL_ACCESS_CREDENTIAL,
      mongodbUrl: environment.MONGODB_URL,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  test.each([
    ["CLUB_WORKSPACE_ID"],
    ["OFFICER_USER_ID"],
    ["LOCAL_ACCESS_CREDENTIAL"],
    ["MONGODB_URL"],
  ])("rejects missing %s", (name: string) => {
    const environment = validEnvironment();
    delete environment[name];

    expect(() => validateHostConfig(environment)).toThrow(`${name} is required`);
  });

  test.each([
    ["CLUB_WORKSPACE_ID"],
    ["OFFICER_USER_ID"],
    ["LOCAL_ACCESS_CREDENTIAL"],
    ["MONGODB_URL"],
  ])("rejects blank %s", (name: string) => {
    const environment = validEnvironment();
    environment[name] = "   ";

    expect(() => validateHostConfig(environment)).toThrow(`${name} is required`);
  });

  test.each([
    ["CLUB_WORKSPACE_ID", "replace-me"],
    ["OFFICER_USER_ID", "user with spaces"],
    ["OFFICER_USER_ID", "../officer"],
  ])("rejects malformed or placeholder %s", (name: string, value: string) => {
    const environment = validEnvironment();
    environment[name] = value;

    expect(() => validateHostConfig(environment)).toThrow(`${name} must be a stable`);
  });

  test.each([
    "replace-with-a-random-token",
    "A".repeat(43),
    "too-short",
  ])("rejects placeholder or weak access credentials", (credential) => {
    const environment = validEnvironment();
    environment.LOCAL_ACCESS_CREDENTIAL = credential;

    expect(() => validateHostConfig(environment)).toThrow(
      "LOCAL_ACCESS_CREDENTIAL must be a 43-character base64url token",
    );
  });

  test("does not include a rejected access credential in validation errors", () => {
    const environment = validEnvironment();
    const secret = "A".repeat(43);
    environment.LOCAL_ACCESS_CREDENTIAL = secret;
    let thrown: unknown;

    try {
      validateHostConfig(environment);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    if (!(thrown instanceof Error)) return;
    expect(thrown.message).not.toContain(secret);
  });

  test.each([
    "not-a-uri",
    "https://localhost/relay",
    "mongodb://127.0.0.1/",
    "mongodb://127.0.0.1/invalid$name",
    "mongodb+srv://cluster.example/relay:27017",
  ])("rejects malformed MongoDB connection configuration", (mongodbUrl) => {
    const environment = validEnvironment();
    environment.MONGODB_URL = mongodbUrl;

    expect(() => validateHostConfig(environment)).toThrow(
      "MONGODB_URL must be a valid MongoDB connection URI",
    );
  });

  test("reuses configured identities deterministically and ignores process.env", () => {
    const environment = validEnvironment();

    const first = validateHostConfig(environment);
    const second = validateHostConfig(environment);

    expect(first.clubWorkspaceId).toBe(configuredIdentities.CLUB_WORKSPACE_ID);
    expect(second.clubWorkspaceId).toBe(first.clubWorkspaceId);
    expect(second.officerUserId).toBe(first.officerUserId);
  });
});

describe("deployment host configuration", () => {
  test("accepts an exact origin and derives secure cookie policy", () => {
    expect(validateDeploymentHostConfig({ MONGODB_URL: "mongodb://localhost/relay", PUBLIC_ORIGIN: "https://relay.example" })).toEqual({
      mongodbUrl: "mongodb://localhost/relay",
      appOrigin: "https://relay.example",
      secureCookies: true,
    });
    expect(validateDeploymentHostConfig({ MONGODB_URL: "mongodb://localhost/relay", PUBLIC_ORIGIN: "http://127.0.0.1:5173" }).secureCookies).toBe(false);
  });

  test("requires the platform public origin", () => {
    expect(() => validateDeploymentHostConfig({ MONGODB_URL: "mongodb://localhost/relay" })).toThrow("PUBLIC_ORIGIN is required");
  });

  test.each(["relay.example", "https://relay.example/path", "ftp://relay.example"])("rejects invalid deployment origin %s", (PUBLIC_ORIGIN) => {
    expect(() => validateDeploymentHostConfig({ MONGODB_URL: "mongodb://localhost/relay", PUBLIC_ORIGIN })).toThrow("PUBLIC_ORIGIN");
  });
});
