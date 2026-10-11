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

## October 11, 2026 — Increment 2: Implementing ProcedureMaintaining

I began backend implementation with `ProcedureMaintaining` because the rest of Relay relies on having Procedures and Steps with stable identities.

My plan is to first establish the MongoDB connection, then implement the concept's actions and queries, and finally test its invariants and refusal cases before integrating it with other concepts.

I want to verify the database separately from the concept logic so that if something fails later, I can distinguish a connection problem from an error in my implementation.

**Verification:** Pending.

**Next:** Set up and test the local MongoDB connection.

### Step 2.1 — Setting Up MongoDB

I started backend implementation by setting up MongoDB separately from the concept logic. I created a reusable database connection in `src/db.ts`, configured MongoDB through Podman Compose, and added scripts to start the database and verify its connection.

I ran into a port conflict because my existing MongoDB practice container was already using port 27017. Rather than stopping that container or resetting its data, I configured Relay to use port 27018. This allowed both environments to remain independent.

I also kept the MongoDB connection string in `.env` and added an `.env.example` file so the local setup can be reproduced without committing environment-specific configuration.

**Verification:** Ran `bun run db:up` and `bun run db:check`. The database container started successfully, and the connection check printed `MongoDB connection successful: relay`. The agent also reported successful TypeScript, Compose configuration, and specification-format checks.

Separating database setup from concept implementation made it easier to verify that the connection worked before introducing application logic.

### Step 2.2a — Enabling MongoDB Transactions

While implementing ProcedureMaintaining, I discovered that my local MongoDB setup did not support the multi-document transactions needed to update Step positions safely.

I considered simplifying the implementation to use individual updates, but that could leave Steps in an inconsistent order if an operation failed halfway through. Instead, I decided to preserve the transactional approach and update the development environment.

I configured MongoDB as a single-node replica set named `rs0`, keeping port 27018 to avoid interfering with my existing MongoDB practice environment. I also added an initialization service so the replica set can be started reproducibly without resetting the database.

To verify the change, I tested an actual transaction that inserted documents into two collections. Both writes committed successfully, confirming that the database supports the operations needed for Step reordering.

**Verification:** The replica set reported itself as PRIMARY, the multi-document transaction committed successfully, and TypeScript and Compose checks passed. The original MongoDB data volume was preserved.

**Next:** Test ProcedureMaintaining's actions, failure cases, and Step-ordering invariants against the transaction-enabled database.

### Step 2.3 — Testing ProcedureMaintaining

After implementing ProcedureMaintaining, I wrote an automated test suite to check its actions, refusal cases, and Step-ordering invariants.

One issue I encountered was test isolation. The original implementation used MongoDB collections defined at the module level, which meant the tests would use the same database as the application. I changed the concept constructor to accept an optional database and MongoDB client, while keeping the application's existing connection as the default.

This let me test the real concept against a separate database without changing production data. Each test creates its setup through concept actions rather than manually inserting documents.

I focused on testing behavior that could easily break, especially Step reordering and removal. The tests check that positions remain consecutive, Step identities are preserved, removed Steps remain accessible, and invalid operations are refused without changing the observable state.

I also tested eight concurrent Step additions. All completed successfully, and the resulting Steps had distinct identities and positions from 1 through 8. This gave me more confidence in the transaction-based ordering approach, although one successful concurrency test cannot rule out every possible race condition.

**Verification:** `bun run test` passed with 12 tests, 54 assertions, and no failures. TypeScript checking and `git diff --check` also passed. Tests used an isolated database and cleaned it up afterward.

**Next:** Register ProcedureMaintaining with sync-engine and check that the implementation matches its formal specification.

## October 11, 2026 — Increment 3: ContextTracking

After completing ProcedureMaintaining, I began implementing ContextTracking, which will manage shared Context Notes and their dependencies.

The main design decision is to distinguish corrections from meaningful changes. A correction updates the wording of a note without creating a Change record, while a meaningful change preserves both the previous and updated text. Later, this distinction will determine whether Relay asks officers to review dependent Playbooks.

I also need to prevent duplicate attachments and ensure that overlapping edits cannot produce an incorrect change history.

I am implementing ContextTracking independently so I can test its behavior before connecting it to ProcedureMaintaining and Reviewing through composition reactions.

**Verification:** Pending implementation and tests.

**Next:** Implement ContextTracking's actions and queries with MongoDB.

### Step 3.1 — Implementing ContextTracking

I implemented ContextTracking using three MongoDB collections: ContextNotes, Attachments, and Changes. The concept has six actions and six queries and uses the same database-injection approach as ProcedureMaintaining.

The most important decision was how to handle corrections differently from meaningful changes. A correction updates the current text without preserving a Change record. A meaningful change updates the text and creates a record containing the exact previous and new versions.

To prevent concurrent updates from producing incorrect history, I placed the note update and Change creation in one MongoDB transaction. This lets overlapping changes conflict and retry against the latest committed text.

I also used a unique compound index on the Context Note, subject, and optional anchor to prevent duplicate attachments, including when two requests occur concurrently.

One limitation I noticed is that Change records currently use UUID identities, so sorting by identity does not establish chronological order. I will avoid assuming that the query returns a timeline until ordering is explicitly designed and tested.

**Verification:** TypeScript checking and `git diff --check` passed. Runtime behavior and concurrency still need to be tested.

**Next:** Write isolated tests for corrections, changes, attachments, refusal cases, and overlapping writes.

### Step 3.2 — Testing ContextTracking

I wrote 11 tests for ContextTracking, bringing the total backend test suite to 23 tests.

I focused on the distinction between corrections and meaningful changes because this is central to Relay's design. The tests verify that corrections update note text without creating history, while meaningful changes preserve the exact before and after values.

I also tested attachments with and without Step anchors, duplicate attachment refusals, detachment, missing Context Notes, and unchanged-text refusals.

The most interesting test was concurrent changes. I ran eight changes at the same time and verified that their history forms a complete before/after chain ending at the current note text. This checks that overlapping operations do not all record the same outdated text.

During the first test run, two assertions incorrectly assumed that query results would follow creation order. I revisited the specification and changed the tests to respect identity ordering instead. This reminded me that tests should verify the actual contract rather than assumptions about how data happens to be returned.

**Verification:** All 23 tests passed, including 11 ContextTracking tests and 12 ProcedureMaintaining tests. TypeScript checking passed. Tests used separate databases and cleaned up afterward. No production code changes were necessary.

**Next:** Register ContextTracking with sync-engine and verify that its implementation matches the formal specification.

### Step 3.3 — Registering ContextTracking

After completing ContextTracking's tests, I registered it with sync-engine alongside ProcedureMaintaining.

The main design choice was preserving the relationship between concepts without introducing direct dependencies. I configured ContextTracking's Subject type to refer to a Procedure identity and its Anchor type to refer to a Step identity. ContextTracking itself still does not need to know how Procedures and Steps are represented.

I also updated the temporary application inventory to include exactly the two implemented concepts. I kept the complete Relay design unchanged so that the final application can include Reviewing and RoleBasedAccessing later.

All 23 direct tests passed, with 132 assertions. TypeScript checking passed, and sync-engine successfully checked both concept implementations with zero advisories.

**Verification:** The two-concept assembly passed sync-engine's source and application diagnostics. The complete Relay application and composition reactions have not yet been validated.

**Next:** Commit the completed ContextTracking increment and begin implementing Reviewing.

## October 11, 2026 — Increment 4: Reviewing

I began implementing Reviewing after completing ProcedureMaintaining and ContextTracking.

The main design challenge is enforcing that each Procedure has at most one unfinished Review. If several pieces of shared context change before an officer addresses the Procedure, Relay should collect those changes as Causes of one Review rather than create several separate Reviews.

I plan to enforce this invariant in Reviewing's MongoDB storage rather than relying only on reaction conditions. This matters because concurrent requests could otherwise create duplicate pending Reviews.

I will also implement the Review lifecycle, including confirming a Review, requiring changes, resolving it, and cancelling it. The concept should remain independent of both Procedures and Context Notes: it stores Item and Cause identities without needing to know their internal representations.

**Verification:** Pending implementation and tests.

**Next:** Implement Reviewing's actions, queries, lifecycle checks, and atomic uniqueness constraint.

### Step 4.1 — Implementing Reviewing

I implemented Reviewing as an independent MongoDB-backed concept with six actions and four queries. It stores the Procedure identity as an Item and the Context Change identity as a Cause, without needing to know either concept's internal representation.

The main challenge was ensuring that a Procedure never has more than one unfinished Review. A normal check before inserting would be vulnerable to concurrent requests, so I used a partial unique MongoDB index on Item for Reviews whose status is PENDING or CHANGES_REQUIRED.

I also needed to preserve multiple reasons for a Review. I used MongoDB's atomic `$addToSet` operation so concurrent additions of different Causes cannot overwrite each other, while duplicate Causes are rejected.

For lifecycle transitions, I used conditional updates that only succeed from the allowed starting status. This prevents two simultaneous operations from both applying incompatible transitions.

**Verification:** TypeScript compilation and Git whitespace checking passed. The implementation has not yet been tested against MongoDB.

**Next:** Test Review uniqueness, accumulating Causes, legal and illegal lifecycle transitions, and concurrent operations.

### Step 4.2 — Testing Reviewing

I implemented 14 tests for Reviewing, bringing the total backend test suite to 37 tests.

I focused on the unfinished-Review invariant because it is one of the most important guarantees in Relay. The tests verify that a Procedure can have only one unfinished Review, but can have another Review after the previous one is completed or cancelled.

I tested the full Review lifecycle, including confirming, requiring changes, resolving, and cancelling Reviews. I also checked that illegal operations return the expected refusal errors without changing stored state.

The most useful tests involved concurrency. Eight simultaneous requests for the same Item produced exactly one Review. Eight different Causes added concurrently were all retained, while simultaneous attempts to add the same Cause resulted in only one addition. I also raced two incompatible lifecycle transitions and verified that only one succeeded.

These tests helped confirm that the partial unique index, atomic Cause updates, and conditional status changes behave correctly against MongoDB.

**Verification:** All 37 tests passed with 237 assertions and no failures. TypeScript and Git whitespace checks passed. The Reviewing tests used an isolated database and did not modify application data. No production changes were necessary.

**Next:** Register Reviewing with sync-engine and extend the incremental assembly to three concepts.

### Step 4.3 — Registering Reviewing

After testing Reviewing independently, I registered it with sync-engine alongside ProcedureMaintaining and ContextTracking.

I updated the incremental application types to connect Reviewing's Item identity to a Procedure and its Cause identity to a ContextTracking Change. This maintains the separation between concepts while allowing the eventual composition to coordinate them.

I also registered all twelve specified refusal codes and expanded the assembly to include Reviewing using the existing MongoDB connection.

The framework initially supported only the concepts selected in the incremental inventory, so I replaced the previous two-concept inventory with a temporary three-concept version. I preserved the full application specification for later integration.

**Verification:** All 37 tests passed with 237 assertions. TypeScript checking passed, and sync-engine validated all three registered concepts with zero advisories.

**Next:** Commit Reviewing and implement RoleBasedAccessing, the final independent concept needed before composing the complete application.

## October 11, 2026 — Increment 5: RoleBasedAccessing

I began implementing RoleBasedAccessing, the final independent concept in Relay's MVP.

This concept manages Roles, Permissions, and Assignments for a particular Resource. I want it to remain reusable, so it should not need to know what a Playbook or Context Note is. Instead, Relay will use club workspaces as Resources and map application operations to Permissions.

The main challenge is avoiding unauthorized access. Role names and assignments must be unique, and authorization should succeed only when the requested User has the necessary Permission for the specified Resource.

I am keeping authentication separate from authorization. RoleBasedAccessing can decide whether an established User has permission, but it cannot determine whether an incoming HTTP request genuinely belongs to that User. That identity must come from a trusted application boundary during integration.

I will also need a controlled way to establish the first Officer without exposing unrestricted Role creation or Assignment actions publicly.

**Verification:** Pending implementation and tests.

**Next:** Implement the independent concept and test its authorization rules, refusal cases, and concurrent updates.

### Step 5.1 — Implementing RoleBasedAccessing

I implemented RoleBasedAccessing to manage Roles, Permissions, and Assignments independently from Relay's other concepts.

I used unique MongoDB indexes to prevent duplicate Role names and duplicate assignments for the same User, Resource, and Role. I also used transactions and coordination updates on Role documents to prevent concurrent assignment changes and Role deletion from leaving inconsistent state.

One implementation issue was that MongoDB's TypeScript definitions rejected the initial `$pull` operation for revoking a permission. Instead of using an unsafe read-modify-write workaround, I changed the operation to an atomic update pipeline that filters out the requested permission.

Authorization checks that a User has an assigned Role containing the requested Permission for the specific Resource. If authorized, it returns the original Command unchanged; otherwise, it refuses the operation.

I kept authentication outside this concept. RoleBasedAccessing checks permissions but does not verify who is making a request. The application will need a trusted identity boundary and controlled initial Officer setup.

**Verification:** TypeScript compilation and Git whitespace checks passed. Authorization behavior and concurrent operations still need runtime tests.

**Next:** Test permission grants, revocations, resource isolation, Role deletion, refusal conditions, and concurrent authorization changes.

### Step 5.2 — Testing RoleBasedAccessing

I added 17 tests for RoleBasedAccessing, bringing the full backend test suite to 54 tests.

I focused on making sure permissions are enforced for the correct User and Resource. The tests check that users without the required Role or Permission are denied, and that having access to one club workspace does not automatically grant access to another.

I also tested Role creation, permission grants and revocations, assignments, deletion restrictions, and refusal cases. Successful authorization preserves the original Command value unchanged.

The most interesting cases involved concurrency. Eight simultaneous attempts to create the same Role name or Assignment each produced exactly one success. I also tested Role deletion against assignment, authorization against permission revocation, and simultaneous changes to different Permissions. The observed results preserved the expected constraints.

I used an isolated MongoDB database so the tests would not change the actual Relay application data.

**Verification:** All 54 tests passed with 320 assertions and no failures. TypeScript and whitespace checks passed. No production code changes were needed.

**Next:** Register RoleBasedAccessing with sync-engine and validate all four concepts together.

### Step 5.3 — Registering RoleBasedAccessing

I registered RoleBasedAccessing as the fourth independent concept in Relay. I mapped all eight specified refusal codes to the corresponding TypeScript error classes and added the concept to the existing assembly.

This also let me return to the original full application type inventory. During earlier increments, I used temporary inventories containing only the concepts implemented so far. Now that all four concepts exist, `design/types.md` can be used directly without removing any of the intended cross-concept identity relationships.

The main architectural result is that Relay now has four independent concepts that can be coordinated through composition reactions. Each concept owns its own MongoDB state, and the application assembly provides the shared identities needed to connect them.

**Verification:** All 54 tests passed with 323 assertions. TypeScript passed, sync-engine checked all four concepts with zero advisories, and the six design files passed format validation.

The current application assembly still has an empty composition. This means the concepts work independently, but the complete Relay workflow, HTTP access, and trusted Officer setup remain unimplemented.

**Next:** Commit the four-concept backend and begin integrating the MVP workflow through composition reactions.

### Step 6.1 — Investigating Composition Reactions

Before implementing cross-concept behavior, I reviewed sync-engine's reaction and execution semantics to understand what guarantees the framework actually provides.

I found that a reaction can observe a successful ContextTracking change, read its attachments, check whether the related Procedure is active, and either request a new Review or add a Cause to an existing unfinished Review.

One important detail is that attachment queries produce distinct matches based on which values the reaction binds. I plan to bind only the Procedure identity so that attaching one Context Note to multiple Steps of the same Procedure does not create unnecessary duplicate Review requests.

I also investigated concurrency. Reviewing already enforces one unfinished Review per Procedure using a MongoDB constraint, but composition-level checks can become outdated between reading and acting. I plan to handle duplicate-request refusals through a recovery reaction.

A remaining limitation is that a Review might finish between being found and receiving a new Cause. Sync-engine does not automatically guarantee exactly-once execution or eventual success under arbitrary concurrent changes. I will test the normal concurrent cases and avoid claiming stronger guarantees than the framework provides.

**Verification:** Reviewed the installed sync-engine 1.1.0 reaction, read-matching, refusal, and flow-settlement documentation and examples. No implementation files were changed.

**Next:** Implement the minimal ContextTracking-to-Reviewing reactions and validate them independently before adding public endpoints.

### Step 6.2 — Implementing Context Change Reactions

I implemented Relay's first three internal composition reactions.

When a Context Note changes, the composition finds its attached active Procedures. If a Procedure has no unfinished Review, it requests one. Otherwise, it adds the Change as another Cause.

I also added a recovery reaction for a concurrent request that is refused because an unfinished Review already exists. This attempts to attach the Change to that Review instead of losing it.

The reactions bind only Procedure identities from attachments, so multiple attachments to Steps of the same Procedure do not create separate matches.

An important limitation is that a Review can finish between being found and receiving a Cause. The current recovery reaction does not guarantee eventual delivery under every possible race.

**Verification:** TypeScript and whitespace checks passed. Sync-engine diagnostics reported three missing composition-design coverage links. No application database operations or runtime integration tests were performed.

**Next:** Align the formal composition design and diagnostic configuration with the three implemented reactions, then test the assembled application.

### Step 6.2b — Aligning Reactions with the Formal Design

After implementing the first composition reactions, sync-engine reported three missing design coverage links.

The executable reaction names did not have complete coverage in the configured design documents. I updated `generated.config.ts` to include the Relay composition design and added a formal link documenting recovery from `REQUEST_ALREADY_UNFINISHED`.

I preserved the existing descriptions of the other two reactions and did not remove any planned endpoint declarations.

**Verification:** TypeScript and whitespace checks passed. The configured sync-engine check now passes without the three missing coverage diagnostics. A separate full design check still reports 16 unresolved links or endpoints associated with application functionality that has not been implemented.

**Next:** Test the actual reaction behavior using an assembled sync-engine application with an isolated MongoDB database, before implementing HTTP endpoints.

### Step 6.3 — Integration Testing the Context Change Reactions

I added integration tests that assemble all four Relay concepts with the real sync-engine composition and an isolated MongoDB database.

The main test creates two active Procedures connected to one shared Context Note. Changing that note creates a pending Review for each Procedure, both referencing the correct Change. I also verified that retired Procedures are skipped, corrections do not trigger Reviews, and subsequent changes accumulate Causes without replacing unfinished Reviews.

The concurrency test uncovered a real integration bug. Four simultaneous Context Changes initially produced only three Review Causes. The two reactions could independently observe different Review states, leaving one Change unmatched.

I updated the add-Cause reaction to defer its query until the triggering flow's ordinary work settles, using `afterFlowSettles()`. I also added a condition to avoid adding Causes that are already present. The integration test then passed with all four Causes retained.

The test invokes actions through the assembled sync-engine application and uses `application.whenIdle()` before checking the resulting state.

**Verification:** All 57 tests passed with 348 assertions. TypeScript and whitespace checks passed. The tests used an isolated MongoDB database that was removed afterward.

**Remaining limitations:** The request-refusal recovery branch was monitored but not triggered. The composition does not guarantee eventual Cause delivery under every possible race or failure. Sync-engine design diagnostics still report 16 unresolved links associated with planned endpoints and read formers.

**Next:** Verify reaction behavior across repeated runs, then implement the protected application endpoint layer.

### Step 6.3b — Concurrency Regression Verification

After finding and fixing a concurrency issue in the composition reactions, I reran the integration suite ten separate times.

Every run passed all three integration tests with 28 assertions. The concurrent scenario consistently retained four distinct Context Changes as Causes of exactly one unfinished Review.

The tests use the assembled sync-engine application, wait for tracked work through `application.whenIdle()`, and use a fresh isolated MongoDB database for each run.

I also checked the documented behavior of `afterFlowSettles()`. It waits for tracked ordinary work within the triggering flow, not all independent concurrent flows. The successful repeated runs therefore support the specific tested behavior but do not prove that Causes can never be lost under arbitrary scheduling or failures.

The `REQUEST_ALREADY_UNFINISHED` recovery reaction was not confirmed as exercised. It remains a separate test and reliability concern.

**Verification:** Ten integration runs passed. The complete backend suite passed 57 tests with 351 assertions. TypeScript and Git whitespace checks passed.

**Next:** Commit the completed internal composition work and begin implementing a trusted application identity boundary before exposing protected operations.

### Step 7.1 — Investigating Trusted Identity and Hosting

Before exposing Relay through HTTP, I investigated how sync-engine handles requests and whether it provides authentication.

I found that sync-engine supports HTTP hosting through a gateway and Fetch handler, but does not automatically establish a trustworthy caller identity. RoleBasedAccessing can check permissions, but the application must first determine which User is making the request.

For the P2 MVP, I chose a local single-officer architecture. The Bun host will use one configured workspace and officer identity, and the server will control these values rather than trusting identities submitted by the browser.

The host will also provision the initial Officer Role and grant EDIT_PROCEDURE, EDIT_CONTEXT, and COMPLETE_REVIEW permissions before serving requests. Role creation and assignment will remain private operations.

I decided that missing configuration or inconsistent provisioning should prevent the server from starting rather than silently create an insecure fallback.

The investigation also identified the remaining formal design gaps: eleven endpoint declarations, two endpoint-reaction links, and three read-former links.

**Verification:** Read-only investigation of the installed sync-engine and HTTP documentation. No code changes, server startup, or database writes.

**Next:** Implement and test host configuration validation before introducing provisioning or publicly accessible routes.

### Step 7.2 — Validating Host Configuration

I implemented a host configuration validator to establish Relay's workspace and officer identities through server-controlled configuration rather than browser input.

The validator requires a stable ClubWorkspace ID, Officer User ID, local access credential, and MongoDB URL. It rejects missing values, malformed identities, obvious placeholders, weak-looking credentials, and invalid MongoDB connection strings.

I kept the function pure so tests can provide configuration directly without modifying environment variables or starting the application. The returned configuration is immutable, and validation errors avoid exposing credentials or MongoDB connection details.

One limitation is that checking a credential's character distribution does not prove it was randomly generated. The host will still need to generate and store its access credential securely.

**Verification:** All 79 tests passed. TypeScript and Git whitespace checks passed. No MongoDB connections or server operations were performed.

**Next:** Implement private, repeatable Officer provisioning before creating public application endpoints.

### Increment 7 — Completing the Backend MVP

I completed Relay's backend integration by adding private Officer provisioning, authorized composition endpoints, three read formers, and a local Bun HTTP host.

The main architectural challenge was separating authentication from authorization. The host establishes the configured User and workspace, while RoleBasedAccessing determines whether that User can perform an operation. I made the host overwrite caller-supplied identities so clients cannot impersonate another User through request data.

I also implemented repeatable Officer provisioning. On startup, Relay checks the Officer Role, its three permissions, and its assignment to the configured workspace. Unexpected state causes provisioning to fail rather than silently granting additional access.

The application now exposes operations for Procedures, Steps, Context Notes, attachments, changes, pending Reviews, and Review confirmation. The read formers combine information from independent concepts without moving that logic into the concepts themselves.

An HTTP integration test exercised the main MVP scenario: create two Procedures, attach one shared Context Note, correct its wording without generating Reviews, change its meaning to create two pending Reviews, and confirm one.

**Verification:** All 94 tests passed, TypeScript passed, complete design checking passed, and Git whitespace checking passed. Sync-engine application diagnostics passed with eleven nonfatal advisories.

**Remaining work:** Build the Vue frontend, establish a suitable browser access mechanism, investigate the endpoint fallback advisories, and run the actual local application end to end.

### Increment 8 — Relay P2 Browser Demo

I added a responsive Vue interface for the P2 club workflow: a workspace
dashboard, ordered playbooks and Steps, shared Context Notes and attachments,
separate wording correction and meaningful-change actions, exact before/after
history, and a pending Review inbox.

The existing shared host credential is now used only at a same-origin sign-in
route. The server exchanges it for an expiring in-memory session cookie
(HttpOnly, SameSite=Strict) and a CSRF token. Mutating requests require the
session, CSRF token, and the exact local Vite Origin. User and workspace values
remain host-injected; no secret is built into the frontend or returned by a
configuration endpoint. A new authorized review-history read exposes persisted
completed states so the UI can distinguish pending and complete Reviews after
refresh.

The dev supervisor starts the Bun API and Vite together. An optional
`RELAY_DEMO_DATABASE` selects a separate MongoDB database name without changing
the configured application URI, making it possible to demonstrate startup
provisioning from a clean database. The README documents the setup and warns
that this shared-credential local host is not production authentication.

**Diagnostic review:** The eight `MISSING_ENDPOINT_FALLBACK` warnings remain.
Sync-engine 1.1.0 explicitly notes that its coverage analyzer cannot prove
complementary state guards and that adding an unconditional sibling may create
overlapping answers. I did not add unsafe catch-all responses or weaken
authorization. The three `ORDER_SENSITIVE_FORMER` notices remain associated
with the declared ordered selections; all user-visible collections are
explicitly arranged by stable identities or Step position. Procedure
collections now use unique Procedure identity as their stable order rather than
title (titles may repeat). The analyzer still reports each arrangement as
source-order-sensitive because its check does not prove the selected key is
unique.

**Verification:** `bun run test` passed all 99 tests across 9 files;
`bunx tsc --noEmit`, `bun run typecheck:web`, `bun run build`, and the full
design check passed; `git diff --check` was clean. The sync-engine application
check passed with 8 `MISSING_ENDPOINT_FALLBACK` warnings and 4
`ORDER_SENSITIVE_FORMER` notices. Browser smoke testing confirmed the Vue
sign-in screen loads through Vite and that the proxied API denies unauthenticated
requests. The full application workflow, including persisted Review history,
was exercised by isolated MongoDB integration tests.

The local demo is running at `http://127.0.0.1:5173` against a separate
`RELAY_DEMO_DATABASE`; no fixtures were written to the configured application
database. The browser credential remains only in ignored `.env` and was not
printed.

### Increment 9 — Submission Readiness Walkthrough

I completed the full workflow in headless Chrome through the Vue interface,
using the isolated `relay_browser_demo_verified_c4197e` database. I created two
Playbooks with ordered Steps, recorded one shared Context Note, attached it to
both Playbooks with a Step 1 anchor on Playbook A, corrected the wording, and
verified that correction produced no Reviews. The meaningful change preserved
the exact annual-to-semester before/after text and produced two pending Reviews.
After confirming one, refreshing, and reloading the page, the browser still
showed one pending Review and the completed Review in history.

The narrow 390-pixel walkthrough exposed a usability gap: the responsive
stylesheet hides the sidebar footer, which previously made its Sign out button
inaccessible on mobile. I added a compact Sign out control to the mobile
topbar; the final 390×844 viewport has no horizontal overflow, retains fixed
bottom navigation, and exposes sign-out.

Live host checks returned 401 for unauthenticated API access, 403 for missing
CSRF and cross-origin requests, and 404 for an unexposed role-administration
path. A same-origin authorized read remained successful when the body supplied
forged User and workspace values, confirming the host replaces them with its
configured identities. A scan of the production JavaScript bundle did not find
the configured local credential. The credential was not printed or captured in
screenshots. Desktop and mobile evidence was saved outside the repository at
`/tmp/relay-p2-desktop.png` and `/tmp/relay-p2-mobile.png`.

**Final verification:** 99 tests passed across 9 files; `bunx tsc --noEmit`,
`bun run typecheck`, `bun run build`, the full design check, and
`git diff --check` passed. Sync-engine reported the same 8
`MISSING_ENDPOINT_FALLBACK` warnings for guarded mutation paths and 4
`ORDER_SENSITIVE_FORMER` notices for explicitly arranged selections. The local
demo database was distinct from the configured application database.