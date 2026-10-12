import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  each,
  former,
  no,
  reaction,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { ContextTracking, ProcedureMaintaining, Reviewing, RoleBasedAccessing } = concepts;

function stringInput(
  required: string[],
  nonEmpty: string[] = [],
  maxLengths: Record<string, number> = {},
) {
  return {
    input: { required },
    validators: {
      input(value: unknown) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          return { ok: false as const, detail: "Expected a JSON object." };
        }
        const fields = value as Record<string, unknown>;
        for (const field of required) {
          if (typeof fields[field] !== "string") {
            return { ok: false as const, detail: `Field ${field} must be a string.` };
          }
        }
        for (const field of nonEmpty) {
          if (typeof fields[field] === "string" && fields[field].trim().length === 0) {
            return { ok: false as const, detail: `Field ${field} must not be empty.` };
          }
        }
        for (const [field, maxLength] of Object.entries(maxLengths)) {
          if (typeof fields[field] === "string" && fields[field].length > maxLength) {
            return {
              ok: false as const,
              detail: `Field ${field} must be at most ${maxLength} characters.`,
            };
          }
        }
        return { ok: true as const };
      },
    },
  };
}

const RequestReview = reaction(({ change, context, procedure }) =>
  when(ContextTracking.change({}).responds({ change }))
    .where(
      ContextTracking._getChange({ change }).is({ context }),
      ContextTracking._attachments({ context }).is({ subject: procedure }),
      ProcedureMaintaining._get({ procedure }).is({ status: "ACTIVE" }),
      no(Reviewing._unfinished({}).is({ item: procedure })),
    )
    .then(Reviewing.request({ item: procedure, cause: change })),
);

const AddChangeCause = reaction(({ change, context, procedure, review }) =>
  when(ContextTracking.change({}).responds({ change }))
    .afterFlowSettles()
    .where(
      ContextTracking._getChange({ change }).is({ context }),
      ContextTracking._attachments({ context }).is({ subject: procedure }),
      ProcedureMaintaining._get({ procedure }).is({ status: "ACTIVE" }),
      Reviewing._unfinished({}).is({ item: procedure, review }),
      no(Reviewing._causes({ review }).is({ cause: change })),
    )
    .then(Reviewing.addCause({ review, cause: change })),
);

const AddCauseAfterConcurrentRequestRefusal = reaction(({ item, cause, review }) =>
  when(Reviewing.request({ item, cause }).refuses({ error: "REQUEST_ALREADY_UNFINISHED" }))
    .where(Reviewing._unfinished({}).is({ item, review }))
    .then(Reviewing.addCause({ review, cause })),
);

const WorkspaceProcedures = former(
  "Relay.Reads.WorkspaceProcedures",
  ({ workspace }, { procedure, title, status, step, text, position }) =>
    each(ProcedureMaintaining._procedures({ space: workspace }).is({ procedure, title, status }))
      .arranged(procedure)
      .form({
        procedure,
        title,
        status,
        steps: each(ProcedureMaintaining._steps({ procedure }).is({ step, text, position }))
          .arranged(position)
          .form({ step, text, position }),
      }),
);

const WorkspaceContextHistory = former(
  "Relay.Reads.WorkspaceContextHistory",
  ({ workspace }, { context, text, attachment, subject, anchor, change, before, after }) =>
    each(ContextTracking._notes({ scope: workspace }).is({ context, text }))
      .arranged(context)
      .form({
        context,
        text,
        attachments: each(ContextTracking._attachments({ context }).is({ attachment, subject }))
          .arranged(attachment)
          .where(whether(ContextTracking._getAttachment({ attachment }).is({ anchor })))
          .form({ attachment, subject, anchor }),
        changes: each(ContextTracking._changes({ context }).is({ change, before, after }))
          .arranged(change)
          .form({ change, before, after }),
      }),
);

const PendingReviews = former(
  "Relay.Reads.PendingReviews",
  ({ workspace }, { review, procedure, status, title, cause, before, after }) =>
    each(Reviewing._unfinished({}).is({ review, item: procedure, status }))
      .arranged(review)
      .where(ProcedureMaintaining._get({ procedure }).is({ space: workspace, title }))
      .form({
        review,
        procedure,
        title,
        status,
        causes: each(Reviewing._causes({ review }).is({ cause }))
          .arranged(cause)
          .where(ContextTracking._getChange({ change: cause }).is({ before, after }))
          .form({ cause, before, after }),
      }),
);

const WorkspaceReviewHistory = former(
  "Relay.Reads.WorkspaceReviewHistory",
  ({ workspace }, { procedure, title, review, status, cause, before, after }) =>
    each(ProcedureMaintaining._procedures({ space: workspace }).is({ procedure, title }))
      .arranged(procedure)
      .form({
        procedure,
        title,
        reviews: each(Reviewing._forItem({ item: procedure }).is({ review, status }))
          .arranged(review)
          .form({
            review,
            status,
            causes: each(Reviewing._causes({ review }).is({ cause }))
              .arranged(cause)
              .where(ContextTracking._getChange({ change: cause }).is({ before, after }))
              .form({ cause, before, after }),
          }),
      }),
);

const CreateProcedure = endpoint(
  "/workspaces/procedures/create",
  ({ user, workspace, title, procedure }) =>
    receive({ user, workspace, title })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "CREATE_PROCEDURE",
        }).responds({}),
      )
      .then(ProcedureMaintaining.create({ space: workspace, title }).responds({ procedure }))
      .then(respond({ procedure })),
  stringInput(
    ["user", "workspace", "title"],
    ["user", "workspace", "title"],
    { title: 160 },
  ),
);

const AddStep = endpoint(
  "/workspaces/procedures/steps/add",
  ({ user, workspace, procedure, text, step }) =>
    receive({ user, workspace, procedure, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "ADD_STEP",
        }).responds({}),
      )
      .then(
        where(
          ProcedureMaintaining._get({ procedure })
            .is({ space: workspace, status: "ACTIVE" }),
        )
          .then(ProcedureMaintaining.addStep({ procedure, text }).responds({ step }))
          .then(respond({ procedure, step }))
          .named("procedure-available"),
        where(no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })))
          .then(respond({ error: "PROCEDURE_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "procedure", "text"],
    ["user", "workspace", "procedure", "text"],
    { text: 500 },
  ),
);

const ArchiveProcedure = endpoint(
  "/workspaces/procedures/archive",
  ({ user, workspace, procedure }) =>
    receive({ user, workspace, procedure })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "ARCHIVE_PROCEDURE",
        }).responds({}),
      )
      .then(
        where(
          ProcedureMaintaining._get({ procedure })
            .is({ space: workspace, status: "ACTIVE" }),
        )
          .then(ProcedureMaintaining.retire({ procedure }))
          .then(respond({ procedure, status: "RETIRED" }))
          .named("procedure-available"),
        where(no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })))
          .then(respond({ error: "PROCEDURE_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
      ),
  stringInput(["user", "workspace", "procedure"], ["user", "workspace", "procedure"]),
);

const RecordContextNote = endpoint(
  "/workspaces/context/notes",
  ({ user, workspace, text, context }) =>
    receive({ user, workspace, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_CONTEXT",
          command: "RECORD_CONTEXT_NOTE",
        }).responds({}),
      )
      .then(ContextTracking.record({ scope: workspace, text }).responds({ context }))
      .then(respond({ context })),
  stringInput(
    ["user", "workspace", "text"],
    ["user", "workspace", "text"],
    { text: 4_000 },
  ),
);

const AttachContextNote = endpoint(
  "/workspaces/context/attachments",
  ({ user, workspace, context, procedure, attachment }) =>
    receive({ user, workspace, context, procedure })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_CONTEXT",
          command: "ATTACH_CONTEXT_NOTE",
        }).responds({}),
      )
      .then(
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
        )
          .then(ContextTracking.attach({ context, subject: procedure }).responds({ attachment }))
          .then(respond({ attachment }))
          .named("context-and-procedure-available"),
        where(
          no(ContextTracking._get({ context }).is({ scope: workspace })),
        )
          .then(respond({ error: "CONTEXT_OR_PROCEDURE_NOT_AVAILABLE" }))
          .named("context-unavailable"),
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "CONTEXT_OR_PROCEDURE_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
      ),
  stringInput(["user", "workspace", "context", "procedure"], ["user", "workspace", "context", "procedure"]),
);

const AttachContextNoteAtStep = endpoint(
  "/workspaces/context/step-attachments",
  ({ user, workspace, context, procedure, step, attachment }) =>
    receive({ user, workspace, context, procedure, step })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_CONTEXT",
          command: "ATTACH_CONTEXT_NOTE_AT_STEP",
        }).responds({}),
      )
      .then(
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" }),
        )
          .then(ContextTracking.attachAt({ context, subject: procedure, anchor: step }).responds({ attachment }))
          .then(respond({ attachment }))
          .named("context-procedure-and-step-available"),
        where(
          no(ContextTracking._get({ context }).is({ scope: workspace })),
        )
          .then(respond({ error: "CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE" }))
          .named("context-unavailable"),
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          no(ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" })),
        )
          .then(respond({ error: "CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE" }))
          .named("step-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "context", "procedure", "step"],
    ["user", "workspace", "context", "procedure", "step"],
  ),
);

const CorrectContextNote = endpoint(
  "/workspaces/context/correct",
  ({ user, workspace, context, text }) =>
    receive({ user, workspace, context, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_CONTEXT",
          command: "CORRECT_CONTEXT_NOTE",
        }).responds({}),
      )
      .then(
        where(ContextTracking._get({ context }).is({ scope: workspace }))
          .then(ContextTracking.correct({ context, text }))
          .then(respond({ context }))
          .named("context-available"),
        where(no(ContextTracking._get({ context }).is({ scope: workspace })))
          .then(respond({ error: "CONTEXT_NOT_AVAILABLE" }))
          .named("context-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "context", "text"],
    ["user", "workspace", "context", "text"],
    { text: 4_000 },
  ),
);

const ChangeContextNote = endpoint(
  "/workspaces/context/change",
  ({ user, workspace, context, text, change }) =>
    receive({ user, workspace, context, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_CONTEXT",
          command: "CHANGE_CONTEXT_NOTE",
        }).responds({}),
      )
      .then(
        where(ContextTracking._get({ context }).is({ scope: workspace }))
          .then(ContextTracking.change({ context, text }).responds({ change }))
          .then(respond({ context, change }))
          .named("context-available"),
        where(no(ContextTracking._get({ context }).is({ scope: workspace })))
          .then(respond({ error: "CONTEXT_NOT_AVAILABLE" }))
          .named("context-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "context", "text"],
    ["user", "workspace", "context", "text"],
    { text: 4_000 },
  ),
);

const ListProcedures = endpoint(
  "/workspaces/procedures",
  ({ user, workspace }) =>
    receive({ user, workspace })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "LIST_PROCEDURES",
        }).responds({}),
      )
      .then(respond({ procedures: WorkspaceProcedures({ workspace }) })),
  stringInput(["user", "workspace"], ["user", "workspace"]),
);

const GetContextHistory = endpoint(
  "/workspaces/context",
  ({ user, workspace }) =>
    receive({ user, workspace })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_CONTEXT",
          command: "GET_CONTEXT_HISTORY",
        }).responds({}),
      )
      .then(respond({ contexts: WorkspaceContextHistory({ workspace }) })),
  stringInput(["user", "workspace"], ["user", "workspace"]),
);

const GetPendingReviews = endpoint(
  "/workspaces/reviews/pending",
  ({ user, workspace }) =>
    receive({ user, workspace })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "COMPLETE_REVIEW",
          command: "GET_PENDING_REVIEWS",
        }).responds({}),
      )
      .then(respond({ reviews: PendingReviews({ workspace }) })),
  stringInput(["user", "workspace"], ["user", "workspace"]),
);

const GetReviewHistory = endpoint(
  "/workspaces/reviews",
  ({ user, workspace }) =>
    receive({ user, workspace })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "COMPLETE_REVIEW",
          command: "GET_REVIEW_HISTORY",
        }).responds({}),
      )
      .then(respond({ procedures: WorkspaceReviewHistory({ workspace }) })),
  stringInput(["user", "workspace"], ["user", "workspace"]),
);

const ConfirmReview = endpoint(
  "/workspaces/reviews/confirm",
  ({ user, workspace, review, procedure }) =>
    receive({ user, workspace, review, procedure })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "COMPLETE_REVIEW",
          command: "CONFIRM_REVIEW",
        }).responds({}),
      )
      .then(
        where(
          Reviewing._get({ review }).is({ item: procedure, status: "PENDING" }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace }),
        )
          .then(Reviewing.confirm({ review }))
          .then(respond({ review, status: "COMPLETE" }))
          .named("review-in-workspace"),
        where(
          Reviewing._get({ review }).is({ item: procedure, status: "PENDING" }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace })),
        )
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("procedure-outside-workspace"),
        where(no(Reviewing._get({ review }).is({ item: procedure, status: "PENDING" })))
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("review-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "review", "procedure"],
    ["user", "workspace", "review", "procedure"],
  ),
);

export const composition = {
  Relay: {
    ContextChanges: {
      RequestReview,
      AddChangeCause,
      AddCauseAfterConcurrentRequestRefusal,
    },
    ProcedureOperations: { CreateProcedure, AddStep, ArchiveProcedure },
    ContextOperations: {
      RecordContextNote,
      AttachContextNote,
      AttachContextNoteAtStep,
      CorrectContextNote,
      ChangeContextNote,
    },
    ReviewOperations: { ConfirmReview },
    ReadOperations: { ListProcedures, GetContextHistory, GetPendingReviews, GetReviewHistory },
    Reads: { WorkspaceProcedures, WorkspaceContextHistory, PendingReviews, WorkspaceReviewHistory },
  },
};
