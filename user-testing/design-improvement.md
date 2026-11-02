# P5: Design Flaws and Opportunities for Improvement

## Overview

The study scenarios highlight four opportunities to improve how Relay communicates its model of shared knowledge and procedural maintenance. The most consequential concern is not whether users can edit information, but whether they understand what their edits mean for other procedures.

The findings below are prioritized by the potential consequences of misunderstanding, the difficulty of recovery, and their relevance to Relay's central purpose. The findings from the two studies distinguish difficulties encountered during initial discovery from those that may persist after participants become familiar with the interface.

## Summary of Findings

| Priority | Finding | Level | Severity |
|---|---|---|---|
| 1 | The consequences of different Context edits are not immediately apparent | Linguistic | Moderate |
| 2 | Completing a Review does not clearly distinguish confirmation from correction | Conceptual | Moderate |
| 3 | The relationship between procedures and reusable knowledge is not always obvious | Conceptual | Moderate |
| 4 | Reordering Steps is less discoverable than adding them | Physical | Minor |

## 1. The consequences of Context edits are not immediately apparent

**Level: Linguistic · Severity: Moderate**

**Problem and evidence.** In the first study, Participant 1 hesitated between "Fix wording" and "Information changed" when updating the catering deadline. Although both options modify the same text, only the latter triggers Reviews of affected Playbooks. Participant 2 selected the appropriate option without hesitation, suggesting that the distinction is understandable but may not be immediately clear to everyone.

**Why it occurs.** The labels describe the type of edit rather than foregrounding its consequences. Relay already provides explanatory text and a warning for changes that appear meaningful, but users must still interpret the distinction themselves. The problem may therefore reflect terminology, insufficient emphasis on consequences, or unfamiliarity with the underlying concept.

**Proposed improvement.** Present the expected effect directly beside each option, including how many Playbooks will require review. For example, "Update policy — review 3 affected Playbooks" would make the consequence more concrete. A brief preview before saving could further clarify the distinction without removing the officer's control over classification.

**Severity justification.** The hesitation is recoverable, but choosing incorrectly could leave outdated procedures without Reviews. This makes the issue more consequential than a cosmetic wording problem, even though the  participant completed the task independently. In a follow-up Context update, the participant selected the correct option without hesitation. This suggests the difficulty was concentrated in initial discovery rather than repeated use, although short-term familiarity may explain the improvement.

## 2. Review completion does not clearly distinguish confirmation from correction

**Level: Conceptual · Severity: Moderate**

**Problem and evidence.** In the second study, Participant 2 inspected C-Show's instructions twice before completing its Review. The procedure already required catering orders 14 days in advance, so it remained valid under the new seven-day policy. The participant understood that no edit was necessary but was initially uncertain whether completing a Review implied that a correction had been made.

**Why it occurs.** Relay uses "Complete Review" for both confirming unchanged instructions and finishing a Review after modifications. These actions reach a similar final state but represent different judgments. The shared label can obscure the distinction between evaluating correctness and repairing incorrect information.

**Proposed improvement.** Make the completion language depend on the Review's state. An unchanged procedure could offer "Confirm instructions are still correct," while a modified procedure could offer "Finish review." A short explanation of what will be recorded would help officers understand the outcome before committing.

**Severity justification.** The participant could proceed without assistance, but uncertainty at the final decision point may undermine confidence in the accuracy of recorded reviews. The risk is conceptual rather than merely linguistic because it concerns what completing a Review represents.

## 3. The relationship between procedures and reusable knowledge is not always obvious

**Level: Conceptual · Severity: Moderate**

**Problem and evidence.** In the first study, Participant 1 initially recorded the volunteer-lead requirement directly within South Asian Formal's instructions. Only when extending the decision to Garba Night did they create a shared Context Note. Participant 2, by contrast, navigated directly to Shared Context when investigating the catering policy.

**Why it occurs.** Users naturally approach event planning through the procedure they are working on. Relay separates executable instructions from the decisions and constraints that support them, a distinction that may be unfamiliar to first-time users. The interface permits Context creation within a Playbook, but understanding when information should be shared still requires judgment.

**Proposed improvement.** When officers add supporting information, provide a lightweight indication that it can be reused elsewhere. For example, Relay could ask whether a newly recorded decision also applies to other Playbooks and offer relevant attachment options. This would make reuse discoverable at the moment it becomes useful without forcing every instruction into Shared Context.

**Severity justification.** The participant recovered independently, but repeatedly storing the same policy inside separate procedures could recreate the inconsistency Relay is intended to prevent. The potential long-term consequence justifies Moderate severity despite the limited immediate friction.

## 4. Reordering Steps is less discoverable than adding them

**Level: Physical · Severity: Minor**

**Problem and evidence.** In the second study, Participant 2 added the dietary-restriction instruction at the bottom of the South Asian Formal Playbook, then searched for a way to position it before the catering order. They eventually discovered the movement controls inside the Step's additional-actions menu. When asked to reorder another Step, the participant found the same control immediately. This supports treating the issue as Minor and suggests that improving first-use guidance may be more appropriate than permanently exposing additional controls.

**Why it occurs.** Relay makes adding a Step straightforward, but changing its position requires finding a separate, less prominent control. The interface supports the operation, yet its placement may not match expectations formed by document editors, where content can often be inserted directly between existing paragraphs.

**Proposed improvement.** Allow officers to insert a Step between existing Steps, with a small insertion action appearing between them. The existing movement controls could remain available for later reorganization and keyboard accessibility. This would reduce unnecessary navigation while preserving the ordered nature of Playbooks.

**Severity justification.** The participant completed the operation without intervention, and the confusion did not affect the final procedure. The issue introduces avoidable friction rather than preventing task completion, making Minor the appropriate classification.


## Follow-up Observation: Initial Discoverability vs. Learnability

During the studies, participants described some difficulties as part of a one-time learning curve. To investigate this explanation, I asked them to perform short, comparable tasks involving the same interactions. They completed these follow-up tasks without noticeable hesitation.

This complicates the interpretation of the earlier difficulties. The controls may be difficult to discover initially but straightforward to use once learned. However, immediate repetition also benefits from short-term memory, and the follow-up tasks were not controlled comparisons. These observations therefore suggest learnability rather than establish it.

This distinction changes how I would approach improvements. Instead of permanently increasing the visibility of every secondary control, I would explore contextual guidance for first-time users that becomes less prominent after initial use. Such guidance could explain unfamiliar concepts or reveal less obvious actions without adding clutter for experienced officers.

I would test this hypothesis by comparing first-attempt success, repeated-task performance, and performance after a delay. The goal would be to improve initial discoverability without compromising the efficiency participants demonstrated once familiar with the interface.

## Prioritization and Further Investigation

I would address the first two findings before changing the broader authoring interface. Both concern decisions that determine whether organizational knowledge remains trustworthy: whether a policy change triggers appropriate Reviews, and whether a completed Review accurately represents an officer's judgment.

The third finding deserves further investigation because it concerns Relay's central design assumption. The contrast between participants' approaches may reflect differences in familiarity with organizational knowledge systems rather than an interface flaw alone. A future study could introduce a decision affecting several procedures without explicitly mentioning those procedures, then observe whether participants discover the possibility of reuse independently.

Step ordering is a lower priority because the difficulty was recoverable and did not compromise the result.

These classifications remain provisional. Two participants cannot establish how frequently a problem occurs, and completing a task does not necessarily demonstrate full understanding. Before implementing the more substantial changes, I would test revised wording and Review actions with additional first-time users, asking them to predict the consequences before proceeding.

The broader design question is whether Relay makes the relationship between a change, its consequences, and an officer's responsibility clear enough that future club leaders can maintain accurate knowledge without the original author's guidance.
