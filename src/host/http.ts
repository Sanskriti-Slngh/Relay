import { randomBytes, timingSafeEqual } from "node:crypto";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import type { HostConfig } from "./config.ts";

const MAX_REQUEST_BYTES = 65_536;
const SESSION_COOKIE = "relay_session";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1_000;
const MAX_SESSIONS = 64;
const FRONTEND_ORIGIN = "http://127.0.0.1:5173";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

interface BrowserSession {
  readonly csrfToken: string;
  readonly expiresAt: number;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonResponse(status: number, value: Record<string, unknown>, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(JSON_HEADERS);
  new Headers(headers).forEach((value, key) => responseHeaders.set(key, value));
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}

function jsonError(status: number, error: string): Response {
  return jsonResponse(status, { error });
}

function secretMatches(expected: string, supplied: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.byteLength !== suppliedBytes.byteLength) {
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }
  return timingSafeEqual(expectedBytes, suppliedBytes);
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonError(415, "INVALID_INPUT");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_REQUEST_BYTES) {
    return jsonError(413, "INVALID_INPUT");
  }

  if (request.body === null) return jsonError(400, "INVALID_INPUT");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return jsonError(413, "INVALID_INPUT");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return jsonError(400, "INVALID_INPUT");
  }
  return isJsonRecord(parsed) ? parsed : jsonError(400, "INVALID_INPUT");
}

function requestHasAllowedOrigin(request: Request, allowAbsent = false): boolean {
  const origin = request.headers.get("origin");
  return origin === FRONTEND_ORIGIN || (allowAbsent && origin === null);
}

function sessionIdFromCookie(request: Request): string | null {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const id = matches[0].slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
}

function csrfMatches(session: BrowserSession, supplied: string | null): boolean {
  return supplied !== null && secretMatches(session.csrfToken, supplied);
}

function pruneExpiredSessions(sessions: Map<string, BrowserSession>, now: number): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

function injectTrustedIdentity(
  request: Request,
  body: Record<string, unknown>,
  config: HostConfig,
): Request {
  const headers = new Headers(request.headers);
  for (const name of ["authorization", "cookie", "content-length", "x-relay-csrf"]) {
    headers.delete(name);
  }
  headers.set("content-type", "application/json");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify({
      ...body,
      user: config.officerUserId,
      workspace: config.clubWorkspaceId,
    }),
    signal: request.signal,
  });
}

export function createRelayHttpHandler(
  application: Parameters<typeof createHttpHandler>[0]["application"],
  config: HostConfig,
) {
  const sessions = new Map<string, BrowserSession>();
  const gateway = createGateway({ application });
  const policy = httpPolicy({
    basePath: "/api",
    limits: { requestBodyBytes: MAX_REQUEST_BYTES },
    publicErrors: {
      NOT_AUTHORIZED: "FORBIDDEN",
      PROCEDURE_NOT_AVAILABLE: "NOT_FOUND",
      CONTEXT_OR_PROCEDURE_NOT_AVAILABLE: "NOT_FOUND",
      CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE: "NOT_FOUND",
      CONTEXT_NOT_AVAILABLE: "NOT_FOUND",
      REVIEW_NOT_AVAILABLE: "NOT_FOUND",
      PROCEDURE_NOT_FOUND: "NOT_FOUND",
      PROCEDURE_NOT_ACTIVE: "CONFLICT",
      STEP_NOT_FOUND: "NOT_FOUND",
      STEP_NOT_ACTIVE: "CONFLICT",
      CONTEXT_NOT_FOUND: "NOT_FOUND",
      ATTACHMENT_ALREADY_EXISTS: "CONFLICT",
      CHANGE_NOT_DIFFERENT: "INVALID_REQUEST",
      CONFIRM_REVIEW_NOT_FOUND: "NOT_FOUND",
      REVIEW_NOT_PENDING_FOR_CONFIRMATION: "CONFLICT",
      INVALID_POSITION: "INVALID_REQUEST",
    },
  });
  const handler = createHttpHandler({ application, gateway, policy });

  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);

    if (pathname === "/session") {
      if (request.method === "GET") {
        if (!requestHasAllowedOrigin(request, true)) return jsonError(403, "ORIGIN_REJECTED");
        const id = sessionIdFromCookie(request);
        const session = id === null ? undefined : sessions.get(id);
        if (!session || session.expiresAt <= Date.now()) {
          if (id !== null) sessions.delete(id);
          return jsonResponse(200, { authenticated: false });
        }
        return jsonResponse(200, {
          authenticated: true,
          csrfToken: session.csrfToken,
          workspace: config.clubWorkspaceId,
        });
      }

      if (request.method !== "POST") {
        return jsonResponse(405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "GET, POST" });
      }
      if (!requestHasAllowedOrigin(request)) return jsonError(403, "ORIGIN_REJECTED");

      const body = await readJsonObject(request);
      if (body instanceof Response) return body;
      if (
        typeof body.credential !== "string" ||
        !secretMatches(config.localAccessCredential, body.credential)
      ) {
        return jsonError(401, "UNAUTHORIZED");
      }

      const now = Date.now();
      pruneExpiredSessions(sessions, now);
      if (sessions.size >= MAX_SESSIONS) return jsonError(503, "SESSION_CAPACITY");

      const id = randomBytes(32).toString("base64url");
      const csrfToken = randomBytes(32).toString("base64url");
      const expiresAt = now + SESSION_LIFETIME_MS;
      sessions.set(id, { csrfToken, expiresAt });
      const cookie = `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_LIFETIME_MS / 1_000}`;
      return jsonResponse(
        200,
        { authenticated: true, csrfToken, workspace: config.clubWorkspaceId },
        { "Set-Cookie": cookie },
      );
    }

    if (pathname === "/session/logout") {
      if (request.method !== "POST") {
        return jsonResponse(405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
      }
      if (!requestHasAllowedOrigin(request)) return jsonError(403, "ORIGIN_REJECTED");
      if (request.body !== null) {
        await request.body.cancel();
        return jsonError(400, "INVALID_INPUT");
      }
      const id = sessionIdFromCookie(request);
      const session = id === null ? undefined : sessions.get(id);
      if (id === null || !session || session.expiresAt <= Date.now()) return jsonError(401, "UNAUTHORIZED");
      if (!csrfMatches(session, request.headers.get("x-relay-csrf"))) {
        return jsonError(403, "CSRF_REJECTED");
      }
      sessions.delete(id);
      return jsonResponse(
        200,
        { authenticated: false },
        { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` },
      );
    }

    if (!pathname.startsWith("/api/")) return jsonError(404, "NOT_FOUND");
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
    }
    if (!requestHasAllowedOrigin(request)) return jsonError(403, "ORIGIN_REJECTED");

    const id = sessionIdFromCookie(request);
    const session = id === null ? undefined : sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      if (id !== null) sessions.delete(id);
      return jsonError(401, "UNAUTHORIZED");
    }
    if (!csrfMatches(session, request.headers.get("x-relay-csrf"))) {
      return jsonError(403, "CSRF_REJECTED");
    }

    const body = await readJsonObject(request);
    if (body instanceof Response) return body;
    const response = await handler(injectTrustedIdentity(request, body, config));
    if (pathname === "/api/workspaces/context/change" && response.ok) {
      await application.whenIdle();
    }
    return response;
  };
}
