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

export interface SessionState {
  authenticated: boolean;
  csrfToken?: string;
  workspace?: string;
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
    UNAUTHORIZED: "Your local session has expired. Sign in again.",
    FORBIDDEN: "This action is not authorized for the configured officer.",
    ORIGIN_REJECTED: "Open Relay at http://127.0.0.1:5173 and try again.",
    NOT_FOUND: "That record is no longer available in this workspace.",
    CONFLICT: "Relay could not apply this because the current state conflicts with the request.",
    INVALID_INPUT: "Check the request and try again.",
    INVALID_REQUEST: "The requested change is not valid for the current record.",
    ATTACHMENT_ALREADY_EXISTS: "That context note is already attached to the selected target.",
    CHANGE_NOT_DIFFERENT: "A meaningful change must differ from the current note.",
    REVIEW_NOT_PENDING_FOR_CONFIRMATION: "That review is no longer pending and cannot be confirmed again.",
    REVIEW_NOT_AVAILABLE: "That review is no longer pending or available in this workspace.",
    CSRF_REJECTED: "Your session verification failed. Sign in again.",
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
    async logout(csrfToken: string): Promise<void> {
      await readResponse(
        await fetcher("/session/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-Relay-CSRF": csrfToken },
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
    createProcedure(title: string, csrfToken: string) {
      return post<{ procedure: string }>("/workspaces/procedures/create", { title }, csrfToken);
    },
    addStep(procedure: string, text: string, csrfToken: string) {
      return post<{ procedure: string; step: string }>("/workspaces/procedures/steps/add", {
        procedure,
        text,
      }, csrfToken);
    },
    archiveProcedure(procedure: string, csrfToken: string) {
      return post<{ procedure: string; status: string }>("/workspaces/procedures/archive", {
        procedure,
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
    correctContextNote(context: string, text: string, csrfToken: string) {
      return post<{ context: string }>("/workspaces/context/correct", { context, text }, csrfToken);
    },
    changeContextNote(context: string, text: string, csrfToken: string) {
      return post<{ context: string; change: string }>("/workspaces/context/change", {
        context,
        text,
      }, csrfToken);
    },
    confirmReview(review: string, procedure: string, csrfToken: string) {
      return post<{ review: string; status: string }>("/workspaces/reviews/confirm", {
        review,
        procedure,
      }, csrfToken);
    },
  };
}

export type RelayApi = ReturnType<typeof createRelayApi>;
