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
  type ActivityEventType,
} from "./accounts.ts";

const COOKIE = "relay_session";
const MAX_REQUEST_BYTES = 65_536;
const SESSION_SECONDS = 8 * 60 * 60;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const ACTIVITY_PATHS = new Map<string, ActivityEventType>([
  ["/api/workspaces/procedures/create", "PLAYBOOK_CREATED"],
  ["/api/workspaces/procedures/rename", "PLAYBOOK_RENAMED"],
  ["/api/workspaces/procedures/archive", "PLAYBOOK_ARCHIVED"],
  ["/api/workspaces/procedures/steps/add", "STEP_ADDED"],
  ["/api/workspaces/procedures/steps/edit", "STEP_EDITED"],
  ["/api/workspaces/procedures/steps/remove", "STEP_REMOVED"],
  ["/api/workspaces/context/notes", "CONTEXT_CREATED"],
  ["/api/workspaces/context/attachments", "CONTEXT_ATTACHED"],
  ["/api/workspaces/context/step-attachments", "CONTEXT_ATTACHED"],
  ["/api/workspaces/context/change", "CONTEXT_CHANGED"],
  ["/api/workspaces/reviews/confirm", "REVIEW_CONFIRMED"],
  ["/api/workspaces/reviews/resolve", "REVIEW_RESOLVED"],
  ["/api/workspaces/questions/steps/answer", "QUESTION_ANSWERED"],
  ["/api/workspaces/questions/context/answer", "QUESTION_ANSWERED"],
]);

type ProcedureProjection = {
  procedure: string;
  title: string;
  steps: { step: string; position: number }[];
};
type ContextProjection = {
  context: string;
  attachments: { subject: string; anchor?: string }[];
};
type QuestionProjection = {
  stepQuestions: { question: string; step: string; procedure: string; title: string }[];
  contextQuestions: { question: string; context: string }[];
};

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

  async function projection<T>(request: Request, session: AuthenticatedSession, path: string): Promise<T | undefined> {
    const url = new URL(request.url);
    url.pathname = `/api${path}`;
    const projected = await conceptHandler(inject(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }), {}, session));
    if (!projected.ok) return undefined;
    return await projected.json() as T;
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
      if (pathname === "/workspaces/members") {
        if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
        return response(200, { members: await accounts.workspaceMembers(session.user, session.workspace) });
      }
      if (pathname === "/workspaces/activity") {
        if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
        const events = await accounts.recentActivity(session.user, session.workspace);
        return response(200, {
          events: events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
        });
      }
      if (pathname === "/invitations/pending") {
        if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
        const invitations = await accounts.pendingInvitations(session.user, session.workspace);
        return response(200, { invitations: invitations.map((invitation) => ({ ...invitation, expiresAt: invitation.expiresAt.toISOString() })) });
      }
      if (pathname === "/invitations/create") {
        if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
        const values = strings(body, ["email"]); if (!values) return errorResponse(400, "INVALID_INPUT");
        const invite = await accounts.createInvitation(session.user, session.workspace, values[0]);
        return response(200, { ...invite, expiresAt: invite.expiresAt.toISOString() });
      }
      if (pathname === "/invitations/reissue") {
        if (!session.workspace) return errorResponse(409, "WORKSPACE_REQUIRED");
        const values = strings(body, ["invitation"]); if (!values) return errorResponse(400, "INVALID_INPUT");
        const invite = await accounts.reissueInvitation(session.user, session.workspace, values[0]);
        return response(200, { ...invite, expiresAt: invite.expiresAt.toISOString() });
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
      const activityType = ACTIVITY_PATHS.get(pathname);
      const beforeProcedures = activityType && activityType !== "PLAYBOOK_CREATED" && activityType !== "CONTEXT_CREATED"
        ? (await projection<{ procedures: ProcedureProjection[] }>(request, session, "/workspaces/procedures"))?.procedures ?? []
        : [];
      const beforeContexts = activityType === "CONTEXT_CHANGED" || activityType === "QUESTION_ANSWERED"
        ? (await projection<{ contexts: ContextProjection[] }>(request, session, "/workspaces/context"))?.contexts ?? []
        : [];
      const beforeQuestions = activityType === "QUESTION_ANSWERED"
        ? await projection<QuestionProjection>(request, session, "/workspaces/questions")
        : undefined;
      const result = await conceptHandler(inject(request, body, session));
      if (result.ok && (pathname === "/api/workspaces/context/change" || pathname === "/api/workspaces/procedures/steps/remove")) await application.whenIdle();
      if (result.ok && activityType) {
        try {
          const output = await result.clone().json() as Record<string, unknown>;
          const procedureId = typeof output.procedure === "string"
            ? output.procedure
            : typeof body.procedure === "string" ? body.procedure : undefined;
          const needsAfterProcedures = activityType === "PLAYBOOK_CREATED" || activityType === "PLAYBOOK_RENAMED" || activityType === "STEP_ADDED";
          const afterProcedures = needsAfterProcedures
            ? (await projection<{ procedures: ProcedureProjection[] }>(request, session, "/workspaces/procedures"))?.procedures ?? beforeProcedures
            : beforeProcedures;
          const procedure = [...afterProcedures, ...beforeProcedures].find((entry) => entry.procedure === procedureId);
          const stepId = typeof output.step === "string"
            ? output.step
            : typeof body.step === "string" ? body.step : undefined;
          const step = procedure?.steps.find((entry) => entry.step === stepId)
            ?? beforeProcedures.find((entry) => entry.procedure === procedureId)?.steps.find((entry) => entry.step === stepId);

          if (activityType === "CONTEXT_CREATED") {
            const contextId = typeof output.context === "string" ? output.context : undefined;
            if (contextId) await accounts.recordActivity({
              workspace: session.workspace,
              actor: session.user,
              actorName: session.name,
              type: activityType,
              context: contextId,
            });
          } else if (activityType === "CONTEXT_ATTACHED" && procedureId && procedure) {
            const contextId = typeof body.context === "string" ? body.context : undefined;
            const attachmentId = typeof output.attachment === "string" ? output.attachment : undefined;
            if (contextId && attachmentId) await accounts.recordContextAttachment({
              workspace: session.workspace,
              actor: session.user,
              actorName: session.name,
              context: contextId,
              attachment: attachmentId,
              procedure: procedureId,
              procedureTitle: procedure.title,
              ...(stepId ? { step: stepId } : {}),
              ...(step?.position !== undefined ? { stepPosition: step.position } : {}),
            });
          } else if (activityType === "CONTEXT_CHANGED") {
            const contextId = typeof body.context === "string" ? body.context : undefined;
            const attachedProcedureIds = [...new Set(
              beforeContexts.find((entry) => entry.context === contextId)?.attachments.map(({ subject }) => subject) ?? [],
            )];
            const attached = attachedProcedureIds
              .map((id) => beforeProcedures.find((entry) => entry.procedure === id))
              .filter((entry): entry is ProcedureProjection => !!entry);
            const first = attached[0];
            const title = first
              ? attached.length > 1 ? `${first.title} and ${attached.length - 1} more` : first.title
              : undefined;
            await accounts.recordActivity({
              workspace: session.workspace,
              actor: session.user,
              actorName: session.name,
              type: activityType,
              ...(first ? { procedure: first.procedure } : {}),
              ...(contextId ? { context: contextId } : {}),
              ...(title ? { procedureTitle: title } : {}),
            });
          } else if (activityType === "REVIEW_CONFIRMED" || activityType === "REVIEW_RESOLVED") {
            const reviewId = typeof body.review === "string" ? body.review : undefined;
            if (reviewId && procedureId && procedure) await accounts.recordActivity({
              workspace: session.workspace,
              actor: session.user,
              actorName: session.name,
              type: activityType,
              review: reviewId,
              procedure: procedureId,
              procedureTitle: procedure.title,
            });
          } else if (activityType === "QUESTION_ANSWERED") {
            const questionId = typeof body.question === "string" ? body.question : undefined;
            const stepQuestion = beforeQuestions?.stepQuestions.find((entry) => entry.question === questionId);
            const contextQuestion = beforeQuestions?.contextQuestions.find((entry) => entry.question === questionId);
            const contextId = contextQuestion?.context;
            const contextProcedureId = contextId
              ? beforeContexts.find((entry) => entry.context === contextId)?.attachments[0]?.subject
              : undefined;
            const questionProcedureId = stepQuestion?.procedure ?? contextProcedureId;
            const questionProcedure = beforeProcedures.find((entry) => entry.procedure === questionProcedureId);
            if (questionId) await accounts.recordActivity({
              workspace: session.workspace,
              actor: session.user,
              actorName: session.name,
              type: activityType,
              question: questionId,
              ...(questionProcedure ? { procedure: questionProcedure.procedure, procedureTitle: questionProcedure.title } : {}),
              ...(stepQuestion ? { step: stepQuestion.step } : {}),
              ...(contextId ? { context: contextId } : {}),
            });
          } else if (procedureId && procedure) {
            await accounts.recordActivity({
              workspace: session.workspace,
              actor: session.user,
              actorName: session.name,
              type: activityType,
              procedure: procedureId,
              procedureTitle: procedure.title,
              ...(stepId ? { step: stepId } : {}),
              ...(step?.position !== undefined ? { stepPosition: step.position } : {}),
            });
          }
        } catch (error) {
          console.error("Relay activity recording failed after a successful mutation.", error);
        }
      }
      return result;
    } catch (error) {
      if (error instanceof WorkspaceUnavailable || error instanceof InvitationUnavailable) return errorResponse(404, error instanceof InvitationUnavailable ? "INVITATION_NOT_AVAILABLE" : "WORKSPACE_NOT_AVAILABLE");
      if (error instanceof NotAuthorized) return errorResponse(403, "FORBIDDEN");
      if (error instanceof AccountInputError) return errorResponse(400, "INVALID_INPUT");
      throw error;
    }
  };
}
