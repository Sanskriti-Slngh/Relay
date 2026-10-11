import { no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { ContextTracking, ProcedureMaintaining, Reviewing } = concepts;

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

// A Review may finish after this read; addCause then refuses and is not retried.
const AddCauseAfterConcurrentRequestRefusal = reaction(({ item, cause, review }) =>
  when(Reviewing.request({ item, cause }).refuses({ error: "REQUEST_ALREADY_UNFINISHED" }))
    .where(Reviewing._unfinished({}).is({ item, review }))
    .then(Reviewing.addCause({ review, cause })),
);

export const composition = {
  Relay: {
    ContextChanges: {
      RequestReview,
      AddChangeCause,
      AddCauseAfterConcurrentRequestRefusal,
    },
  },
};
