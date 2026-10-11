import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/RoleBasedAccessing.md" with { type: "text" };
import {
  AssignmentAlreadyExists,
  AssignmentNotFound,
  NotAuthorized,
  PermissionAlreadyGranted,
  PermissionNotGranted,
  RoleBasedAccessingConcept,
  RoleInUse,
  RoleNameAlreadyExists,
  RoleNotFound,
} from "./RoleBasedAccessing.ts";

export const roleBasedAccessing = registerConcept({
  class: RoleBasedAccessingConcept,
  spec,
  refusals: {
    ROLE_NAME_ALREADY_EXISTS: RoleNameAlreadyExists,
    ROLE_NOT_FOUND: RoleNotFound,
    ROLE_IN_USE: RoleInUse,
    PERMISSION_ALREADY_GRANTED: PermissionAlreadyGranted,
    PERMISSION_NOT_GRANTED: PermissionNotGranted,
    ASSIGNMENT_ALREADY_EXISTS: AssignmentAlreadyExists,
    ASSIGNMENT_NOT_FOUND: AssignmentNotFound,
    NOT_AUTHORIZED: NotAuthorized,
  },
});
