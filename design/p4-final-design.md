# Relay — Final Design

## 1. The Problem and Core Idea

Imagine two club Playbooks that both rely on one room policy: access renews
annually. When the policy changes to semesterly renewal, editing two sets of
instructions by hand risks missing one or erasing why it changed. Relay keeps
official procedures as ordered **Playbooks** and their shared policies,
decisions, and experience as reusable **Context Notes**. One Note can support
Steps in several Playbooks; a meaningful change preserves the exact annual and
semester versions and asks an officer to reconsider every affected Playbook
rather than rewriting instructions automatically.

That idea is unchanged from the [first preserved repository snapshot of the P1 design](https://github.com/Sanskriti-Slngh/Relay/tree/703eb27dc7ea2d3b47c6d7ac5f61d6a572b746fb/design).
ProcedureMaintaining, ContextTracking, Questioning, Reviewing, and
RoleBasedAccessing still own independent kinds of state. The
[composition](https://github.com/Sanskriti-Slngh/Relay/blob/a0fc5c46ae1415e1f7562d2d800b4e0537c30a81/design/compositions/Relay.md)
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
- Detaching Context removes one connection but preserves the shared Note.
  Permanent deletion requires an explicit `DELETE`, removes its attachments and
  Questions, and keeps already-recorded Review evidence. Workspace archive is
  similarly reversible, while owner-only deletion verifies the workspace name
  before cascading through its data.

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
or recover from a mistake. An early Review repair screen showed Step editing,
Context replacement, detachment, target details, and resolution together. It
was complete but made the common room-policy task compete with uncommon repair
choices. The final flow shows the changed evidence, opens the affected Step for
direct editing, and keeps **Replace Context**, **Remove attachment**, and the
full Playbook editor behind progressive disclosure. Saving never resolves the
Review automatically, and an officer may resolve without editing after deciding
the instructions already fit the semester policy. Multi-Cause evidence and
multi-attachment selectors remain available when needed.

Empty workspaces explain the three-step task, and Context choices say whether
they create Review work. Unsaved drafts are guarded during navigation,
workspace changes, sign-out, and reload. Busy labels, partial-failure messages,
conflict panels, bounded reading measures, long-text wrapping, and mobile
reflow make state changes legible without introducing another visual language.

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

The [final code-changing P4 commit](https://github.com/Sanskriti-Slngh/Relay/commit/a0fc5c46ae1415e1f7562d2d800b4e0537c30a81)
supports the complete Owner/Member journey, Context and workspace lifecycles,
Review repair, conflict recovery, and responsive interaction. The project owner
deployed earlier commit `21a6fac0bbd6f86bdd587f2acc41030b3ff9e5fd` and reported
that its browser checks passed. Those were user-operated production checks, not
agent-controlled observations. Final HEAD passes automated and source-level
verification, but this audit does not treat the older deployment or an HTTP
success as proof that production runs the final commit.

Relay also has deliberate reliability limits. Reaction handling is not a
crash-safe outbox, standalone-Mongo serialization assumes one application
process, and Recent Activity is an awareness feed rather than an atomic audit
log. Those constraints are preferable to claiming guarantees the current
architecture does not provide.
