# Relay collaborative version-control contract

## Purpose

Relay uses optimistic concurrency control to prevent one Officer from silently overwriting another Officer's work. Every response that exposes editable domain state includes a server-managed integer `version`. An edit sends the version the user actually began editing. The server applies the action only if that version is still current.

This is concurrency control, not Git-style branching. Relay does not create parallel copies of a Playbook, invent merge results, or add a second audit system. Existing Context change history, Review history, Question/answer ownership, stable Step identities, and Recent Activity continue to provide the history appropriate to their concepts.

## Shared rules

1. A newly created mutable resource starts at version 1.
2. Each successful action that changes that resource increments its version exactly once.
3. A client mutation supplies `expectedVersion`, captured when the edit or decision began.
4. Authorization, workspace ownership, and resource validation run on the server as before. The submitted version never identifies the actor or workspace.
5. The write uses a compare-and-swap guard against the current version. A mismatch returns `VERSION_CONFLICT`; it performs no partial domain write, reaction, Review creation, or successful activity entry.
6. The UI refreshes current server state after a conflict but preserves any text the user typed. It places the current saved value beside the unsaved draft and offers explicit choices instead of exposing the internal error code.
7. Existing records without a stored version are migrated to version 1. Relay never guesses an author or fabricates earlier versions.

## Action results

| Resource | Action | Version result | Concurrent behavior |
| --- | --- | --- | --- |
| Playbook | Create | Playbook version 1 | Independent creation; no precondition. |
| Playbook | Rename | Playbook +1 | A stale rename is refused. The typed title remains available to copy or retry. |
| Playbook | Archive | Playbook +1 | A stale archive is refused; an already archived Playbook remains unavailable. |
| Playbook order | Add Step | Playbook +1; new Step version 1 | A stale structural view is refused so the new Step is not inserted at an unintended position. |
| Playbook order | Move Step | Playbook +1 | Concurrent reorders do not silently replace each other. Moving a Step to its existing position is unchanged and creates no new version or activity. |
| Playbook order | Remove Step | Playbook +1 | A stale structural view is refused. Removal still preserves the Step identity and history. |
| Step text | Edit Step | Step +1 | Officers may safely edit different Steps at the same time. Two edits to the same Step conflict; the later stale draft is preserved in the browser. Reordering does not invalidate an in-progress text edit because order and text have separate versions. |
| Context Note | Create | Context Note version 1 | Independent creation; no precondition. |
| Context Note | Fix wording | Context Note +1 | A stale correction is refused and creates no Review. |
| Context Note | Information changed | Context Note +1 | A stale change is refused and creates no Change or Review. A successful change preserves exact before/after text and triggers the existing affected-Playbook Review behavior once. |
| Question | Ask | Question version 1 | Append-only creation; no precondition. |
| Question | Answer | Question +1 | Only one answer can win the OPEN-to-ANSWERED transition. A repeat or stale answer is refused. |
| Question | Revise answer | Question +1 | Only the original answerer may revise. Two revisions based on the same answer cannot silently overwrite one another. |
| Review | Request | Review version 1 | The existing one-unfinished-Review constraint remains authoritative. |
| Review | Add a Context-change cause | Review +1 | This is an internal reaction. It atomically adds a new cause only when absent; duplicate causes remain impossible. |
| Review | Still correct | Review +1 | A stale decision is refused; only a current PENDING Review can complete. |
| Review | Needs updating | Review +1 | A stale decision is refused; only a current PENDING Review can enter CHANGES_REQUIRED. |
| Review | Resolve | Review +1 | A stale decision is refused; only a current CHANGES_REQUIRED Review can complete. |
| Review | Cancel | Review +1 | A stale decision is refused; causes and history remain preserved. |

## State that uses guarded transitions instead of editable versions

Not every record benefits from a client-visible counter:

- Context attachments are relationship records with stable IDs and uniqueness constraints. Attach/detach operations are atomic; a failed or duplicate attachment cannot be logged as successful.
- Invitations are single-use, server-expiring capabilities. Their OPEN-to-ACCEPTED or OPEN-to-REVOKED transition is already conditional and atomic.
- Membership and ownership changes are server-authorized state transitions. Exactly-one-role and exactly-one-Owner rules are enforced at the authoritative AccountStore layer, including its serialized standalone-Mongo fallback. Revoked membership is checked on every request.
- Sessions are server-owned credentials, not collaboratively edited documents.
- Recent Activity and Context/Review change records are append-only evidence. They are written only after successful authorized actions and are never edited in place.

These operations still reject invalid current state; accepting a client-supplied version would not make them safer.

## UI behavior

- Read models carry the relevant versions but do not display them as visual clutter.
- Opening a rename, Step editor, Context updater, answer editor, or Review decision captures its current version.
- Three-second polling may update other content but must not replace a local draft or its captured version.
- After a successful action, Relay immediately refreshes the workspace and uses the returned/current version for the next action.
- On `VERSION_CONFLICT`, Relay keeps the current workspace selected, preserves user input, refreshes server data, and says that someone else saved a newer version.
- Text edits show the current saved value beside the user's unsaved value. **Use saved version** discards only that local draft. **Save my version** retries against the newly displayed version; the server performs the version check again, so another intervening save produces another conflict instead of being overwritten.
- A stale new-Step operation uses the more accurate choices **Keep current steps** and **Add my step** because it adds to, rather than replaces, the current structure.
- If another Officer answers an open Question first, Relay preserves and displays the losing draft. It cannot offer an overwrite when the current user is not the original answerer; the UI explains that ownership rule and offers **Use saved answer**. If the same original answerer made both changes, their normal answer-revision permission remains available with a fresh version check.

## Atomicity boundary

The domain mutation and its version comparison occur in the same MongoDB transaction, or in the same serialized critical section on standalone MongoDB. Existing multi-document Step ordering and Context-change writes keep their current `runAtomically` boundary. Host-level Recent Activity remains intentionally non-atomic with concept mutations, so it is useful collaboration context rather than an audit-complete ledger.
