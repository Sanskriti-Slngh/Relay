import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/ContextTracking.md" with { type: "text" };
import {
  AttachmentAlreadyExists,
  AttachmentNotFound,
  ChangeNotDifferent,
  ContextNotFound,
  ContextTrackingConcept,
  VersionConflict,
} from "./ContextTracking.ts";

export const contextTracking = registerConcept({
  class: ContextTrackingConcept,
  spec,
  refusals: {
    CONTEXT_NOT_FOUND: ContextNotFound,
    ATTACHMENT_ALREADY_EXISTS: AttachmentAlreadyExists,
    ATTACHMENT_NOT_FOUND: AttachmentNotFound,
    CHANGE_NOT_DIFFERENT: ChangeNotDifferent,
    VERSION_CONFLICT: VersionConflict,
  },
});
