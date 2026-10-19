# Relay P3 Beta user journey

Tiya, the Owner of a student club workspace, creates a Playbook for booking rehearsal
space and adds its first ordered Step. Relay opens an optional Context editor
beside that Step, so she records why the renewal check matters without leaving
the Playbook. The saved Playbook reads as instructions; its Context and
secondary controls remain available beside the relevant Step.

Tiya invites Sam using a one-time, email-bound invitation code. Sam registers
as a distinct user, accepts the invitation, and enters the same club as a
Member. Sam can read the Playbook and its attached Context but cannot edit
official knowledge. When a Step is unclear, Sam asks a Question beside it. The
Question appears in Tiya's officer inbox and unanswered navigation count.
Tiya answers it, and both sessions receive the update through Relay's regular
workspace refresh. The original Question, answer, subject, and answer ownership
remain in history; Tiya may revise her own answer later.

When the rehearsal-space policy changes from annual to semester renewal, Tiya
opens the shared Context Note and chooses **Information changed**, rather than
**Fix wording**. Relay shows how many active Playbooks will need attention,
preserves the exact before-and-after text, and creates or updates their Reviews.
For a Playbook that remains correct, Tiya confirms the Review. For the booking
Playbook, she marks the Review as requiring changes and opens the exact affected
Playbook. The changed Context remains visible while she edits its Step, and a
direct return takes her back to the same Review. She resolves it after checking
the edit. Finished Review history retains the cause, while both users continue
to see the updated Playbook after refresh.

This journey uses Relay's authenticated accounts, workspace
membership, authorized operations, Vue interface, sync-engine reactions and
formers, and MongoDB persistence. The deployed walkthrough must use the public
application without fixture data, request-body identities, or direct database
edits.
