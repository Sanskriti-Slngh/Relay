import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Questioning.md" with { type: "text" };
import { QuestioningConcept, QuestionNotFound, QuestionNotOpen } from "./Questioning.ts";

export const questioning = registerConcept({
  class: QuestioningConcept,
  spec,
  refusals: {
    QUESTION_NOT_FOUND: QuestionNotFound,
    QUESTION_NOT_OPEN: QuestionNotOpen,
  },
});
