# P2 MVP User Journey

A newly elected student-club officer inherits two Playbooks: **Plan the Annual
Club Showcase** and **Renew Club Room Access**. Both rely on one shared Context
Note describing a hypothetical club room-renewal policy. The officer records
the note once, attaches it to the relevant Step in both Playbooks, and corrects
a typo; because that edit is a correction rather than a change in meaning,
Relay creates no Reviews. The officer then records a meaningful change from
annual renewal to semester renewal. Relay preserves the exact before/after
Cause and automatically creates one pending Review for each affected active
Playbook. The officer verifies that one Playbook remains correct and confirms
that Review, while the other Review remains pending. The policy in this demo is
fictional demonstration content, not an assertion about current MIT rules.

## P2 scope

This coherent MVP runs with one host-configured `ClubWorkspace` and one
host-configured Officer. It implements four independent concepts:
`ProcedureMaintaining`, `ContextTracking`, `Reviewing`, and
`RoleBasedAccessing`; the Relay composition coordinates their cross-concept
behavior. The implemented Archive Playbook operation is part of this P2 MVP:
it retires a Procedure while preserving its Steps, Context attachments, and
Review history.

Member questions, multiple clubs, general registration, multi-user
authentication, and complete editing and Review-resolution workflows are
deferred to P3. The broader [P1 user journey](./user-journey.md) remains a
design-direction document and should not be read as a claim that those deferred
features are implemented in P2.
