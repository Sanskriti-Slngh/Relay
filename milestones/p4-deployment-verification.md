# P4 — Deployment and Test Evidence

## 1. What I wanted to verify

For P4, I wanted to make sure Relay worked beyond the individual concepts and the local development environment. The most important things to test were whether information persisted, whether different users had the correct permissions, and whether the application handled unexpected situations without losing data.

I focused particularly on shared Context changes because they connect several parts of Relay. When one Note changes, the application must identify every affected Playbook, preserve the original information, and create the appropriate Review work. This was also where I found one of the most consequential bugs during implementation.

The application is deployed at **[relay.mit-sdg.dev](https://relay.mit-sdg.dev/)**.

## 2. Automated testing

I tested the final P4 implementation locally on October 26, 2026, using a real MongoDB server.

The final verification included:

- **189 tests passed** across 23 files, with no failures.
- TypeScript and Vue typechecking passed.
- The production build completed successfully.
- Sync-engine source and design checks passed, with 30 documented nonfatal source advisories.
- Generated-artifact validation and `git diff --check` passed.

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

On October 24, I manually tested Relay in two Chrome sessions using controlled Owner and Member accounts. I recorded **21 out of 21 checks as passing**, covering:

| Area | Result |
|---|---|
| Owner workflows | 6/6 passed |
| Member permissions, collaboration, and polling | 8/8 passed |
| Concurrency, errors, mobile, keyboard interactions, and persistence | 7/7 passed |

I checked that users could complete the main journey: maintaining Playbooks, working with shared Context, creating Review work, and collaborating through Questions. I also tested situations such as unauthorized actions, concurrent changes, and persistence across sessions.

The [manual browser checklist](./p4-manual-browser-checklist.md) records the individual checks and expected results.

These results are evidence from the October 24 testing session. I could not independently establish the exact deployed revision active during every interaction, so I have not treated them as proof of the final October 26 release.

### Final deployment verification

The final P4 revision is preserved in commit [`705e3681`](https://github.com/Sanskriti-Slngh/Relay/commit/705e368127fc899d3a578bb21b0964f566975ea3). Earlier interaction-complete commits ([`ce257b29`](https://github.com/Sanskriti-Slngh/Relay/commit/ce257b29632f33421e4bf4069591577742f6e8c0), [`af333c30`](https://github.com/Sanskriti-Slngh/Relay/commit/af333c30e9bc08217e57e8d391c74719c23d5839)) are preserved in history. The deployed repository revision matches the final head and adds documentation and verification updates with no application-code change.

On October 26, I checked the live deployment and observed:

- The application homepage returned HTTP 200.
- `/health` returned HTTP 200 with `{"status":"ok"}`, confirming database connectivity at the time of the request.
- An unauthenticated `/session` request returned the expected unauthenticated response.
- An invalid login returned HTTP 401 with `INVALID_CREDENTIALS`.
- A request with an unauthorized Origin returned HTTP 403 with `ORIGIN_REJECTED`.
- The deployed frontend assets contained the final interaction changes, including revised invitation guidance, conflict handling, and mobile navigation behavior.

The observed deployment identifier was `8e767b2e-b314-4b98-a30c-1017453a90d5`.

I also attempted another browser walkthrough of the final release, but the controlled browser could not pass its required security verification. I therefore could not repeat the full authenticated Owner/Member journey against that exact deployment. I have kept the earlier manual results and the final deployment checks separate rather than presenting an uncompleted test as a pass.

## 4. Remaining limitations

The tests provide evidence that Relay's concepts, compositions, backend permissions, and main workflows behave as intended. They do not prove that every possible concurrency or deployment failure is handled.

Two limitations remain:

- **Forgetting to update context:** Users can get lazy and forget to change the context for something and keep creating new ones instead of updating the original context which can create same issues as previous. This relies on good usage and intended usage of the app.
- **Activity history:** Recent Activity helps users understand what happened, but it is not an atomic audit log.

These are limitations I accepted for the scope of P4.

## 5. Final deliverables

- **Deployed application:** [Relay](https://relay.mit-sdg.dev/)
- **Final design document:** [Relay — Final Design](../design/p4-final-design.md)
- **Narrated demo:** [Watch on YouTube](https://youtu.be/0bwM4Pb3J-0) (2:59)
- **Manual testing checklist:** [P4 browser checks](./p4-manual-browser-checklist.md)

My main takeaway from testing was that an application can pass its individual concept tests and still fail when those concepts interact. The concurrent Review bug made that especially clear. By the end of P4, I had put more emphasis on integration tests, recoverable failures, and making sure the deployed behavior matched what the interface promised.