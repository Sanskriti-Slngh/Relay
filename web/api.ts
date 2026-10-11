export interface Step {
  step: string;
  text: string;
  position: number;
}

export interface Procedure {
  procedure: string;
  title: string;
  status: string;
  steps: Step[];
}

export interface Attachment {
  subject: string;
  anchor: string | null;
}

export interface ChangeRecord {
  change: string;
  before: string;
  after: string;
}

export interface ContextNote {
  context: string;
  text: string;
  attachments: Attachment[];
  changes: ChangeRecord[];
}

export interface ReviewCause extends ChangeRecord {
  cause: string;
}

export interface PendingReview {
  review: string;
  procedure: string;
  title: string;
  status: string;
  causes: ReviewCause[];
}

export interface ProcedureReviewHistory {
  procedure: string;
  title: string;
  reviews: {
    review: string;
    status: string;
    causes: ReviewCause[];
  }[];
}

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
    NOT_FOUND: "That record is no longer available in this workspace.",
    CONFLICT: "Relay could not apply this because the current state conflicts with the request.",
    INVALID_INPUT: "Check the request and try again.",
    INVALID_REQUEST: "The requested change is not valid for the current record.",
    CSRF_REJECTED: "The request could not be verified. Refresh the page and try again.",
  };
  return messages[code] ?? "Relay could not complete the request. Please try again.";
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createRelayApi(fetcher: FetchLike = fetch) {
  async function readResponse<T>(response: Response): Promise<T> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new RelayApiError(response.status, "INVALID_INPUT");
    }
    if (!response.ok) {
      const code =
        body !== null && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "INTERNAL_ERROR";
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
    return readResponse<T>(response);
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
