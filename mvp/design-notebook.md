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

