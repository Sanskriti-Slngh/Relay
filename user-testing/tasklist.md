# P5: User Testing — Task List

**Application:** Relay  
**Test Workspace:** MIT SAAS  
**Study Duration:** Approximately 60 minutes (40 minutes of tasks, 20 minutes of debriefing)

## 1. Study Context

MIT SAAS organizes recurring cultural events, including South Asian Formal, Garba Night, and C-Show. Planning these events involves procedures, policies, and organizational decisions that must be passed between student officers as leadership changes.

Participants take the role of an incoming SAAS officer responsible for preparing upcoming events and keeping the club's procedures accurate. They work in a prepopulated Relay workspace containing Playbooks, Shared Context Notes, and Questions from club members. The scenarios and policies are realistic examples created for testing, not necessarily the club's actual operating policies.

The study investigates three central design questions:

- **Discoverability:** Can new officers find the information they need and understand how different pieces of knowledge relate?
- **Knowledge maintenance:** Can officers preserve decisions and update shared information without unnecessarily duplicating it across procedures?
- **Change management:** Can officers understand the consequences of a policy change, identify which procedures need attention, and distinguish necessary edits from confirmations that existing instructions remain correct?

Tasks progress from locating and interpreting information to modifying procedures and evaluating the effects of changes. Participants will receive goals rather than instructions on how to use the interface.

## 2. Task List

| Task | Instruction to Participant | Rationale |
|---|---|---|
| **1. Find an existing policy (4 min)** | You are helping plan South Asian Formal and need to know how far in advance catering must be finalized. Find the current requirement and determine which other club activities depend on it. | Tests whether participants can locate organizational knowledge and recognize relationships between procedures. I want to observe where they first look and whether they discover shared dependencies without already knowing how Relay organizes information. Their choices may reveal expectations about where policies should live that I would not encounter when navigating my own application. |
| **2. Respond to a member (4 min)** | A member has asked whether they can bring a friend who does not attend MIT to South Asian Formal. Find the question and provide an answer based on the club's existing guidance. | Tests whether participants can discover unanswered Questions, locate supporting information, and respond confidently. I want to observe whether they expect questions to appear alongside procedures or in a separate location, and how they establish that an answer is supported by existing knowledge. |
| **3. Improve an existing procedure (7 min)** | During last year's Formal, several dietary restrictions were missed when the food order was submitted. Update the planning instructions so future officers check dietary restrictions before ordering food, without losing the existing catering guidance. | Tests how participants maintain an established Playbook while preserving the reasoning behind it. I want to observe whether they edit an existing instruction or add a new one, how they decide where it belongs, and whether they distinguish procedural actions from supporting policies. |
| **4. Preserve a new decision (6 min)** | The SAAS board has decided that volunteer leads must be confirmed at least 48 hours before major events, with a backup designated for each lead. Make sure future officers planning South Asian Formal or Garba Night can find and follow this decision. | Tests whether participants can preserve new organizational knowledge and make it relevant to multiple procedures. I want to see whether they independently recognize that the decision can be shared, or instead reproduce it separately within each event's instructions. Their approach may reveal whether Relay's model of reusable knowledge matches their expectations. |
| **5. Record a policy change (5 min)** | SAAS's catering coordinator has announced that final food orders must now be submitted at least seven days before an event, rather than three days. Record the new requirement so future officers can also understand what the previous policy was. | Tests whether participants distinguish a meaningful change in organizational knowledge from a minor wording correction. I want to observe how they interpret the available options, what consequences they anticipate, and whether the resulting application state matches their expectations. |
| **6. Reconsider affected procedures (9 min)** | South Asian Formal and Garba Night are both being planned under the updated catering requirement. Check their instructions, make any necessary corrections, and finish the review work associated with these two events. | Tests Relay's central workflow: moving from changed shared knowledge to evaluating and updating the procedures that depend on it. I want to observe whether participants understand the recorded changes, can identify affected instructions, and recognize when their work is complete without additional guidance. |
| **7. Verify the handoff (5 min)** | Another officer asks what changed about the catering deadline. Find the old and new requirements so you can explain the difference. Then check whether C-Show's existing catering instructions still satisfy the new policy and finish any remaining review work. | Tests whether participants can retrieve historical information and distinguish a policy change from a necessary procedural change. C-Show's existing deadline is already stricter than the new policy, so I want to see whether participants recognize that its instructions can remain unchanged and confidently complete the review. |

**Total estimated task time: 40 minutes.**

The estimated durations are planning targets, not strict deadlines. Participants will be allowed to work through difficulties without being interrupted simply because a task is taking longer than expected. 

## 3. Study Setup

Each participant will begin with an equivalent prepopulated workspace containing three Playbooks:

- **South Asian Formal Planning:** Includes catering, guest check-in, and event preparation procedures. Its original catering instruction specifies a three-day deadline.
- **Garba Night Setup:** Includes venue, volunteer, and refreshment coordination. Its original catering instruction also specifies a three-day deadline.
- **C-Show Performer Coordination:** Includes performer communication, scheduling, and event preparation. For this scenario, it includes a catering instruction requiring orders at least 14 days in advance.

The initial shared catering policy requires final food orders at least three days before an event and is attached to all three Playbooks. This creates an intentional distinction when the policy changes to seven days: Formal and Garba Night require updates, while C-Show's existing deadline remains valid.

The workspace will also contain a guest-access policy linked to South Asian Formal and an unanswered member Question concerning non-MIT guests.

The volunteer-lead decision and updated seven-day catering requirement will not exist in the initial state. Participants will introduce these changes during the study.

Both participants will have Officer permissions and receive equivalent starting data. Separate identically prepared workspaces, or a verified reset of the original state, will prevent changes from the first study from affecting the second. The initial state will be checked before each session, including the absence of Reviews created by the seven-day policy change.

The app requires login info but to see the setup see 
- [overview page](user-testing/screenshotswithdeployedapp/overviewpage.png)
- [playbooks page](user-testing/screenshotswithdeployedapp/playbookspage.png)
- [shared context page](user-testing/screenshotswithdeployedapp/sharedcontextpage.png)
- [questions page](user-testing/screenshotswithdeployedapp/questionspage.png)

## 4. Study Conduct

### Participants and consent

Two participants who are not enrolled in 6.1040 will complete the study independently. Their familiarity with student organizations, event planning, and similar software will be documented to help interpret their behavior.

Before beginning, I will explain that the study evaluates Relay rather than the participant's abilities, that there is no expectation of completing every task successfully, and that they may stop at any time. I will obtain consent before taking study notes and separate permission for any audio or screen recording.

### Facilitation

Participants will be encouraged to think aloud, including describing what they are looking for, what they expect an action to do, and how they interpret the result.

I will avoid teaching the interface or identifying the controls needed to complete a task. If someone becomes quiet, I may ask neutral questions such as "What are you thinking right now?" or "What were you expecting to happen?"

If a participant becomes stuck, I will first allow time for independent exploration. I will intervene only when they cannot make meaningful progress after repeated attempts or explicitly need assistance to continue. Any assistance will be limited to what is necessary to proceed and documented in the study notes. Completing a task with assistance will not be recorded as independent success.

### Observation and evidence

For each task, I will record:

- **Actions and outcomes:** What the participant attempted, whether they reached the goal, and whether assistance was required.
- **Hesitation and recovery:** Where they paused, retraced their steps, tried another approach, or recovered from an unexpected result.
- **Expectations and comments:** What they said they expected, including spontaneous reactions and explanations offered during the debrief.
- **Execution and evaluation:** Whether difficulties arose from identifying how to perform an action or interpreting what the application had done afterward.

I will distinguish observed behavior from my interpretation of that behavior. For example, repeatedly opening a Playbook while searching for a shared policy is an observation; concluding that the participant does not understand Shared Context is only one possible explanation.

## 5. Debriefing

The final 20 minutes will focus on participants' experiences, particularly moments of unexpected behavior or hesitation observed during the tasks.

Questions will include:

1. When you were looking for a policy or decision, where did you initially expect to find it?
2. What did you expect to happen when you changed the catering requirement?
3. How did you decide whether a procedure needed editing or could remain unchanged?
4. Were there any moments when Relay behaved differently from what you expected? What were you trying to accomplish?
5. Which parts of the experience would be most useful for a real student club, and what would you change first?

Follow-up questions will investigate specific observed moments rather than asking participants to endorse explanations I have already formed.

## 6. Analysis Plan

Each study will be summarized in a 200–300-word report focused on the most informative moments of participant behavior. Reports will include both successful and unsuccessful interactions, identify any facilitator assistance, and use debrief responses to clarify participants' expectations.

For important difficulties, I will consider multiple possible explanations. For instance, failure to discover an attachment action might reflect its visual placement, unfamiliar terminology, or a misunderstanding of how Playbooks and Context relate. I will compare the participant's actions and debrief responses before identifying the most plausible explanation, noting what the evidence cannot establish.

Findings will be compared across both participants without assuming that two sessions establish universal usability conclusions. Differences in participants' backgrounds, strategies, and familiarity with the domain will be considered.

The final analysis will identify three to five design flaws or opportunities, each supported by study evidence. Each will describe the observed behavior, its likely cause, a proposed improvement, and a classification at the physical, linguistic, or conceptual level. Severity will be justified using the difficulty's consequences, participants' ability to recover, and whether it occurred repeatedly.

Improvements will be prioritized by their effect on Relay's central workflows, the strength of the supporting evidence, and the amount of uncertainty that remains. Where the evidence does not distinguish between competing explanations, I will identify what additional testing would help resolve the question.

The goal is to understand not only whether participants can use Relay, but also how its design supports or interferes with their understanding of organizational knowledge, change, and responsibility.