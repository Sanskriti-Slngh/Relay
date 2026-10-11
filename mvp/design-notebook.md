# Relay — P2 Design Notebook

## October 10, 2026 — Increment 0: Setting Up the Development Environment

I started P2 by reorganizing my Relay repository. I moved my P1 design documents, specifications, and UI sketches into a `design/` folder and created a separate `mvp/` folder for implementation-related work.

My first challenge was that the sync-engine setup command expects an empty directory, but my repository already contained my P1 work. Rather than risk modifying those files, I ran the setup command in a temporary directory and copied the generated starter files into my repository.

I also encountered a path error when copying the files because I initially used the placeholder path from the instructions. After checking my local directories, I found the correct repository location at `~/campusmap` and copied the files there.

The setup generated the initial TypeScript configuration and sync-engine application files. I also verified that Bun and Podman were installed.

I decided to focus only on the development environment for this increment instead of immediately implementing the full application. This will let me check each concept separately before connecting them through reactions and the frontend.

**Next:** Verify the framework dependencies in the project repository, then bring my P1 concept specifications into the structure required by sync-engine.

## October 11, 2026 — Increment 1: Converting ProcedureMaintaining

I started converting my P1 concept specifications into the format required by sync-engine, beginning with `ProcedureMaintaining`. I chose this concept first because the rest of Relay depends on having Playbooks and Steps to attach information to.

The main change was making failure cases explicit. My original specification described when an action could succeed, but the new version also states what should happen when someone tries to edit a removed Step, modify a retired Procedure, or move a Step to an invalid position. I added refusal codes and messages for these cases.

I also added queries for retrieving Playbooks and their ordered Steps. These will be needed by the frontend but don't change the underlying concept behavior.

I kept the original decision to preserve removed Steps instead of deleting them. This means other concepts can continue referring to the same Step identity even after it is removed from the active procedure.

**Verification:** Ran `bunx sync-engine check-design design/concepts/ProcedureMaintaining.md`, which passed for one file. This confirms the specification's format, but the behavior has not been implemented or tested yet.

**Next:** Convert the remaining concepts and check that their specifications preserve the intended boundaries from P1.

### Converting ContextTracking

I converted `ContextTracking` into the sync-engine specification format. This concept is central to Relay because it stores shared Context Notes, the procedures that depend on them, and a record of meaningful changes.

I preserved the distinction between `correct` and `change`. A correction updates the wording without creating a Change record, while a meaningful change saves both the previous and new text. This matters because only meaningful changes should trigger reviews.

I added explicit refusal cases for nonexistent Context Notes, duplicate attachments, and changes that leave the text unchanged. I also added queries for retrieving Context Notes, their attachments, and their change history.

I kept `Scope`, `Subject`, and `Anchor` as external types. This lets ContextTracking represent dependencies without knowing what kind of objects depend on the information. The reactions will later connect these dependencies to the review process.

**Verification:** The sync-engine design checker passed for `ContextTracking.md`. The concept has not yet been implemented or behaviorally tested.

### Converting Reviewing

I converted `Reviewing` into the sync-engine specification format. This concept manages the review lifecycle separately from the information that caused the review.

I preserved the decision to allow only one unfinished Review per item while storing multiple causes within that Review. This matters when several Context Notes change before an officer has reviewed a Playbook. Rather than creating duplicate reviews or losing information, Relay keeps one review with every distinct reason attached.

I added explicit refusal cases for invalid state transitions, such as confirming a completed Review or adding the same cause twice. I also added queries for retrieving unfinished Reviews, finding Reviews associated with an item, and inspecting the causes of a Review.

I kept `Item` and `Cause` as external types so Reviewing doesn't need to know about Procedures or Context Notes. Reactions will connect those concepts later.

**Verification:** Ran `bunx sync-engine check-design design/concepts/Reviewing.md`, which passed for one file. The concept's behavior has not yet been implemented or tested.

**Next:** Convert RoleBasedAccessing to support the access controls required by the MVP.

### Converting RoleBasedAccessing

I converted `RoleBasedAccessing` into the sync-engine specification format. This concept determines which users are allowed to perform protected operations within a workspace.

I preserved the original design of assigning permissions to roles rather than individual users. This allows Relay to distinguish between officers, who can maintain official knowledge, and members, who have more limited permissions, without putting role-specific logic inside every concept.

During the conversion, the design checker reported an error in the `authorize` action's return syntax. I corrected the declaration and reran the checker successfully.

One important distinction is that authorization does not establish a user's identity. `RoleBasedAccessing` can determine whether a known user has permission, but the application must first establish that identity through a trusted authentication mechanism. I will need to address this when implementing the endpoints.

I also need to ensure that ordinary users cannot assign themselves elevated roles. Role administration should be accessible only through trusted setup or protected administrative operations.

**Verification:** Ran `bunx sync-engine check-design design/concepts/RoleBasedAccessing.md`, which passed. Authentication and access-control enforcement have not yet been implemented or tested.

**Next:** Complete the remaining MVP design specifications and configure the application composition.

### Defining Application Types

After converting the four MVP concepts, I created `design/types.md` to specify how their external types relate to one another.

The main decision was to share identities rather than duplicate state. `ContextTracking.Subject` refers to a Procedure, and its optional `Anchor` refers to a Step. Similarly, `Reviewing.Item` refers to a Procedure, while `Reviewing.Cause` refers to a Change recorded by ContextTracking.

This allows a Review to identify which procedure needs attention and why, without requiring Reviewing to know how procedures or context changes are represented internally.

I also introduced `ClubWorkspace` as the shared scope for procedures, context, and role assignments.

One limitation I noticed is that sync-engine's application type declarations do not directly enforce Relay's list of permission values. The permitted values are documented for now, but the implementation will need to handle permission values consistently and enforce authorization through a trusted backend boundary.

**Verification:** Ran the sync-engine design checker on all four concept specifications and `design/types.md`. The check passed for five files. Full application assembly and integration are not yet verified.

**Next:** Define the composition that connects ContextTracking changes to Reviewing and exposes the operations needed by the MVP.

### Defining the Relay Composition

I created `Relay.md` to describe how the four MVP concepts will work together. The main challenge was connecting a meaningful Context Note change to the review process without making the concepts depend directly on one another.

I kept two separate reactions: one creates a Review when a dependent Procedure has no unfinished Review, and the other adds a new cause when an unfinished Review already exists. This preserves the design decision from P1 to avoid duplicate Reviews while retaining every reason a Procedure needs attention.

I also considered how to start the application from an empty database. Since the concepts don't create workspace identities or authenticate users, I documented the need for trusted workspace provisioning and initial officer setup. I chose not to expose role creation or assignment through public endpoints, since that could allow users to grant themselves permissions.

The composition uses existing editing permissions for read access during the officer-only MVP. This is sufficient for the current journey, but I may introduce separate read permissions when member access is implemented.

**Verification:** Ran `bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md`, which passed for six files. This confirms the specification format, but not reaction execution, duplicate handling, or authorization security.

**Next:** Verify how sync-engine handles multiple dependency matches and select a concrete authentication and initial-workspace setup approach before implementing the application.

### Checking Reaction Execution and Review Uniqueness

While reviewing the composition, I realized I had assumed that attaching one Context Note to multiple Steps of the same Procedure would automatically produce only one Review. I checked sync-engine's execution semantics before implementing the reactions.

I learned that sync-engine deduplicates identical fills from a `many` query, but this depends on which variables the reaction binds. If I bind only the Procedure identity, multiple attachments to that Procedure can produce one matching fill. If I also bind distinct Step or Attachment identities, they can produce separate firings.

More importantly, this does not guarantee exactly-once execution. I decided that the `Reviewing` concept itself must enforce the invariant of at most one unfinished Review per Procedure. The MongoDB implementation will need an atomic check or uniqueness constraint so overlapping requests cannot create duplicates.

I also learned that sibling reaction work may continue after an endpoint sends its response. For operations where the frontend needs the resulting Reviews to be ready immediately, I plan to use the framework's documented flow-settlement mechanism.

**Verification:** Reviewed the sync-engine 1.1.0 execution semantics and identified the relevant concurrency and response-ordering guarantees. These decisions still need to be verified through implementation tests.

**Next:** Finalize the composition and proceed to implementing the first concept.

