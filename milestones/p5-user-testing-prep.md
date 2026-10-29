# Relay P5 user-testing preparation

This is a test plan, not a record of participant results. Predicted difficulties
below are prompts for observation and must not be reported as findings unless a
participant actually demonstrates them.

## 1. Test objective

Determine whether a first-time student-club member or officer can understand
Relay's model and complete meaningful work without developer guidance. The
test should reveal whether participants understand the relationship among an
ordered Playbook, its shared Context, the Reviews created by a meaningful
Context change, and Questions attached to official knowledge. Successful
button presses are not enough: the participant should be able to explain what
changed and why Relay produced the result.

## 2. Participant tasks and observations

### Task 1: Prepare for a room booking

**Scenario:** “Your club is booking its rehearsal room. Use the club's saved
knowledge to work out what to do and why the access-renewal step matters.”

- **Success:** Finds the relevant Playbook, follows its Step order, opens the
  attached Context, and can explain how the Context supports the Step.
- **Potential confusion to watch for:** Whether “Playbook,” “Step,” “Context,”
  or **Why this matters** communicates the intended relationship.
- **Note:** First destination chosen, whether the participant scans Overview or
  navigation first, whether attached Context is noticed, help requested, and
  their explanation of the result.

### Task 2: Record a changed room-access policy

**Scenario:** “You are an Officer and have learned that room access must now be
renewed each semester rather than annually. Update the club's shared knowledge
so every affected procedure receives appropriate attention.”

- **Success:** Finds the shared Note, chooses **Information changed**, updates
  it, and identifies the two Playbooks that now require Review.
- **Potential confusion to watch for:** Choosing **Fix wording** versus
  **Information changed**, predicting the consequence, or finding the affected
  Playbooks afterward.
- **Note:** Where the participant starts, what they expect before saving,
  whether they inspect the consequence text, help requested, and whether they
  understand why two Reviews appeared.

### Task 3: Decide what each affected Playbook needs

**Scenario:** “Check the two affected Playbooks. One procedure still works as
written; the other contains an instruction that must change. Leave both in an
accurate finished state.”

- **Success:** Uses **Still correct** for one Review; marks the other **Needs
  updating**, edits the relevant instruction, returns, and resolves it.
- **Potential confusion to watch for:** Treating the Context change as proof
  that every Playbook is wrong, distinguishing the two decisions, or knowing
  when and where to resolve the second Review.
- **Note:** Evidence read before deciding, navigation between Review and
  Playbook, whether the return path is understood, help requested, and the
  participant's explanation of each final status.

### Task 4: Resolve uncertainty as a Member

**Scenario:** “As a Member, you are unsure who confirms room availability.
Leave that uncertainty where a future reader would encounter it. Later, find
the Officer's response.”

- **Success:** Asks a Question on the relevant Step, then finds the answer after
  the test Officer submits it from the separate Officer session.
- **Potential confusion to watch for:** Looking for editing controls that a
  Member should not have, finding the Question action, or expecting an instant
  answer without another person responding.
- **Note:** Where the Question is attached, whether role boundaries are
  understood, whether the participant waits or navigates, help requested, and
  whether they understand that the answer remains with its subject.

## 3. Test environment

Use a separate fictional workspace such as **P5 Rehearsal Club — Session 01**.
Do not alter an existing production club or its records. Use neutral test-only
identities and fictional content; never enter real member names, email
addresses, policies, credentials, or invitation codes in notes or recordings.

Prepare three controlled accounts:

- An Owner who creates the workspace and manages membership.
- An Officer invited as a Member and then promoted by the Owner.
- A Member who remains read-only for official knowledge.

Run Tasks 1–3 in the Officer session and Task 4 in the Member session. For a
study with separate participants by role, give each person only the tasks their
assigned role can perform rather than explaining unavailable controls.

Create two active Playbooks—**Book Rehearsal Space** and **Renew Room
Access**—with three short ordered Steps each. Attach one shared Context Note,
“Room access is renewed annually under this fictional club policy,” to one
relevant Step in each Playbook. Ensure there are no unfinished Reviews. Keep
the Owner or Officer signed in separately so Task 4's answer can be supplied
without exposing credentials.

For another participant, create a fresh numbered fictional workspace and
repeat the small setup. This is the safest reset because Review and Question
history is intentionally durable and Playbooks are archived rather than
deleted. If account reuse is necessary, switch each controlled account to the
new workspace and verify its role before the session. Do not reuse or disclose
old invitation codes. No seed script, backend change, or production database
operation is needed.

## 4. Facilitation and feedback

### Neutral introduction

“We are testing Relay, not you. Relay is a shared knowledge application for
student clubs. Please approach these scenarios as you normally would; there is
no single required route. If you are comfortable, think aloud about what you
expect, what you notice, and what feels unclear. I may stay quiet so I do not
influence your choices.”

Do not name a destination, point at a control, complete text, or explain a term
while the participant is working. If they stop, first ask, “What are you looking
for?” Record any help verbatim and give only the minimum neutral clarification
needed to continue. Separate a task failure from a misunderstanding of the
scenario or missing test data.

After the tasks, ask:

1. “Which term or part of Relay was hardest to understand?”
2. “How did you decide whether changed information meant a Playbook was still
   correct or needed updating?”
3. “What, if anything, would make the overall workflow clearer?”

### Compact note template

- Participant code and assigned role: __________
- Session/workspace code: __________
- Task: ___  Outcome: PASS / PARTIAL / STOPPED
- Route and notable actions: ____________________________________
- Help requested or given: ______________________________________
- Participant's explanation of the result: _______________________
- Observed confusion or error (not prediction): __________________
- Exact useful quote, with permission: ___________________________
- Possible product issue to investigate: _________________________

Do not record names, personal contact information, credentials, invitation
codes, or unrelated screen content.

## 5. Readiness assessment

The deployed application supports all four tasks: Playbook and attached-Context
reading, meaningful Context changes with affected Reviews, both Review decision
paths, role-restricted Questions and answers, polling, and persistence were
reported as passing after deployment of the current P4 commit. This is readiness
evidence, not user-testing evidence.

There is no genuine application blocker to beginning later P5 sessions. The
test requires only controlled accounts, a clean fictional workspace, and a
facilitator able to answer Task 4 from the Officer session. Predicted difficulty
with Relay's terminology, change classification, Review decisions, or role
boundaries is the subject of the test, not an application defect unless a
participant is prevented from completing a supported action.
