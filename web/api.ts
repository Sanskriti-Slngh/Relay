import type { RelayP2MVPWire } from "../generated/wire.ts";

type Output<Path extends keyof RelayP2MVPWire> = RelayP2MVPWire[Path]["output"];

export type Procedure = Output<"/workspaces/procedures">["procedures"][number];
export type Step = Procedure["steps"][number];
export type ContextNote = Output<"/workspaces/context">["contexts"][number];
export type Attachment = ContextNote["attachments"][number];
export type ChangeRecord = ContextNote["changes"][number];
export type PendingReview = Output<"/workspaces/reviews/pending">["reviews"][number];
export type ReviewCause = PendingReview["causes"][number];
export type ProcedureReviewHistory = Output<"/workspaces/reviews">["procedures"][number];
export type StepQuestion = Output<"/workspaces/questions">["stepQuestions"][number];
export type ContextQuestion = Output<"/workspaces/questions">["contextQuestions"][number];

export interface SessionState {
  authenticated: boolean;
  csrfToken?: string;
  workspace?: string;
  workspaceName?: string;
  user?: { id: string; email: string; name: string };
  role?: string;
  permissions?: string[];
  workspaces?: WorkspaceMembership[];
}

export interface WorkspaceMembership {
  workspace: string;
  name: string;
  role: string;
  permissions: string[];
  ownershipConfigured: boolean;
}

export interface WorkspaceMember {
  user: string;
  name: string;
  role: string;
  email?: string;
}

export interface PendingInvitation {
  invitation: string;
  email: string;
  status: "PENDING";
  expiresAt: string;
}

export interface IssuedInvitation {
  invitation: string;
  email: string;
  token: string;
  expiresAt: string;
  reissued?: boolean;
}

export interface ActivityEvent {
  event: string;
  actor: string;
  actorName: string;
  type:
    | "PLAYBOOK_CREATED" | "PLAYBOOK_RENAMED" | "PLAYBOOK_ARCHIVED"
    | "STEP_ADDED" | "STEP_EDITED" | "STEP_REMOVED"
    | "CONTEXT_CREATED" | "CONTEXT_ATTACHED" | "CONTEXT_CHANGED"
    | "REVIEW_CONFIRMED" | "REVIEW_RESOLVED" | "QUESTION_ANSWERED"
    | "MEMBER_PROMOTED" | "OFFICER_DEMOTED" | "MEMBER_REMOVED"
    | "OWNERSHIP_CLAIMED" | "OWNERSHIP_TRANSFERRED";
  occurredAt: string;
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
}

export class RelayApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(messageFor(code));
    this.name = "RelayApiError";
  }
}

function messageFor(code: string): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Your session has expired. Sign in again.",
    INVALID_CREDENTIALS: "The email or password is incorrect.",
    ACCOUNT_EXISTS: "An account already uses that email address.",
    FORBIDDEN: "You do not have permission to do that in this club.",
    ORIGIN_REJECTED: "Relay rejected a request from an untrusted site.",
    WORKSPACE_REQUIRED: "Choose or create a club workspace first.",
    WORKSPACE_NOT_AVAILABLE: "That club is not available to your account.",
    INVITATION_NOT_AVAILABLE: "That invitation is invalid, expired, already used, or belongs to another email address.",
    NOT_FOUND: "That record is no longer available in this workspace.",
    CONFLICT: "Relay could not apply this because the current state conflicts with the request.",
    INVALID_INPUT: "Check the request and try again.",
    INVALID_REQUEST: "The requested change is not valid for the current record.",
    ATTACHMENT_ALREADY_EXISTS: "That context note is already attached to the selected target.",
    CHANGE_NOT_DIFFERENT: "A meaningful change must differ from the current note.",
    REVIEW_NOT_PENDING_FOR_CONFIRMATION: "That review is no longer pending and cannot be confirmed again.",
    REVIEW_NOT_AVAILABLE: "That review is no longer pending or available in this workspace.",
    STEP_NOT_AVAILABLE: "That step is no longer active or available in this workspace.",
    REVIEW_NOT_PENDING_FOR_CHANGES: "That review is no longer pending and cannot require changes.",
    REVIEW_NOT_AWAITING_CHANGES: "That review is not waiting for changes and cannot be resolved.",
    CANCEL_REVIEW_FINISHED: "That review is already finished and cannot be cancelled.",
    QUESTION_SUBJECT_NOT_AVAILABLE: "That question target is not available in this workspace.",
    QUESTION_NOT_AVAILABLE: "That question is no longer open or available in this workspace.",
    QUESTION_NOT_OPEN: "That question has already been answered.",
    QUESTION_ANSWER_NOT_EDITABLE: "Only the Officer who originally answered can revise this answer.",
    CSRF_REJECTED: "Your session verification failed. Sign in again.",
    MEMBERSHIP_CONFLICT: "That membership changed or the requested role change is not allowed.",
    OWNERSHIP_REQUIRED: "Set the workspace Owner before managing roles.",
    VERSION_CONFLICT: "Someone changed this while you were working. Your draft is still here—compare it with the latest version before saving again.",
  };
  return messages[code] ?? "Relay could not complete the request. Please try again.";
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createRelayApi(fetcher: FetchLike = fetch) {
  async function readResponse<T>(response: Response, path = ""): Promise<T> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new RelayApiError(response.status, "INVALID_INPUT");
    }
    if (!response.ok) {
      let code =
        body !== null && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "INTERNAL_ERROR";
      if (code === "CONFLICT" && path.includes("/context/") && path.includes("attachments")) {
        code = "ATTACHMENT_ALREADY_EXISTS";
      } else if (code === "INVALID_REQUEST" && path === "/workspaces/context/change") {
        code = "CHANGE_NOT_DIFFERENT";
      } else if (code === "CONFLICT" && path === "/workspaces/reviews/confirm") {
        code = "REVIEW_NOT_PENDING_FOR_CONFIRMATION";
      } else if (code === "NOT_FOUND" && path === "/workspaces/reviews/confirm") {
        code = "REVIEW_NOT_AVAILABLE";
      } else if (code === "CONFLICT" && path === "/workspaces/reviews/require-changes") {
        code = "REVIEW_NOT_PENDING_FOR_CHANGES";
      } else if (code === "CONFLICT" && path === "/workspaces/reviews/resolve") {
        code = "REVIEW_NOT_AWAITING_CHANGES";
      } else if (code === "CONFLICT" && path === "/workspaces/reviews/cancel") {
        code = "CANCEL_REVIEW_FINISHED";
      } else if (code === "NOT_FOUND" && path.startsWith("/workspaces/reviews/")) {
        code = "REVIEW_NOT_AVAILABLE";
      } else if (code === "NOT_FOUND" && path.startsWith("/workspaces/procedures/steps/")) {
        code = "STEP_NOT_AVAILABLE";
      } else if (code === "NOT_FOUND" && path.includes("/questions/") && path.endsWith("/ask")) {
        code = "QUESTION_SUBJECT_NOT_AVAILABLE";
      } else if (code === "NOT_FOUND" && path.includes("/questions/") && path.endsWith("/answer")) {
        code = "QUESTION_NOT_AVAILABLE";
      } else if (code === "CONFLICT" && path.includes("/questions/") && path.endsWith("/answer")) {
        code = "QUESTION_NOT_OPEN";
      }
      throw new RelayApiError(response.status, code);
    }
    return body as T;
  }

  async function post<T>(
    path: string,
    body: Record<string, unknown>,
    csrfToken: string,
  ): Promise<T> {
    const response = await fetcher(`/api${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-CSRF": csrfToken,
      },
      body: JSON.stringify(body),
    });
    return readResponse<T>(response, path);
  }

  async function hostPost<T>(path: string, body: Record<string, unknown>, csrfToken?: string): Promise<T> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (csrfToken) headers.set("X-Relay-CSRF", csrfToken);
    return readResponse<T>(await fetcher(path, { method: "POST", credentials: "same-origin", headers, body: JSON.stringify(body) }), path);
  }

  return {
    async session(): Promise<SessionState> {
      return readResponse<SessionState>(
        await fetcher("/session", { credentials: "same-origin", cache: "no-store" }),
      );
    },
    async login(credential: string): Promise<SessionState> {
      return readResponse<SessionState>(
        await fetcher("/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        }),
      );
    },
    signIn(email: string, password: string) {
      return hostPost<SessionState>("/auth/login", { email, password });
    },
    register(email: string, password: string, name: string) {
      return hostPost<SessionState>("/auth/register", { email, password, name });
    },
    createWorkspace(name: string, csrfToken: string) {
      return hostPost<SessionState>("/workspaces/create", { name }, csrfToken);
    },
    selectWorkspace(workspace: string, csrfToken: string) {
      return hostPost<SessionState>("/workspaces/select", { workspace }, csrfToken);
    },
    workspaceMembers(csrfToken: string) {
      return hostPost<{ members: WorkspaceMember[] }>("/workspaces/members", {}, csrfToken);
    },
    claimOwnership(csrfToken: string) {
      return hostPost<SessionState>("/workspaces/ownership/claim", {}, csrfToken);
    },
    changeMemberRole(targetUser: string, role: "Officer" | "Member", csrfToken: string) {
      return hostPost<{ changed: boolean }>("/workspaces/members/role", { targetUser, role }, csrfToken);
    },
    removeMember(targetUser: string, csrfToken: string) {
      return hostPost<{ removed: boolean }>("/workspaces/members/remove", { targetUser }, csrfToken);
    },
    transferOwnership(targetUser: string, formerOwnerRole: "Officer" | "Member", csrfToken: string) {
      return hostPost<SessionState>("/workspaces/ownership/transfer", { targetUser, formerOwnerRole }, csrfToken);
    },
    recentActivity(csrfToken: string) {
      return hostPost<{ events: ActivityEvent[] }>("/workspaces/activity", {}, csrfToken);
    },
    pendingInvitations(csrfToken: string) {
      return hostPost<{ invitations: PendingInvitation[] }>("/invitations/pending", {}, csrfToken);
    },
    createInvitation(email: string, csrfToken: string) {
      return hostPost<IssuedInvitation>("/invitations/create", { email }, csrfToken);
    },
    reissueInvitation(invitation: string, csrfToken: string) {
      return hostPost<IssuedInvitation>("/invitations/reissue", { invitation }, csrfToken);
    },
    acceptInvitation(token: string, csrfToken: string) {
      return hostPost<SessionState>("/invitations/accept", { token }, csrfToken);
    },
    async logout(csrfToken: string): Promise<void> {
      await readResponse(
        await fetcher("/session/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Relay-CSRF": csrfToken },
          body: "{}",
        }),
      );
    },
    procedures(csrfToken: string) {
      return post<{ procedures: Procedure[] }>("/workspaces/procedures", {}, csrfToken);
    },
    contextHistory(csrfToken: string) {
      return post<{ contexts: ContextNote[] }>("/workspaces/context", {}, csrfToken);
    },
    pendingReviews(csrfToken: string) {
      return post<{ reviews: PendingReview[] }>("/workspaces/reviews/pending", {}, csrfToken);
    },
    reviewHistory(csrfToken: string) {
      return post<{ procedures: ProcedureReviewHistory[] }>("/workspaces/reviews", {}, csrfToken);
    },
    questions(csrfToken: string) {
      return post<{ stepQuestions: StepQuestion[]; contextQuestions: ContextQuestion[] }>(
        "/workspaces/questions",
        {},
        csrfToken,
      );
    },
    createProcedure(title: string, csrfToken: string) {
      return post<{ procedure: string }>("/workspaces/procedures/create", { title }, csrfToken);
    },
    addStep(procedure: string, text: string, expectedVersion: number, csrfToken: string) {
      return post<{ procedure: string; step: string }>("/workspaces/procedures/steps/add", {
        procedure,
        text,
        expectedVersion,
      }, csrfToken);
    },
    renameProcedure(procedure: string, title: string, expectedVersion: number, csrfToken: string) {
      return post<{ procedure: string; title: string }>("/workspaces/procedures/rename", {
        procedure,
        title,
        expectedVersion,
      }, csrfToken);
    },
    editStep(procedure: string, step: string, text: string, expectedVersion: number, csrfToken: string) {
      return post<{ step: string }>("/workspaces/procedures/steps/edit", {
        procedure,
        step,
        text,
        expectedVersion,
      }, csrfToken);
    },
    moveStep(procedure: string, step: string, position: number, expectedVersion: number, csrfToken: string) {
      return post<{ step: string; position: number }>(
        "/workspaces/procedures/steps/move",
        { procedure, step, position, expectedVersion },
        csrfToken,
      );
    },
    removeStep(procedure: string, step: string, expectedVersion: number, csrfToken: string) {
      return post<{ step: string }>("/workspaces/procedures/steps/remove", {
        procedure,
        step,
        expectedVersion,
      }, csrfToken);
    },
    archiveProcedure(procedure: string, expectedVersion: number, csrfToken: string) {
      return post<{ procedure: string; status: string }>("/workspaces/procedures/archive", {
        procedure,
        expectedVersion,
      }, csrfToken);
    },
    recordContextNote(text: string, csrfToken: string) {
      return post<{ context: string }>("/workspaces/context/notes", { text }, csrfToken);
    },
    attachContextNote(context: string, procedure: string, csrfToken: string) {
      return post<{ attachment: string }>("/workspaces/context/attachments", {
        context,
        procedure,
      }, csrfToken);
    },
    attachContextNoteAtStep(context: string, procedure: string, step: string, csrfToken: string) {
      return post<{ attachment: string }>("/workspaces/context/step-attachments", {
        context,
        procedure,
        step,
      }, csrfToken);
    },
    correctContextNote(context: string, text: string, expectedVersion: number, csrfToken: string) {
      return post<{ context: string }>("/workspaces/context/correct", { context, text, expectedVersion }, csrfToken);
    },
    changeContextNote(context: string, text: string, expectedVersion: number, csrfToken: string) {
      return post<{ context: string; change: string }>("/workspaces/context/change", {
        context,
        text,
        expectedVersion,
      }, csrfToken);
    },
    confirmReview(review: string, procedure: string, expectedVersion: number, csrfToken: string) {
      return post<{ review: string; status: string }>("/workspaces/reviews/confirm", {
        review,
        procedure,
        expectedVersion,
      }, csrfToken);
    },
    requireReviewChanges(review: string, procedure: string, expectedVersion: number, csrfToken: string) {
      return post<{ review: string; status: string }>("/workspaces/reviews/require-changes", {
        review,
        procedure,
        expectedVersion,
      }, csrfToken);
    },
    resolveReview(review: string, procedure: string, expectedVersion: number, csrfToken: string) {
      return post<{ review: string; status: string }>("/workspaces/reviews/resolve", {
        review,
        procedure,
        expectedVersion,
      }, csrfToken);
    },
    cancelReview(review: string, procedure: string, expectedVersion: number, csrfToken: string) {
      return post<{ review: string; status: string }>("/workspaces/reviews/cancel", {
        review,
        procedure,
        expectedVersion,
      }, csrfToken);
    },
    askStepQuestion(procedure: string, step: string, text: string, csrfToken: string) {
      return post<{ question: string; step: string }>("/workspaces/questions/steps/ask", {
        procedure,
        step,
        text,
      }, csrfToken);
    },
    askContextQuestion(procedure: string, context: string, text: string, csrfToken: string) {
      return post<{ question: string; context: string }>("/workspaces/questions/context/ask", {
        procedure,
        context,
        text,
      }, csrfToken);
    },
    answerStepQuestion(question: string, answer: string, expectedVersion: number, csrfToken: string) {
      return post<{ question: string; status: string }>("/workspaces/questions/steps/answer", {
        question,
        answer,
        expectedVersion,
      }, csrfToken);
    },
    answerContextQuestion(question: string, answer: string, expectedVersion: number, csrfToken: string) {
      return post<{ question: string; status: string }>("/workspaces/questions/context/answer", {
        question,
        answer,
        expectedVersion,
      }, csrfToken);
    },
    reviseStepQuestionAnswer(question: string, answer: string, expectedVersion: number, csrfToken: string) {
      return post<{ question: string; status: string }>("/workspaces/questions/steps/revise", {
        question,
        answer,
        expectedVersion,
      }, csrfToken);
    },
    reviseContextQuestionAnswer(question: string, answer: string, expectedVersion: number, csrfToken: string) {
      return post<{ question: string; status: string }>("/workspaces/questions/context/revise", {
        question,
        answer,
        expectedVersion,
      }, csrfToken);
    },
  };
}

export type RelayApi = ReturnType<typeof createRelayApi>;
