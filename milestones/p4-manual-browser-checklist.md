# P4 Manual Browser Verification Checklist

This document records the manual browser checks performed for Relay's P4 deployment. The goal was to verify that the deployed application supports the complete Owner–Member journey, enforces permissions, handles concurrent edits, and preserves changes across sessions.

## Verification information

- **Application:** [relay.mit-sdg.dev](https://relay.mit-sdg.dev/)
- **Test date:** October 24, 2026
- **Tester:** Project owner
- **Environment:** Google Chrome, using separate browser sessions and controlled test accounts
- **Test data:** Fictional club workspaces, Playbooks, Context Notes, and user accounts
- **Recorded outcome:** 21/21 checks reported as PASS

**Evidence and provenance:** These checks were performed manually by the project owner. This document was organized retrospectively from the original checklists and reported outcomes; it is not an independently captured browser test log. No screenshots or detailed per-check observation notes were retained. The exact deployed revision active during every manual interaction was not independently established. Release-specific HTTP and automated test evidence is documented separately in the [P4 deployment verification record](./p4-deployment-verification.md).

## Task 2.2A — Owner workflow

**Result: 6/6 PASS**

| # | Check | Expected behavior | Recorded result |
|---|---|---|---|
| A1 | Create two Playbooks | An Owner can create two active Playbooks with ordered Steps, and both appear in the workspace. | PASS |
| A2 | Attach shared Context | One Context Note can be attached to relevant Steps in both Playbooks without duplicating the underlying Note. | PASS |
| A3 | Fix wording | Correcting a typo updates the Context Note without creating a Review because the underlying meaning has not changed. | PASS |
| A4 | Information changed | Making a meaningful change preserves the before-and-after Context and creates Review work for both affected active Playbooks. | PASS |
| A5 | Complete Review workflow | The Owner can inspect affected Playbooks, mark instructions as **Still correct**, or choose **Needs updating**, make an appropriate edit, and resolve the Review. | PASS |
| A6 | Verify persistence | Playbooks, Context changes, completed Reviews, and remaining work persist after reloading the application. | PASS |

This sequence tests Relay's primary promise: a single change to shared information should identify the procedures that depend on it, while leaving the final decision to a person.

## Task 2.2B — Member workflow, permissions, and collaboration

**Result: 8/8 PASS**

| # | Check | Expected behavior | Recorded result |
|---|---|---|---|
| B1 | Invite a Member | An authorized Owner or Officer can create an email-bound invitation, and the invited user can accept it using the appropriate account. | PASS |
| B2 | Member reading access | The Member can open the shared workspace and read its Playbooks and attached Context Notes. | PASS |
| B3 | Member editing restrictions | Official-knowledge editing controls are unavailable to Members, while allowed reading and Question actions remain available. | PASS |
| B4 | Member asks a Question | The Member can attach a Question to a relevant Step or Context Note. The Question retains its original subject. | PASS |
| B5 | Owner receives the Question | The unanswered Question becomes visible in the Owner's Questions interface without requiring a manual page reload. | PASS |
| B6 | Owner answers and Member receives update | The Owner can answer the Question, and the Member can see the response through the application's refresh behavior. | PASS |
| B7 | Persistence across accounts | Questions, answers, membership, and shared data remain available after refreshing or signing back into the respective accounts. | PASS |
| B8 | Backend permission enforcement | A forged or unauthorized mutation is rejected by the server rather than relying solely on hidden interface controls. | PASS |

These checks cover both collaboration and authorization. Hiding an editing button is not sufficient security; the server must independently enforce permissions.

## Task 2.2C — Robustness, concurrency, and usability

**Result: 7/7 PASS**

| # | Check | Expected behavior | Recorded result |
|---|---|---|---|
| C1 | Two-Officer Step conflict | When two Officers edit the same Step from different versions, a stale save cannot silently overwrite the newer saved value. The latest version remains available and the losing draft can be recovered. | PASS |
| C2 | Stale Context change | An outdated Context edit cannot overwrite a newer Note or introduce an unintended extra Review Cause. | PASS |
| C3 | Invalid input feedback | Blank required fields or other invalid inputs are rejected with useful feedback, without destroying previously valid information. | PASS |
| C4 | Duplicate or invalid operations | Reattaching an already-attached Context Note, or attempting another safely testable invalid operation, is prevented or rejected without corrupting state. | PASS |
| C5 | Desktop and mobile layout | The interface remains readable and usable on desktop and a narrow mobile viewport, including approximately 390 pixels, without horizontal overflow or inaccessible essential controls. | PASS |
| C6 | Keyboard accessibility | Essential interactions are reachable by keyboard, focus is visible, and controls can be operated without depending exclusively on pointer input. | PASS |
| C7 | Recovery and final persistence | After errors or conflicts, valid saved data remains intact, and the expected application state persists through refresh and re-login. | PASS |

The concurrency checks are especially important because Relay is designed for several Officers working with shared information. The system must protect existing data without unnecessarily discarding a person's unfinished work.

## Automated regression tests supporting these behaviors

The manual checks above were performed through the deployed browser interface. Separate automated tests in the repository verify many of the underlying invariants and failure cases:

| Coverage | Automated test source |
|---|---|
| Concurrent Context changes and Review Cause recovery | [Composition tests](../tests/compositions/Relay.test.ts) |
| Review uniqueness and lifecycle transitions | [Reviewing tests](../tests/concepts/Reviewing.test.ts) |
| Rejection of stale edits | [Version-control tests](../tests/concepts/VersionControl.test.ts) |
| Invitations, sessions, workspace isolation, and permissions | [Multi-user tests](../tests/host/multi-user.test.ts) |
| Full HTTP workflows, validation, and error cases | [Backend integration tests](../tests/host/backend.test.ts) |
| Conflict handling and unsaved-work protection | [Frontend tests](../tests/frontend/) |

One important regression concerns concurrent Context changes. The original implementation could preserve all Context Changes while losing one Cause from a shared Review. The [composition regression tests](../tests/compositions/Relay.test.ts) now exercise concurrent changes and recovery from a rejected concurrent Review request, checking that the resulting Review retains the expected distinct Causes.

These automated tests support the implementation's correctness but do not establish that every browser interaction was independently reproduced against the final deployed release.

## Summary and limitations

| Verification group | Recorded result |
|---|---|
| Task 2.2A — Owner workflow | 6/6 PASS |
| Task 2.2B — Member workflow and permissions | 8/8 PASS |
| Task 2.2C — Robustness and usability | 7/7 PASS |
| **Total** | **21/21 PASS** |

The manual checks provide evidence that the deployed application supported the primary user journey, role restrictions, collaboration, persistence, and recovery behavior during the reported verification session.

The results are project-owner observations, not an independent automated browser report. The checklist does not establish the absence of all accessibility issues, concurrency races, or deployment failures. In particular, overlapping browser sessions cannot prove correctness for every possible concurrent execution schedule or crash.

The [P4 deployment and test evidence](./p4-deployment-verification.md) records the automated results, HTTP verification, release attribution, and remaining reliability limitations. The [P4 narrated demonstration](https://youtu.be/0bwM4Pb3J-0) provides a separate visual walkthrough of Relay's user-facing functionality.