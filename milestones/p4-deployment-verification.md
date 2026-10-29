# P4 — Deployment and Test Evidence

## 1. What I wanted to verify

For P4, I wanted to make sure Relay worked beyond the individual concepts and the local development environment. The most important things to test were whether information persisted, whether different users had the correct permissions, and whether the application handled unexpected situations without losing data.

I focused particularly on shared Context changes because they connect several parts of Relay. When one Note changes, the application must identify every affected Playbook, preserve the original information, and create the appropriate Review work. This was also where I found one of the most consequential bugs during implementation.

The application is deployed at **[relay.mit-sdg.dev](https://relay.mit-sdg.dev/)**.

## 2. Automated testing

Automated testing was done against two separate revisions. I'm keeping them distinct in this record because the October 29 code is not what was running during the October 26 deployment checks in §3.

### 2a. October 26 revision (deployed to `relay.mit-sdg.dev`)

I tested the October 26 revision locally on October 26, 2026, using a real MongoDB server.

- **189 tests passed** across 23 files, with no failures.
- TypeScript and Vue typechecking passed.
- The production build completed successfully.
- Sync-engine source and design checks passed, with 30 documented nonfatal source advisories.
- Generated-artifact validation and `git diff --check` passed.

### 2b. October 29 final revision

After October 26 I made further changes to the application — the Reviews / Questions / Workspace redesigns, the `ContextTracking.correct` refinement that records corrections as `kind:"correction"` Changes, a repository reorganization, a dead-code sweep, and the `tsconfig` fix for `scripts/`. I re-ran the full suite locally on October 29, 2026, against the final head:

- **195 tests passed** across 24 files, with no failures.
- `bun run typecheck` (tsc + vue-tsc) passed.
- `npm run build` produced a clean production bundle.
- The adversarial concurrency tests described in §2c still pass against the final code.

The additional test file and the test-count increase both come from the drift fixes and new assertions I added on October 29, not from new concepts.

### 2c. What the tests cover (both revisions)

The tests cover both individual concepts and interactions between them. In particular, I checked:

- **Concept behavior:** Valid operations, invalid transitions, Review uniqueness, and stale-version rejection.
- **Composition:** Shared Context changes creating Reviews, multiple Causes accumulating correctly, and recovery from rejected concurrent operations.
- **Authentication and permissions:** Owner, Officer, and Member access, session handling, invitations, and workspace isolation.
- **Persistence and error handling:** Backend workflows through HTTP, invalid requests, partial failures, Context deletion, and workspace lifecycle operations.
- **Frontend behavior:** Conflict recovery, editing states, and protection against losing unsaved work.

The most relevant tests are available in the repository:

- [Composition and concurrency tests](../tests/compositions/Relay.test.ts)
- [Reviewing concept tests](../tests/concepts/Reviewing.test.ts)
- [Version-control tests](../tests/concepts/VersionControl.test.ts)
- [Multi-user and access-control tests](../tests/host/multi-user.test.ts)
- [Backend integration tests](../tests/host/backend.test.ts)
- [Frontend tests](../tests/frontend/)

### A subtle failure that routine testing would have missed

One important failure occurred when two Context Notes changed at nearly the same time.

Relay correctly prevented the creation of duplicate Reviews, but I discovered that the second change could lose its Cause when its attempt to create a Review was rejected. Both concepts were behaving according to their specifications, yet the application could still lose information between them.

I fixed this in the composition — a new reaction `Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal` catches the refusal and attaches the losing Cause to the existing Review — and added two adversarial regression tests to [`tests/compositions/Relay.test.ts`](../tests/compositions/Relay.test.ts):

- `concurrent Changes retain one Review and every Cause for one Procedure` fires four simultaneous `ContextTracking.change` actions on four Notes attached to the same Playbook. It asserts (a) exactly one Review exists, (b) every refusal is paired with a successful recovery `addCause`, and (c) every Change ID is present as a Cause on that Review.
- `recovers a concurrent request refusal by attaching its Cause to the existing Review` fires two simultaneous `Reviewing.request` actions directly, so the recovery is exercised even without a surrounding `change`.

Together these tests detect regression at both levels of the stack: the composition reaction, and the application-level user flow it is meant to protect. The lesson that stayed with me: testing each concept independently was not enough — I also had to test how reactions behaved when operations overlapped or partially failed.

## 3. Testing the deployed application

### 3a. October 24 manual browser checks (earlier deployed revision)

On October 24, I manually tested Relay in two Chrome sessions using controlled Owner and Member accounts. I recorded **21 out of 21 checks as passing**, covering:

| Area | Result |
|---|---|
| Owner workflows | 6/6 passed |
| Member permissions, collaboration, and polling | 8/8 passed |
| Concurrency, errors, mobile, keyboard interactions, and persistence | 7/7 passed |

I checked that users could complete the main journey: maintaining Playbooks, working with shared Context, creating Review work, and collaborating through Questions. I also tested situations such as unauthorized actions, concurrent changes, and persistence across sessions.

The [manual browser checklist](./p4-manual-browser-checklist.md) records the individual checks and expected results.

These results are evidence from the October 24 testing session against the then-deployed October 26 revision. I could not independently establish the exact deployed revision active during every interaction, so I have not treated them as proof of the final October 29 code.

### 3b. October 26 live deployment smoke checks (October 26 code)

On October 26 I checked the live deployment at [`relay.mit-sdg.dev`](https://relay.mit-sdg.dev/) and observed:

- The application homepage returned HTTP 200.
- `/health` returned HTTP 200 with `{"status":"ok"}`, confirming database connectivity at the time of the request.
- An unauthenticated `/session` request returned the expected unauthenticated response.
- An invalid login returned HTTP 401 with `INVALID_CREDENTIALS`.
- A request with an unauthorized Origin returned HTTP 403 with `ORIGIN_REJECTED`.
- The deployed frontend assets contained the October 26 interaction changes, including revised invitation guidance, conflict handling, and mobile navigation behavior.

The observed deployment identifier was `8e767b2e-b314-4b98-a30c-1017453a90d5`. **These checks ran against the October 26 revision, not the October 29 final code.**

I also attempted another browser walkthrough of that release, but the controlled browser could not pass its required security verification, so I could not repeat the full authenticated Owner/Member journey against that exact deployment.

### 3c. October 29 final revision — code-level verification only

The October 29 test results in §2b were recorded against commit [`1a587c9`](https://github.com/Sanskriti-Slngh/Relay/commit/1a587c9fa94b085fcb3e029fd5d22801dd6041e2). The current `origin/main` head is one commit newer — a specification alignment for `ContextTracking` that updates `design/concepts/ContextTracking.md` and the regenerated artifacts to match the already-implemented correction behavior. It does not change application behavior.

What I verified on October 29:

- The complete test suite described in §2b passed locally against this exact revision.
- The adversarial concurrency tests described in the "subtle failure" subsection below continued to detect the composition race they were written for.
- `bun run typecheck` and `npm run build` passed cleanly.
- Manual interaction with the UI through the local dev server (`bun run dev`) confirmed the Reviews, Questions, and Workspace redesigns behave as documented in the final design doc. These were the surfaces where I made changes between October 26 and October 29.

I did **not** redeploy the application to `relay.mit-sdg.dev` for the October 29 code within this submission window, so the live-smoke-check numbers in §3b remain evidence only for the October 26 revision. The October 29 code's deployment-level behavior is not independently verified here; the automated and local-browser evidence above is the strongest claim I can honestly make for the final head.

## 4. Remaining limitations

The tests provide evidence that Relay's concepts, compositions, backend permissions, and main workflows behave as intended. They do not prove that every possible concurrency or deployment failure is handled.

Two limitations remain:

- **Reliance on maintained Context:** Relay can identify affected Playbooks when an existing Context Note changes, but it cannot detect when officers forget to update shared information or create duplicate Notes instead. The quality of its Reviews therefore depends on how consistently clubs maintain their Context.
- **Activity history:** Recent Activity helps users understand what happened, but it is not an atomic audit log.

These are limitations I accepted for the scope of P4.

## 5. Final deliverables

- **Deployed application:** [Relay](https://relay.mit-sdg.dev/)
- **Final design document:** [Relay — Final Design](../design/p4-final-design.md)
- **Narrated demo:** [Watch on YouTube](https://youtu.be/0bwM4Pb3J-0) (2:59)
- **Manual testing checklist:** [P4 browser checks](./p4-manual-browser-checklist.md)

My main takeaway from testing was that an application can pass its individual concept tests and still fail when those concepts interact. The concurrent Review bug made that especially clear. By the end of P4, I had put more emphasis on integration tests, recoverable failures, and making sure the deployed behavior matched what the interface promised.