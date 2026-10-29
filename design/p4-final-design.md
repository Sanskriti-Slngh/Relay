# Relay — Final Design

## 1. The problem

Two Playbooks in a club lean on one room-access policy: _access renews annually_. The policy becomes _semesterly renewal_. If someone edits both procedures by hand they can miss one, or erase the reason it changed in the first place.

Relay keeps official procedures as ordered **Playbooks** and keeps the policies, decisions, and lessons behind them as reusable **Context Notes**. One Note can support Steps in several Playbooks. A meaningful change preserves the exact old and new text and asks an Officer to reconsider every affected Playbook — Relay never silently rewrites instructions underneath them.

The core idea hasn't moved since [P1](https://github.com/Sanskriti-Slngh/Relay/tree/703eb27dc7ea2d3b47c6d7ac5f61d6a572b746fb/design). Five concepts — **ProcedureMaintaining**, **ContextTracking**, **Questioning**, **Reviewing**, **RoleBasedAccessing** — each own one kind of state. The [composition](https://github.com/Sanskriti-Slngh/Relay/blob/705e368127fc899d3a578bb21b0964f566975ea3/design/compositions/Relay.md) wires them through stable identities. In particular, ContextTracking records a meaningful Change; Reviewing only knows that a generic Item needs reconsideration for one or more generic Causes.

## 2. From P1 concept to a working app

P1 already had the behavior that makes Relay distinctive: shared Context, stable Step identity, Questions pinned to their subject, a split between **Fix wording** and a meaningful change, and one open Review that can collect several Causes. P4 turns those models into a real multi-user system without changing what they mean.

- **Accounts and workspaces.** The original "provisioned workspace and trusted Officer" became authenticated accounts, durable sessions, multiple workspaces, email-bound invitations, and Owner / Officer / Member roles. The server, not the browser, decides who you are before authorization. Every reaction runs behind `RoleBasedAccessing` checks in [`multiUserHttp.ts`](../src/host/multiUserHttp.ts).
- **Concurrent edits are safe.** MongoDB implementations enforce the concept invariants. Playbook, Step, Context, Question, and Review mutations each take an `expectedVersion`; stale saves are rejected. The UI then shows both the losing draft and the newer saved value instead of silently overwriting either.
- **Reversible destruction.** Detaching Context removes one connection; the shared Note survives. Permanent deletion is explicit, cleans up attachments and Questions, and keeps Review evidence that was already recorded. Workspaces archive the same way; Owner-only deletion requires typing the workspace name.
- **Partial-success recovery.** Creating a Context Note beside a Step is really two actions — `record` then `attach`. If recording succeeds but attachment fails, Relay reports the partial success and reuses the saved Note for retry instead of creating a duplicate.

## 3. The refinement I'm most proud of — cross-concept recovery in the composition

When two Context Notes changed almost simultaneously, Relay could record only one reason for reviewing a Playbook. Each concept was individually correct: `ContextTracking` recorded both Changes; `Reviewing.request` correctly refused the second one because an open Review for the same item already existed. The _application_ still lost the second Cause.

The temptation was to weaken Reviewing's uniqueness rule to let duplicate Reviews exist, then "fix it up" later. I kept the invariant and fixed the integration instead. In [`Relay.ts`](../src/compositions/Relay.ts) a new reaction, `Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal`, catches a refusal that cites the open Review and attaches the losing Cause to it. The composition tests prove this: [`concurrent Changes retain one Review and every Cause for one Procedure`](../tests/compositions/Relay.test.ts) fires four simultaneous `change` actions and asserts (a) exactly one Review exists, (b) every refusal is paired with a successful recovery `addCause`, and (c) every observed Change ends up as a Cause on the Review.

The lesson generalises: **concepts can each be correct and the application can still lose information between them**. Cross-concept recovery doesn't belong in either concept; it belongs in the composition. This is the modularity move that let every other P4 feature stay simple.

## 4. A second refinement — making wording fixes visible without breaking Review semantics

In P1, `correct` just replaced a Note's text and left no trace. During P4 I noticed officers couldn't tell whether a Note had been fixed quietly or had never changed, and the Context page's change count ignored corrections. The naive fix would be to route corrections through `change`, but that would create Reviews for every typo.

Instead `ContextTracking.correct` now writes a Change record tagged `kind: "correction"` and returns the new Change ID. `Reviewing` still only reacts to `change` (not `correct`), so corrections never create Reviews. The UI shows both kinds in one history timeline but labels them differently: `Fix wording` (grey) vs `Information changed` (amber). Users get a complete history; the Review-generation boundary stays exactly where it was.

## 5. From P3 visual design to P4

[P3](https://github.com/Sanskriti-Slngh/Relay/tree/b607d9059104cff9f36f5e12c48e56b6d51565bb) established Relay's editorial, document-first look. P4 keeps that system and fixes the pages where officers still had to work too hard to understand a consequence.

- **Reviews, now one surface.** The old Review repair screen showed Step editing, Context replacement, detachment, target details, and resolution all at once — complete but noisy, and it forced officers to piece together the data model (what Change affects which Step?). The new flow is Context-first. Each Review opens with lavender change cards showing a word-level diff. Small Step pills under each change say which Playbooks and Steps that change affects. Clicking a pill opens the Playbook preview modal, scrolled to that Step. The modal is the only repair surface: every Step is visible for context, affected Steps get a thin amber accent on the left, a small pencil opens an inline textarea, and each changed attachment has a Manage button offering **Replace Context** or **Detach from this Step** — both local to the attachment. Unchanged attachments appear in grey, so officers see the full picture without mistaking supporting context for work. The main page ends with one decision: **Complete Review** or **Other**. This change gives officers one map of change → affected Step → repair without ever reading the composition's internal structure.
- **Rewriting the shared Note is deliberately not a local repair option.** A small Global note at the bottom of the modal sends officers to the Context page for that edit — because the Note is shared across Playbooks and changing it there is what generates fresh Reviews. The interaction mirrors the composition's semantics.
- **Questions as a Q and A.** Each Question renders as a soft blue card with a round blue **Q** badge; the answer form sits right beneath led by a green **A** badge, with a blue Answer button. Answered Questions keep the Q/A layout; the officer who wrote the answer sees a small inline pencil and a red × beside the Answered tag to delete the Question.
- **A continuous Workspace page.** Dividers between **Switch club**, **Members**, and **Pending invitations** are gone; vertical spacing does the grouping. Each Member row has a **Manage ▾** menu with Change role and Remove — one place instead of three buttons. Inviting someone is an inline link next to the Members heading that reveals the email input and a **Generate invite code** button (the earlier "Create code" made people wonder whether an email was being sent). Advanced management is an accordion of Rename, Transfer ownership, Archive — each collapsed by default with a rotating chevron so the control reads as clickable.

Everywhere: unsaved drafts are guarded during navigation, workspace changes, sign-out, and reload. Busy labels, partial-failure messages, conflict panels, bounded reading measures, long-text wrapping, and mobile reflow make state changes legible without introducing a second visual language.

## 6. Hard decisions

- **Keep Reviewing independent.** A `needsReview` flag inside ContextTracking or ProcedureMaintaining would simplify one workflow, but it would mix knowledge, procedures, and human judgment. Generic Items and Causes let each concept keep a clear invariant.
- **Recover races in the composition, not in Reviewing.** See §3. Weakening uniqueness would allow duplicate work; the composition reaction fixes the drop without touching the invariant.
- **Poll, don't subscribe.** Three-second polling plus a refresh on tab visibility reuses one read path and fits the class deployment. Sequence numbers prevent stale responses from replacing newer state. Local drafts stay in components. The tradeoff is short update latency rather than real-time delivery.
- **Diff first, exact text on demand.** A word-level diff on the Reviews page shows what changed at a glance; the exact recorded before and after live under a "Show full text" disclosure for evidence.

## 7. Final state and remaining limits

The [final P4 code commit](https://github.com/Sanskriti-Slngh/Relay/commit/705e368127fc899d3a578bb21b0964f566975ea3) supports the full Owner/Member journey, Context and workspace lifecycles, Review repair, conflict recovery, responsive interaction, and the final interaction fixes. The separate [deployment record](../mvp/p4-deployment-verification.md) distinguishes local verification from release-specific live evidence.

Relay has deliberate reliability limits:
- Reaction handling is not a crash-safe outbox.
- Standalone-Mongo serialization assumes a single application process.
- Recent Activity is an awareness feed, not an atomic audit log.

These are known limitations, not places where the implementation couldn't do more.
