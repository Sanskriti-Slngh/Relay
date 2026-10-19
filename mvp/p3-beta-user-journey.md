# Relay P3 Beta user journey

- **Deployed app:** [relay.mit-sdg.dev](https://relay.mit-sdg.dev/)
- **Narrated demonstration:** [Relay — P3](https://youtu.be/2jB5J9K8b5Y)

The Owner of Dance Club signs in and finds two established Playbooks: **Book
Rehearsal Space** and **Renew Club Room Access**. Each presents the club's work
as ordered instructions. In the renewal Playbook, she attaches an existing
room-access Context Note to the relevant Step instead of copying its text. The
two Playbooks now depend on one shared explanation with one stable identity.

The Owner opens that shared Context and corrects a wording mistake with **Fix
wording**. Relay updates the note without creating Review work because its
meaning has not changed. When the underlying renewal requirement changes, she
uses **Information changed** instead. Relay identifies the two dependent
Playbooks, preserves the exact before-and-after text, and requests a Review for
each one. She inspects the affected procedures, confirms that they remain
correct, and leaves both decisions and their causes in finished Review history.

Next, the Owner opens **Workspace** and creates a one-time invitation tied to a
specific email address. A second person creates a separate account, accepts the
code, and joins Dance Club as a Member. The Member can read the Playbooks and
their supporting Context but cannot change the club's official knowledge.
While reading a room-access Step, the Member asks a Question beside the
instruction that needs clarification.

The unanswered Question becomes visible to the Owner in Relay's attention
queue and Questions inbox. She opens the Question, sees the Step it concerns,
and answers it. Relay keeps the original Question, its subject, and the answer
together for future members. The workflow uses two authenticated accounts and
normal application actions throughout; saved changes appear without a manual
page reload.
