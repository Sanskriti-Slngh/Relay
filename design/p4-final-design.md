# Relay — Final Design

## 1. The Problem and Core Idea

Student-club procedures often outlive the assumptions behind them. Relay keeps
official procedures as ordered **Playbooks**, but also records the policies,
decisions, and experience they depend on as reusable **Context Notes**. One Note
can be attached to Steps in several Playbooks. When its meaning changes, Relay
preserves the old and new text and asks an officer to reconsider every affected
Playbook rather than rewriting instructions automatically.

That idea is unchanged from the [first preserved repository snapshot of the P1 design](https://github.com/Sanskriti-Slngh/Relay/tree/703eb27dc7ea2d3b47c6d7ac5f61d6a572b746fb/design).
ProcedureMaintaining, ContextTracking, Questioning, Reviewing, and
RoleBasedAccessing still own independent kinds of state. The
[composition](https://github.com/Sanskriti-Slngh/Relay/blob/21a6fac0bbd6f86bdd587f2acc41030b3ff9e5fd/design/compositions/Relay.md)
connects them through stable identities and reactions. In particular,
ContextTracking records a meaningful Change; Reviewing only knows that a
generic Item needs reconsideration for one or more generic Causes.

## 2. From P1 Concept to Working Application

P1 already contained the distinctive behavior: shared Context, stable Step
identity, Questions attached to their subject, separate wording correction and
meaningful change actions, and one unfinished Review that can collect several
Causes. P4 turns those models into a persistent multi-user system rather than
changing their purpose.

- The original provisioned workspace and trusted officer became authenticated
  accounts, durable sessions, multiple workspaces, email-bound invitations,
  and Owner, Officer, and Member permissions. The server—not the browser—now
  establishes user and workspace identity before authorization.
- MongoDB implementations enforce concept invariants. Client-visible versions
  reject stale Playbook, Step, Context, Question, and Review mutations. The UI
  then keeps the losing draft beside the newer saved value instead of silently
  overwriting either edit.
- Concurrent Context changes exposed a composition bug: Reviewing correctly
  kept one unfinished Review, but a Cause could be lost. Reviewing still owns
  uniqueness through a database constraint; the composition now recovers the
  losing request and atomically adds its distinct Cause.
- Creating Context beside a Step requires separate record and attach actions.
  If recording succeeds but attachment fails, Relay reports the partial
  success and reuses the saved Note for retry instead of creating a duplicate.

These changes strengthen the original boundaries. Authentication remains a
host concern, version checks remain with the concepts that own the records, and
cross-concept recovery remains in the composition.

## 3. From P3 Visual Design to P4

The [P3 submission](https://github.com/Sanskriti-Slngh/Relay/tree/49de6564819582b70e1a8b350991a26a0069a6cc)
already established Relay's editorial, document-first character: bundled Inter,
a subdued neutral and evergreen palette, amber for unfinished work, generous
spacing, separator-based grouping, and progressive disclosure. P4 deliberately
keeps that system.

The final pass improves moments where a person must understand a consequence
or recover from a mistake. Empty workspaces now explain the three-step task;
Context choices say whether they create Review work; and Reviews lead from the
reason, through changed evidence and current instructions, to the next
decision. Unsaved drafts are guarded during navigation, workspace changes,
sign-out, and reload. Busy labels, partial-failure messages, and conflict panels
make state changes visible. Reading measures, long-text wrapping, stacked
Review evidence, and the tablet/mobile Playbook reflow make dense states more
legible without adding permanent controls or another visual language.

## 4. Hard Design Decisions

- **Keep Reviewing independent.** Putting a `needsReview` flag inside
  ContextTracking or ProcedureMaintaining would simplify one workflow but mix
  knowledge, procedures, and human judgment. Generic Items and Causes let each
  concept keep a clear invariant.
- **Recover races in the composition.** Weakening Reviewing's uniqueness rule
  would permit duplicate work. Relay instead accepts one Review and attaches
  every observed Cause to it. This covers tested concurrent schedules, not
  exactly-once delivery across a process crash.
- **Poll instead of adding subscriptions.** Three-second polling and refresh on
  tab visibility reuse one read path and fit the class deployment. Sequence
  numbers prevent stale responses from replacing newer state, while local
  drafts stay in components. The tradeoff is short update latency rather than
  true real-time delivery.

## 5. Final State and Remaining Tradeoffs

The [P4 implementation](https://github.com/Sanskriti-Slngh/Relay/commit/21a6fac0bbd6f86bdd587f2acc41030b3ff9e5fd)
supports the complete Owner/Member journey, persistence, access control,
conflict recovery, and responsive interaction. The project owner deployed this
commit and subsequently reported that its browser checks passed. Those were
user-operated production checks, not agent-controlled observations; automated
and source-level verification independently passed for the same commit.

Relay also has deliberate reliability limits. Reaction handling is not a
crash-safe outbox, standalone-Mongo serialization assumes one application
process, and Recent Activity is an awareness feed rather than an atomic audit
log. Those constraints are preferable to claiming guarantees the current
architecture does not provide.
