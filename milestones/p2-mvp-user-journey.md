# P2 MVP User Journey

Starting from a clean, host-provisioned workspace, a newly elected student-club officer records two inherited procedures as Playbooks: **Plan the Annual Club Showcase** and **Renew Club Room Access**, each with its relevant ordered Steps. Both depend on the same fictional club room-renewal policy, so the officer records one shared Context Note and attaches it to the relevant Step in each Playbook. Correcting a typo changes the wording without creating Reviews. When the policy meaningfully changes from annual to semester renewal, Relay preserves the exact before-and-after text and creates two pending Reviews, one for each affected Playbook. The officer verifies that one Playbook remains correct and confirms that Review; the other remains pending. This demonstrates how Relay records shared knowledge once, preserves why procedures need reconsideration, and lets an officer review each affected procedure independently. The policy is demonstration content, not a statement about current MIT rules.

## P2 Scope

The P2 MVP supports a complete workflow within one host-configured `ClubWorkspace`, operated by one host-configured Officer. It implements four independent concepts:

- `ProcedureMaintaining` — stores Playbooks and their ordered Steps.
- `ContextTracking` — records shared Context Notes, attachments, corrections, and meaningful changes.
- `Reviewing` — tracks affected Playbooks, preserves Review Causes, and manages pending and completed Reviews.
- `RoleBasedAccessing` — enforces permissions for workspace operations.

The Relay composition coordinates these concepts through reactions, including automatically generating Reviews when shared Context changes meaningfully. The frontend updates without requiring manual page refreshes, and MongoDB preserves the underlying data.

The MVP also supports archiving Playbooks while retaining their Steps, Context attachments, and Review history. This functionality is implemented but is not part of the recorded core journey.

Member questions, multiple clubs, general account registration, multi-user authentication, and complete Playbook editing and Review-resolution workflows are deferred to P3. The broader [P1 user journey](../design/user-journey.md) remains a design-direction document and should not be interpreted as functionality already implemented in P2.
