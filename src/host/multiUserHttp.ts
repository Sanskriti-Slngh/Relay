import { timingSafeEqual } from "node:crypto";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import type { DeploymentHostConfig } from "./config.ts";
import {
  AccountConflict,
  AccountInputError,
  AccountStore,
  InvalidCredentials,
  InvitationUnavailable,
  NotAuthorized,
  WorkspaceUnavailable,
  type AuthenticatedSession,
} from "./accounts.ts";

const COOKIE = "relay_session";
const MAX_REQUEST_BYTES = 65_536;
const SESSION_SECONDS = 8 * 60 * 60;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(status: number, value: Record<string, unknown>, headers?: HeadersInit): Response {
  const resultHeaders = new Headers(JSON_HEADERS);
  new Headers(headers).forEach((value, key) => resultHeaders.set(key, value));
  return new Response(JSON.stringify(value), { status, headers: resultHeaders });
}
const errorResponse = (status: number, error: string) => response(status, { error });

async function bodyOf(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return errorResponse(415, "INVALID_INPUT");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_REQUEST_BYTES) return errorResponse(413, "INVALID_INPUT");
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) return errorResponse(413, "INVALID_INPUT");
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : errorResponse(400, "INVALID_INPUT");
  } catch { return errorResponse(400, "INVALID_INPUT"); }
}

function tokenOf(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function equalSecret(expected: string, supplied: string | null): boolean {
  if (supplied === null) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  if (a.length !== b.length) { timingSafeEqual(a, a); return false; }
  return timingSafeEqual(a, b);
}

function cookie(token: string, secure: boolean, maxAge = SESSION_SECONDS): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function strings(body: Record<string, unknown>, names: string[]): string[] | null {
  const result = names.map((name) => body[name]);
  return result.every((value) => typeof value === "string") ? result as string[] : null;
}

function inject(request: Request, body: Record<string, unknown>, session: AuthenticatedSession): Request {
  const headers = new Headers(request.headers);
  for (const name of ["authorization", "cookie", "content-length", "x-relay-csrf"]) headers.delete(name);
  headers.set("content-type", "application/json");
  return new Request(request.url, { method: request.method, headers, body: JSON.stringify({ ...body, user: session.user, workspace: session.workspace }), signal: request.signal });
}

export function createMultiUserRelayHttpHandler(
  application: Parameters<typeof createHttpHandler>[0]["application"],
  accounts: AccountStore,
  config: DeploymentHostConfig,
  roles: { officerRole: string; memberRole: string },
) {
  const gateway = createGateway({ application });
  const conceptHandler = createHttpHandler({
    application,
    gateway,
    policy: httpPolicy({
      basePath: "/api",
      limits: { requestBodyBytes: MAX_REQUEST_BYTES },
      publicErrors: {
        NOT_AUTHORIZED: "FORBIDDEN", PROCEDURE_NOT_AVAILABLE: "NOT_FOUND", CONTEXT_OR_PROCEDURE_NOT_AVAILABLE: "NOT_FOUND",
        CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE: "NOT_FOUND", CONTEXT_NOT_AVAILABLE: "NOT_FOUND", REVIEW_NOT_AVAILABLE: "NOT_FOUND",
        STEP_NOT_AVAILABLE: "NOT_FOUND", QUESTION_SUBJECT_NOT_AVAILABLE: "NOT_FOUND", QUESTION_NOT_AVAILABLE: "NOT_FOUND",
        PROCEDURE_NOT_FOUND: "NOT_FOUND", PROCEDURE_NOT_ACTIVE: "CONFLICT", STEP_NOT_FOUND: "NOT_FOUND", STEP_NOT_ACTIVE: "CONFLICT",
        CONTEXT_NOT_FOUND: "NOT_FOUND", ATTACHMENT_ALREADY_EXISTS: "CONFLICT", CHANGE_NOT_DIFFERENT: "INVALID_REQUEST",
        CONFIRM_REVIEW_NOT_FOUND: "NOT_FOUND", REVIEW_NOT_PENDING_FOR_CONFIRMATION: "CONFLICT", REVIEW_NOT_PENDING_FOR_CHANGES: "CONFLICT",
        REVIEW_NOT_AWAITING_CHANGES: "CONFLICT", CANCEL_REVIEW_FINISHED: "CONFLICT", REQUIRE_CHANGES_REVIEW_NOT_FOUND: "NOT_FOUND",
        RESOLVE_REVIEW_NOT_FOUND: "NOT_FOUND", CANCEL_REVIEW_NOT_FOUND: "NOT_FOUND", QUESTION_NOT_FOUND: "NOT_FOUND",
        QUESTION_NOT_OPEN: "CONFLICT", QUESTION_ANSWER_NOT_EDITABLE: "FORBIDDEN", INVALID_POSITION: "INVALID_REQUEST",
      },
    }),
  });

  async function authenticate(request: Request): Promise<AuthenticatedSession | null> {
    const token = tokenOf(request);
    return token ? accounts.authenticate(token) : null;
  }

  async function sessionPayload(session: AuthenticatedSession) {
    const workspaces = await accounts.memberships(session.user);
    const selected = workspaces.find(({ workspace }) => workspace === session.workspace);
    return {
      authenticated: true,
      csrfToken: session.csrfToken,
      user: { id: session.user, email: session.email, name: session.name },
      workspace: selected?.workspace,
      workspaceName: selected?.name,
      role: selected?.role,
      permissions: selected?.permissions ?? [],
      workspaces,
    };
  }

  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== config.appOrigin) return errorResponse(403, "ORIGIN_REJECTED");

    if (pathname === "/session" && request.method === "GET") {
      const session = await authenticate(request);
      return session ? response(200, await sessionPayload(session)) : response(200, { authenticated: false });
    }

    if ((pathname === "/auth/register" || pathname === "/auth/login") && request.method === "POST") {
      if (origin !== config.appOrigin) return errorResponse(403, "ORIGIN_REJECTED");
      const body = await bodyOf(request); if (body instanceof Response) return body;
      const values = pathname.endsWith("register") ? strings(body, ["email", "password", "name"]) : strings(body, ["email", "password"]);
      if (!values) return errorResponse(400, "INVALID_INPUT");
      try {
        const { user } = pathname.endsWith("register") ? await accounts.register(values[0], values[1], values[2]) : await accounts.verify(values[0], values[1]);
        const { token, session } = await accounts.createSession(user);
        return response(200, await sessionPayload(session), { "Set-Cookie": cookie(token, config.secureCookies) });
      } catch (error) {
        if (error instanceof InvalidCredentials) return errorResponse(401, "INVALID_CREDENTIALS");
        if (error instanceof AccountConflict) return errorResponse(409, "ACCOUNT_EXISTS");
        if (error instanceof AccountInputError) return errorResponse(400, "INVALID_INPUT");
        throw error;
      }
    }

    const session = await authenticate(request);
    if (!session) return errorResponse(401, "UNAUTHORIZED");
    if (request.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
    if (origin !== config.appOrigin) return errorResponse(403, "ORIGIN_REJECTED");
    if (!equalSecret(session.csrfToken, request.headers.get("x-relay-csrf"))) return errorResponse(403, "CSRF_REJECTED");

    if (pathname === "/session/logout") {
      if (request.body !== null) { await request.body.cancel(); return errorResponse(400, "INVALID_INPUT"); }
      await accounts.logout(session.idHash);
      return response(200, { authenticated: false }, { "Set-Cookie": cookie("", config.secureCookies, 0) });
    }

    const body = await bodyOf(request); if (body instanceof Response) return body;
    try {
      if (pathname === "/workspaces") return response(200, { workspaces: await accounts.memberships(session.user) });
      if (pathname === "/workspaces/create") {
        const values = strings(body, ["name"]); if (!values) return errorResponse(400, "INVALID_INPUT");
        const created = await accounts.createWorkspace(session.user, values[0], roles.officerRole);
        await accounts.selectWorkspace(session, created.workspace);
        const refreshed = await accounts.authenticate(tokenOf(request)!);
        return response(200, { ...created, ...(refreshed ? await sessionPayload(refreshed) : {}) });
      }
      if (pathname === "/workspaces/select") {
        const values = strings(body, ["workspace"]); if (!values) return errorResponse(400, "INVALID_INPUT");
        await accounts.selectWorkspace(session, values[0]);
        const refreshed = await accounts.authenticate(tokenOf(request)!);
        return response(200, refreshed ? await sessionPayload(refreshed) : { authenticated: false });
      }
      if (pathname === "/invitations/create") {
        if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
        const values = strings(body, ["email"]); if (!values) return errorResponse(400, "INVALID_INPUT");
        const invite = await accounts.createInvitation(session.user, session.workspace, values[0]);
        return response(200, { token: invite.token, expiresAt: invite.expiresAt.toISOString() });
      }
      if (pathname === "/invitations/accept") {
        const values = strings(body, ["token"]); if (!values) return errorResponse(400, "INVALID_INPUT");
        const accepted = await accounts.acceptInvitation(session.user, values[0], roles.memberRole);
        await accounts.selectWorkspace(session, accepted.workspace);
        const refreshed = await accounts.authenticate(tokenOf(request)!);
        return response(200, refreshed ? await sessionPayload(refreshed) : { authenticated: false });
      }
      if (!pathname.startsWith("/api/")) return errorResponse(404, "NOT_FOUND");
      if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
      const membership = (await accounts.memberships(session.user)).some(({ workspace }) => workspace === session.workspace);
      if (!membership) return errorResponse(403, "FORBIDDEN");
      const result = await conceptHandler(inject(request, body, session));
      if (result.ok && (pathname === "/api/workspaces/context/change" || pathname === "/api/workspaces/procedures/steps/remove")) await application.whenIdle();
      return result;
    } catch (error) {
      if (error instanceof WorkspaceUnavailable || error instanceof InvitationUnavailable) return errorResponse(404, error instanceof InvitationUnavailable ? "INVITATION_NOT_AVAILABLE" : "WORKSPACE_NOT_AVAILABLE");
      if (error instanceof NotAuthorized) return errorResponse(403, "FORBIDDEN");
      if (error instanceof AccountInputError) return errorResponse(400, "INVALID_INPUT");
      throw error;
    }
  };
}
