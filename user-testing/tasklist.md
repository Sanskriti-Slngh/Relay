# P5: User Testing — Task List

**Application:** Relay  
**Test Workspace:** MIT SAAS  
**Study Duration:** Approximately 60 minutes (40 minutes allocated to tasks, 20 minutes to debriefing)  
**Actual Task Completion:** Participant 1: 34 minutes; Participant 2: 32 minutes

## 1. Study Context

MIT SAAS organizes recurring cultural events, including South Asian Formal, Garba Night, and C-Show. Planning these events involves procedures, policies, and organizational decisions that must be passed between student officers as leadership changes.

Participants took the role of an incoming SAAS officer responsible for preparing upcoming events and keeping the club's procedures accurate. They worked in a prepopulated Relay workspace containing Playbooks, Shared Context Notes, and Questions from club members. The scenarios and policies were realistic examples created for testing, not necessarily the club's actual operating policies.

The study investigated three central design questions:

- **Discoverability:** Can new officers find the information they need and understand how different pieces of knowledge relate?
- **Knowledge maintenance:** Can officers preserve decisions and update shared information without unnecessarily duplicating it across procedures?
- **Change management:** Can officers understand the consequences of a policy change, identify which procedures need attention, and distinguish necessary edits from confirmations that existing instructions remain correct?

Tasks progressed from locating and interpreting information to modifying procedures and evaluating the effects of changes. Participants received goals rather than instructions on how to navigate the interface.

## 2. Task List

| Task | Instruction to Participant | Rationale |
|---|---|---|
| **1. Find an existing policy (4 min)** | You are helping plan South Asian Formal and need to know how far in advance catering must be finalized. Find the current requirement and determine which other club activities depend on it. | Tests whether participants can locate organizational knowledge and recognize relationships between procedures. I wanted to observe where they first looked and whether they discovered shared dependencies without knowing how Relay organizes information. |
| **2. Respond to a member (4 min)** | A member has asked whether they can bring a friend who does not attend MIT to South Asian Formal. Find the question and provide an answer based on the club's existing guidance. | Tests whether participants can discover unanswered Questions, locate supporting information, and respond confidently. Their navigation reveals whether they expect Questions alongside procedures or elsewhere, and how they determine that an answer is supported. |
| **3. Improve an existing procedure (7 min)** | During last year's Formal, several dietary restrictions were missed when the food order was submitted. Update the planning instructions so future officers check dietary restrictions before ordering food, without losing the existing catering guidance. | Tests how participants maintain an established Playbook while preserving the reasoning behind it. I wanted to observe whether they edited an existing Step or added another, how they decided where it belonged, and whether they distinguished procedural actions from supporting policies. |
| **4. Preserve a new decision (6 min)** | The SAAS board has decided that volunteer leads must be confirmed at least 48 hours before major events, with a backup designated for each lead. Make sure future officers planning South Asian Formal or Garba Night can find and follow this decision. | Tests whether participants can preserve new organizational knowledge across multiple procedures. I wanted to see whether they independently recognized the opportunity to reuse shared information instead of recording the same decision separately. |
| **5. Record a policy change (5 min)** | SAAS's catering coordinator has announced that final food orders must now be submitted at least seven days before an event, rather than three days. Record the new requirement so future officers can also understand what the previous policy was. | Tests whether participants distinguish a meaningful policy change from a wording correction. Their behavior reveals how they interpret the options and whether they anticipate the consequences for dependent procedures. |
| **6. Reconsider affected procedures (9 min)** | South Asian Formal and Garba Night are both being planned under the updated catering requirement. Check their instructions, make any necessary corrections, and finish the review work associated with these two events. | Tests Relay's central workflow: evaluating procedures after shared information changes. I wanted to observe whether participants understood the recorded change, identified affected instructions, and recognized when review work was complete. |
| **7. Verify the handoff (5 min)** | Another officer asks what changed about the catering deadline. Find the old and new requirements so you can explain the difference. Then check whether C-Show's existing catering instructions still satisfy the new policy and finish any remaining review work. | Tests whether participants can retrieve historical information and distinguish a policy change from a necessary procedural change. C-Show already has a stricter deadline, allowing observation of whether participants can confirm existing instructions without making unnecessary edits. |

**Total estimated task time: 40 minutes.**

The estimated durations were planning targets, not strict deadlines. Participants were allowed to work through difficulties without being interrupted simply because a task took longer than expected.

## 3. Study Setup

Each participant worked with an equivalent prepopulated workspace containing three Playbooks:

- **South Asian Formal Planning:** Included catering, guest check-in, and event preparation procedures, with an initial three-day catering deadline.
- **Garba Night Setup:** Included venue, volunteer, and refreshment coordination, also with an initial three-day catering deadline.
- **C-Show Performer Coordination:** Included performer communication, scheduling, and preparation, with a catering instruction requiring orders at least 14 days in advance.

The original shared catering policy required final food orders at least three days before an event and was attached to all three Playbooks. This created different outcomes when participants changed the requirement to seven days. Formal and Garba Night required updates, while C-Show's existing instructions remained valid.

The workspace also contained a guest-access policy linked to South Asian Formal and an unanswered member Question concerning non-MIT guests.

The volunteer-lead decision and seven-day catering requirement were not present initially. Participants introduced these changes during their tasks.

Both participants used Officer permissions and equivalent starting data. The setup was designed to prevent changes from one session from affecting the other.

### Test Workspace Screenshots

Relay uses authenticated, account-specific workspaces, so the MIT SAAS testing data is not automatically visible to someone opening the deployed application with a different account. The screenshots below document the initial workspace used for the studies.

- [SAAS Overview](screenshots/overviewpage.png) — The initial workspace overview shown to participants.
- [SAAS Playbooks](screenshots/playbookspage.png) — The three event procedures available to participants.
- [Shared Catering Policy](screenshots/sharedcontextpage.png) — The original three-day requirement and its connections to multiple Playbooks.
- [Member Question](screenshots/questionspage.png) — The unanswered guest-policy question provided at the start of testing.

These screenshots show the prepared state before participants completed their tasks. The application remains available at [relay.mit-sdg.dev](https://relay.mit-sdg.dev/), but accessing the testing workspace requires workspace membership.

## 4. Study Conduct

### Participants and Consent

Two MIT SAAS participants completed the study independently. Neither was enrolled in 6.1040. Participant 1 was an existing officer familiar with the challenges of transferring organizational knowledge, while Participant 2 was a newer member with less experience maintaining club procedures.

Before each session, I explained that the purpose was to evaluate Relay rather than the participant's performance. I also explained that participants could stop at any time and that completing every task was not required. **Both participants gave consent before testing began.**

### Facilitation

Participants were encouraged to think aloud as they worked, describing what they expected, what they noticed, and anything they found confusing.

I avoided teaching the interface or directing them toward particular controls. Both participants completed the seven tasks without navigation assistance.

After the task sessions, I introduced a separate follow-up exercise for each participant to investigate whether an earlier difficulty persisted. Participant 1 repeated a comparable Context update, while Participant 2 repeated a Step-reordering interaction. These exercises were additional observations rather than assistance with the original tasks.

### Observation and Evidence

During the sessions, I focused on four kinds of evidence:

- **Actions and outcomes:** What participants attempted, whether they reached the goal, and whether assistance was needed.
- **Hesitation and recovery:** Where they paused, reconsidered an action, tried another approach, or recovered independently.
- **Expectations and comments:** What they expected an action to do and how they explained unexpected behavior.
- **Execution and evaluation:** Whether difficulties arose from identifying an action or understanding what happened afterward.

I distinguished observed behavior from possible explanations. For example, looking for a policy within a Playbook does not necessarily mean a participant misunderstands Shared Context; it may simply reflect how the task was presented.

## 5. Debriefing

After the task sessions, I discussed participants' expectations, moments of uncertainty, and suggestions for improvement.

The debriefing was guided by questions such as:

1. When you were looking for a policy or decision, where did you initially expect to find it?
2. What did you expect to happen when you changed the catering requirement?
3. How did you decide whether a procedure needed editing or could remain unchanged?
4. Were there any moments when Relay behaved differently from what you expected?
5. Which parts of the experience would be most useful for a real student club, and what would you change first?

Follow-up questions focused on difficulties that emerged during the sessions rather than asking participants to agree with explanations I had already formed.

## 6. Analysis Approach

Each study was summarized in a separate report describing significant actions, hesitation, recovery, and participants' explanations during debriefing.

I compared the two participants' behavior rather than assuming their experiences represented all potential Relay users. Their different levels of familiarity with SAAS were useful context, particularly when interpreting how each approached the relationship between Playbooks and Shared Context.

For important difficulties, I considered multiple explanations. A hidden control, for example, could be difficult to notice because of its placement, unfamiliar terminology, or expectations formed by other applications.

The follow-up exercises provided additional evidence about initial discoverability and learnability. Both participants performed the repeated interactions without noticeable hesitation, suggesting that some difficulties may be concentrated in first-time use. However, immediate repetition also benefits from recent exposure, so these observations do not establish long-term learnability.

The findings were organized into four design opportunities, each with supporting evidence, a possible cause, a proposed improvement, and a severity classification. Improvements were prioritized according to their consequences for maintaining accurate knowledge, how easily participants recovered, and the uncertainty remaining in each interpretation.

The study helped distinguish between functionality that works correctly and an interface that communicates its behavior clearly to someone encountering it for the first time.