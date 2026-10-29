# Relay — Final Design

## 1. The idea behind Relay

I started Relay because student-club handoffs can fail in two ways: important knowledge disappears when officers leave, or outdated knowledge keeps being passed down as if it were still correct.

Consider two club procedures that rely on the same room-access policy. If renewal changes from once a year to every semester, someone could update one procedure and forget the other. Even if both are corrected, future officers might never know why those instructions changed.

Relay addresses this by separating **Playbooks**, which contain ordered instructions, from **Context Notes**, which preserve the policies, decisions, and experience behind them. A Note can support several Playbooks. When its meaning changes, Relay preserves the old and new information and creates Reviews for the affected procedures.

The goal is to help officers recognize when their instructions need attention, not to decide automatically what those instructions should say.

## 2. From P1 concepts to the P4 application

My P1 design established five concepts: `ProcedureMaintaining`, `ContextTracking`, `Questioning`, `Reviewing`, and `RoleBasedAccessing`.

I kept these boundaries throughout development. `ContextTracking` owns shared knowledge and its changes, while `Reviewing` only knows that an Item needs reconsideration for one or more Causes. The composition connects them without making either concept responsible for the other's state.

P4 made me reconsider what happens when these concepts are used by real people.

- **From a trusted officer to multiple users.** P1 assumed an already-established workspace and officer. Relay now supports authenticated accounts, persistent sessions, invitations, multiple workspaces, and Owner, Officer, and Member roles. The server verifies identity and permissions instead of trusting information supplied by the browser.

- **From individual edits to concurrent work.** I added version checks so two officers cannot silently overwrite each other's changes. When a save conflicts with newer information, Relay preserves the unsaved draft and displays the current version for comparison. Protecting the database would have been insufficient if the officer still lost their writing.

- **From removing information to managing its relationships.** Detaching a Context Note from one Step must not delete a Note shared by other Playbooks. Detachment and deletion are separate operations, and previously recorded Review evidence is preserved. I also added recovery for partial failures, such as successfully creating a Note but failing to attach it.

### The bug that changed my understanding of composition

The most important issue I encountered involved concurrent Context changes.

When two Notes changed almost simultaneously, both Changes were recorded, but one could disappear from the resulting Review. `Reviewing` correctly prevented duplicate unfinished Reviews; the composition failed to preserve the second Cause after that rejection.

I considered relaxing the uniqueness constraint, but duplicate Reviews would make the officer's work harder. Instead, I kept **one unfinished Review per Playbook** and added a composition reaction that recovers a rejected request by attaching its Cause to the existing Review.

This taught me that each concept can satisfy its own specification while the application still loses information between them. The fix belonged in the [composition](https://github.com/Sanskriti-Slngh/Relay/blob/8c1638897719b00de7e8cbfc76c6bf02806236d9/src/compositions/Relay.ts), not in either concept.

## 3. From P3 visual design to P4

The P3 interface already had the visual direction I wanted: document-like Playbooks, Inter typography, neutral backgrounds, evergreen accents, and restrained use of color.

However, some screens were still organized around all the operations Relay supported rather than the task an officer was trying to complete.

### Making Reviews easier to follow

The original Review interface put Context changes, affected instructions, editing forms, replacement options, and resolution controls close together. I thought showing everything would make the functionality easier to discover. Instead, it made the primary task harder to identify.

For P4, I organized Reviews into a clearer sequence:

1. **Understand the change.** Show the recorded Context before and after the update.
2. **Check the affected instructions.** Identify the Steps that depend on that Context, with access to the rest of the Playbook.
3. **Make a decision.** Choose **Still correct** or **Needs updating**. Repair options become relevant when the officer chooses to update the Playbook.

I kept uncommon actions, including replacing or detaching Context, without giving them the same visual importance as the main decision. Saving an edited Step also remains separate from resolving the Review, since an officer may still need to check other instructions.

### Applying the same approach elsewhere

- **Playbooks and Context:** Supporting information stays close to the Step it explains. Editing controls appear where officers need them, while secondary forms and history can stay collapsed.
- **Questions:** Questions remain attached to the specific Step or Note that prompted them, rather than becoming disconnected conversations.
- **Feedback and recovery:** Conflict messages preserve drafts, actions show their progress, and errors explain what happened. Responsive layouts and visible keyboard focus make the same workflows usable on smaller screens.

I learned that visual polish wasn't primarily about adding more styling. Often, the better change was to remove repeated explanations or delay showing a control until it was relevant.

## 4. Decisions and tradeoffs

There are three decisions I would keep:

- **Let officers make the final judgment.** A Context change is evidence that a procedure might be outdated, not proof that it is wrong. Relay identifies the impact but does not rewrite instructions automatically.
- **Preserve concept independence.** A `needsReview` flag inside Playbooks would simplify one workflow, but it would mix procedural knowledge with the separate responsibility of tracking human review.
- **Use polling rather than subscriptions.** Relay refreshes every three seconds and when a tab becomes visible. This is sufficient for the project's scale and avoids a more complicated real-time system, at the cost of a short delay.

Relay also has limits. Relay currently shows pending Reviews inside the app rather than notifying officers when something changes. Invitations also require manually sharing a code. I still need to test Relay with officers who haven't seen it before to understand whether they can navigate these workflows without guidance which will come in P5.

## 5. Final result

The P4 implementation supports the complete multi-user workflow, including shared Context changes, Reviews, Questions, access control, conflict recovery, and responsive interactions. The [testing record](../milestones/p4-deployment-verification.md) contains the automated and deployed-app evidence.

The core concept from P1 remained intact. What changed most was my understanding of what it takes to make that concept reliable and understandable. P4 forced me to think about the moments when an officer might lose work, misunderstand a consequence, or be unsure what to do next.

Those details matter because Relay is meant to preserve knowledge that someone else will eventually have to trust.