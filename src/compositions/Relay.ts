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

const {
  ContextTracking,
  ContextQuestioning,
  ProcedureMaintaining,
  Reviewing,
  RoleBasedAccessing,
  StepQuestioning,
} = concepts;

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

function moveStepInput() {
  const strings = stringInput(
    ["user", "workspace", "procedure", "step"],
    ["user", "workspace", "procedure", "step"],
  );
  return {
    input: { required: [...strings.input.required, "position"] },
    validators: {
      input(value: unknown) {
        const stringResult = strings.validators.input(value);
        if (!stringResult.ok) return stringResult;
        const fields = value as Record<string, unknown>;
        if (typeof fields.position !== "number" || !Number.isFinite(fields.position)) {
          return { ok: false as const, detail: "Field position must be a finite number." };
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

const DetachRemovedStepContext = reaction(({ step, attachment }) =>
  when(ProcedureMaintaining.removeStep({ step }).responds({}))
    .where(ContextTracking._atAnchor({ anchor: step }).is({ attachment }))
    .then(ContextTracking.detach({ attachment })),
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

const WorkspaceStepQuestions = former(
  "Relay.Reads.WorkspaceStepQuestions",
  (
    { workspace },
    {
      question,
      step,
      questionText,
      questionStatus,
      answer,
      procedure,
      title,
      stepText,
      stepStatus,
    },
  ) =>
    each(
      StepQuestioning._questions({}).is({
        question,
        subject: step,
        text: questionText,
        status: questionStatus,
      }),
    )
      .arranged(question)
      .where(
        ProcedureMaintaining._getStep({ step }).is({
          procedure,
          text: stepText,
          status: stepStatus,
        }),
        ProcedureMaintaining._get({ procedure }).is({ space: workspace, title }),
        whether(StepQuestioning._get({ question }).is({ answer })),
      )
      .form({
        question,
        step,
        text: questionText,
        status: questionStatus,
        answer,
        procedure,
        title,
        subjectText: stepText,
        subjectStatus: stepStatus,
      }),
);

const WorkspaceContextQuestions = former(
  "Relay.Reads.WorkspaceContextQuestions",
  ({ workspace }, { question, context, questionText, questionStatus, answer, contextText }) =>
    each(
      ContextQuestioning._questions({}).is({
        question,
        subject: context,
        text: questionText,
        status: questionStatus,
      }),
    )
      .arranged(question)
      .where(
        ContextTracking._get({ context }).is({ scope: workspace, text: contextText }),
        whether(ContextQuestioning._get({ question }).is({ answer })),
      )
      .form({
        question,
        context,
        text: questionText,
        status: questionStatus,
        answer,
        subjectText: contextText,
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

const RenameProcedure = endpoint(
  "/workspaces/procedures/rename",
  ({ user, workspace, procedure, title }) =>
    receive({ user, workspace, procedure, title })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "RENAME_PROCEDURE",
        }).responds({}),
      )
      .then(
        where(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }))
          .then(ProcedureMaintaining.rename({ procedure, title }))
          .then(respond({ procedure, title }))
          .named("procedure-available"),
        where(no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })))
          .then(respond({ error: "PROCEDURE_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "procedure", "title"],
    ["user", "workspace", "procedure", "title"],
    { title: 160 },
  ),
);

const EditStep = endpoint(
  "/workspaces/procedures/steps/edit",
  ({ user, workspace, procedure, step, text }) =>
    receive({ user, workspace, procedure, step, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "EDIT_STEP",
        }).responds({}),
      )
      .then(
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" }),
        )
          .then(ProcedureMaintaining.editStep({ step, text }))
          .then(respond({ step }))
          .named("step-available"),
        where(
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "STEP_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          no(ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" })),
        )
          .then(respond({ error: "STEP_NOT_AVAILABLE" }))
          .named("step-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "procedure", "step", "text"],
    ["user", "workspace", "procedure", "step", "text"],
    { text: 500 },
  ),
);

const MoveStep = endpoint(
  "/workspaces/procedures/steps/move",
  ({ user, workspace, procedure, step, position }) =>
    receive({ user, workspace, procedure, step, position })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "MOVE_STEP",
        }).responds({}),
      )
      .then(
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" }),
        )
          .then(ProcedureMaintaining.moveStep({ step, position }))
          .then(respond({ step, position }))
          .named("step-available"),
        where(
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "STEP_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          no(ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" })),
        )
          .then(respond({ error: "STEP_NOT_AVAILABLE" }))
          .named("step-unavailable"),
      ),
  moveStepInput(),
);

const RemoveStep = endpoint(
  "/workspaces/procedures/steps/remove",
  ({ user, workspace, procedure, step }) =>
    receive({ user, workspace, procedure, step })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "EDIT_PROCEDURE",
          command: "REMOVE_STEP",
        }).responds({}),
      )
      .then(
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" }),
        )
          .then(ProcedureMaintaining.removeStep({ step }))
          .then(respond({ step }))
          .named("step-available"),
        where(
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "STEP_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          no(ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" })),
        )
          .then(respond({ error: "STEP_NOT_AVAILABLE" }))
          .named("step-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "procedure", "step"],
    ["user", "workspace", "procedure", "step"],
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

const AskStepQuestion = endpoint(
  "/workspaces/questions/steps/ask",
  ({ user, workspace, procedure, step, text, question }) =>
    receive({ user, workspace, procedure, step, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "ASK_QUESTION",
          command: "ASK_STEP_QUESTION",
        }).responds({}),
      )
      .then(
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" }),
        )
          .then(StepQuestioning.ask({ subject: step, text }).responds({ question }))
          .then(respond({ question, step }))
          .named("step-available"),
        where(
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "QUESTION_SUBJECT_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
          no(ProcedureMaintaining._getStep({ step }).is({ procedure, status: "ACTIVE" })),
        )
          .then(respond({ error: "QUESTION_SUBJECT_NOT_AVAILABLE" }))
          .named("step-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "procedure", "step", "text"],
    ["user", "workspace", "procedure", "step", "text"],
    { text: 1_000 },
  ),
);

const AskContextQuestion = endpoint(
  "/workspaces/questions/context/ask",
  ({ user, workspace, procedure, context, text, question }) =>
    receive({ user, workspace, procedure, context, text })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "ASK_QUESTION",
          command: "ASK_CONTEXT_QUESTION",
        }).responds({}),
      )
      .then(
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          ContextTracking._attachments({ context }).is({ subject: procedure }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
        )
          .then(ContextQuestioning.ask({ subject: context, text }).responds({ question }))
          .then(respond({ question, context }))
          .named("context-available"),
        where(no(ContextTracking._get({ context }).is({ scope: workspace })))
          .then(respond({ error: "QUESTION_SUBJECT_NOT_AVAILABLE" }))
          .named("context-unavailable"),
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          no(ContextTracking._attachments({ context }).is({ subject: procedure })),
        )
          .then(respond({ error: "QUESTION_SUBJECT_NOT_AVAILABLE" }))
          .named("attachment-unavailable"),
        where(
          ContextTracking._get({ context }).is({ scope: workspace }),
          ContextTracking._attachments({ context }).is({ subject: procedure }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "QUESTION_SUBJECT_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "procedure", "context", "text"],
    ["user", "workspace", "procedure", "context", "text"],
    { text: 1_000 },
  ),
);

const AnswerStepQuestion = endpoint(
  "/workspaces/questions/steps/answer",
  ({ user, workspace, question, step, procedure, answer }) =>
    receive({ user, workspace, question, answer })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "ANSWER_QUESTION",
          command: "ANSWER_STEP_QUESTION",
        }).responds({}),
      )
      .then(
        where(
          StepQuestioning._get({ question }).is({ subject: step, status: "OPEN" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace }),
        )
          .then(StepQuestioning.answer({ question, answer }))
          .then(respond({ question, status: "ANSWERED" }))
          .named("question-in-workspace"),
        where(no(StepQuestioning._get({ question }).is({ status: "OPEN" })))
          .then(respond({ error: "QUESTION_NOT_AVAILABLE" }))
          .named("question-unavailable"),
        where(
          StepQuestioning._get({ question }).is({ subject: step, status: "OPEN" }),
          ProcedureMaintaining._getStep({ step }).is({ procedure }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace })),
        )
          .then(respond({ error: "QUESTION_NOT_AVAILABLE" }))
          .named("question-outside-workspace"),
      ),
  stringInput(
    ["user", "workspace", "question", "answer"],
    ["user", "workspace", "question", "answer"],
    { answer: 2_000 },
  ),
);

const AnswerContextQuestion = endpoint(
  "/workspaces/questions/context/answer",
  ({ user, workspace, question, context, answer }) =>
    receive({ user, workspace, question, answer })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "ANSWER_QUESTION",
          command: "ANSWER_CONTEXT_QUESTION",
        }).responds({}),
      )
      .then(
        where(
          ContextQuestioning._get({ question }).is({ subject: context, status: "OPEN" }),
          ContextTracking._get({ context }).is({ scope: workspace }),
        )
          .then(ContextQuestioning.answer({ question, answer }))
          .then(respond({ question, status: "ANSWERED" }))
          .named("question-in-workspace"),
        where(no(ContextQuestioning._get({ question }).is({ status: "OPEN" })))
          .then(respond({ error: "QUESTION_NOT_AVAILABLE" }))
          .named("question-unavailable"),
        where(
          ContextQuestioning._get({ question }).is({ subject: context, status: "OPEN" }),
          no(ContextTracking._get({ context }).is({ scope: workspace })),
        )
          .then(respond({ error: "QUESTION_NOT_AVAILABLE" }))
          .named("question-outside-workspace"),
      ),
  stringInput(
    ["user", "workspace", "question", "answer"],
    ["user", "workspace", "question", "answer"],
    { answer: 2_000 },
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
          permission: "ASK_QUESTION",
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
          permission: "ASK_QUESTION",
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

const GetQuestions = endpoint(
  "/workspaces/questions",
  ({ user, workspace }) =>
    receive({ user, workspace })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "ASK_QUESTION",
          command: "GET_QUESTIONS",
        }).responds({}),
      )
      .then(
        respond({
          stepQuestions: WorkspaceStepQuestions({ workspace }),
          contextQuestions: WorkspaceContextQuestions({ workspace }),
        }),
      ),
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

const RequireReviewChanges = endpoint(
  "/workspaces/reviews/require-changes",
  ({ user, workspace, review, procedure }) =>
    receive({ user, workspace, review, procedure })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "COMPLETE_REVIEW",
          command: "REQUIRE_REVIEW_CHANGES",
        }).responds({}),
      )
      .then(
        where(
          Reviewing._get({ review }).is({ item: procedure, status: "PENDING" }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
        )
          .then(Reviewing.requireChanges({ review }))
          .then(respond({ review, status: "CHANGES_REQUIRED" }))
          .named("review-in-workspace"),
        where(
          Reviewing._get({ review }).is({ item: procedure, status: "PENDING" }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(no(Reviewing._get({ review }).is({ item: procedure, status: "PENDING" })))
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("review-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "review", "procedure"],
    ["user", "workspace", "review", "procedure"],
  ),
);

const ResolveReview = endpoint(
  "/workspaces/reviews/resolve",
  ({ user, workspace, review, procedure }) =>
    receive({ user, workspace, review, procedure })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "COMPLETE_REVIEW",
          command: "RESOLVE_REVIEW",
        }).responds({}),
      )
      .then(
        where(
          Reviewing._get({ review }).is({ item: procedure, status: "CHANGES_REQUIRED" }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" }),
        )
          .then(Reviewing.resolve({ review }))
          .then(respond({ review, status: "COMPLETE" }))
          .named("review-in-workspace"),
        where(
          Reviewing._get({ review }).is({ item: procedure, status: "CHANGES_REQUIRED" }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace, status: "ACTIVE" })),
        )
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("procedure-unavailable"),
        where(no(Reviewing._get({ review }).is({ item: procedure, status: "CHANGES_REQUIRED" })))
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("review-unavailable"),
      ),
  stringInput(
    ["user", "workspace", "review", "procedure"],
    ["user", "workspace", "review", "procedure"],
  ),
);

const CancelReview = endpoint(
  "/workspaces/reviews/cancel",
  ({ user, workspace, review, procedure }) =>
    receive({ user, workspace, review, procedure })
      .then(
        RoleBasedAccessing.authorize({
          user,
          resource: workspace,
          permission: "COMPLETE_REVIEW",
          command: "CANCEL_REVIEW",
        }).responds({}),
      )
      .then(
        where(
          Reviewing._unfinished({}).is({ review, item: procedure }),
          ProcedureMaintaining._get({ procedure }).is({ space: workspace }),
        )
          .then(Reviewing.cancel({ review }))
          .then(respond({ review, status: "CANCELLED" }))
          .named("review-in-workspace"),
        where(
          Reviewing._unfinished({}).is({ review, item: procedure }),
          no(ProcedureMaintaining._get({ procedure }).is({ space: workspace })),
        )
          .then(respond({ error: "REVIEW_NOT_AVAILABLE" }))
          .named("procedure-outside-workspace"),
        where(no(Reviewing._unfinished({}).is({ review, item: procedure })))
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
    StepRemoval: { DetachRemovedStepContext },
    ProcedureOperations: {
      CreateProcedure,
      AddStep,
      RenameProcedure,
      EditStep,
      MoveStep,
      RemoveStep,
      ArchiveProcedure,
    },
    ContextOperations: {
      RecordContextNote,
      AttachContextNote,
      AttachContextNoteAtStep,
      CorrectContextNote,
      ChangeContextNote,
    },
    QuestionOperations: {
      AskStepQuestion,
      AskContextQuestion,
      AnswerStepQuestion,
      AnswerContextQuestion,
    },
    ReviewOperations: { ConfirmReview, RequireReviewChanges, ResolveReview, CancelReview },
    ReadOperations: {
      ListProcedures,
      GetContextHistory,
      GetPendingReviews,
      GetReviewHistory,
      GetQuestions,
    },
    Reads: {
      WorkspaceProcedures,
      WorkspaceContextHistory,
      PendingReviews,
      WorkspaceReviewHistory,
      WorkspaceStepQuestions,
      WorkspaceContextQuestions,
    },
  },
};
