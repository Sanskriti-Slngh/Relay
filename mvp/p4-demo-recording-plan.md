# Relay P4 narrated demo recording plan

Target duration: **2:45**. Hard stop: **2:55** to leave margin below the
assignment's three-minute limit. Narrate continuously, including account
switches and short loading moments.

The [official P4 brief](https://61040.github.io/fa26/assignments/p4/) asks for a
video up to three minutes long, with audio narration throughout, showing at
least one intelligible user journey and highlighting key features. This plan
uses one connected journey rather than a feature inventory.

## Recording state to prepare

Use the already populated production test workspace. Before recording, prepare
only the state needed to make the journey quick and legible:

- **Owner session:** signed in as a neutral test identity, correct workspace
  selected, and open on **Overview**. Keep **Book Rehearsal Space** and
  **Renew Club Room Access** active with their ordered Steps.
- **Shared Context:** have one demonstration Note attached to one Step in each
  Playbook. Start its text with the intentional typo
  `Room access must be renewed annuallly under the current fictional policy.`
  Make sure this new Note has no unfinished Reviews before recording. Leave
  older completed history alone.
- **Member session:** use a second Chrome profile or Incognito window already
  signed in to the same workspace. The invitation must already be accepted;
  do not show its code. Have an unanswered, concise Question already attached
  to the relevant room-access Step, ready to display without typing.
- **Answer:** decide on a short, fictional answer and keep it in a local
  clipboard manager only if the clipboard preview cannot appear on screen.
  A safe example is: `Check with the space coordinator before submitting.`
- **Windows:** size Owner and Member windows identically and place them in the
  same screen position. Hide bookmarks, downloads, password-manager prompts,
  notifications, and unrelated tabs. Use browser zoom that keeps the sidebar,
  main content, and action labels readable in the final 1080p recording.
- **Safety:** use neutral display names. Avoid **Workspace** during the recording
  if it exposes test email addresses. Never open DevTools, the password manager,
  an invitation, or the address-bar history.
- **Dry run:** rehearse the exact clicks once. Then restore the demonstration
  Note to the typo state, clear its resulting unfinished Reviews, restore the
  open Question, and confirm both sessions show the intended starting state.
  If that state cannot be restored safely, use another dedicated demonstration
  Note in the same test workspace.

## Timestamped shot list and narration

### 0:00–0:15 — Frame the problem

**On screen:** Owner **Overview**, with the two Playbooks visible.

**Narration:** “Relay helps student clubs keep procedures trustworthy when the
information behind them changes. Here, an officer has two step-by-step
Playbooks: booking rehearsal space and renewing room access.”

### 0:15–0:36 — Show ordered procedures and shared knowledge

**On screen:** Open one Playbook, briefly show its ordered Steps and attached
Context, then open the second Playbook and its attachment to the same Note.

**Narration:** “Each Playbook keeps the work in an explicit order. Both depend
on the same room-access policy, so Relay stores that explanation once as shared
Context and attaches it where it matters instead of copying it into each
procedure.”

### 0:36–0:55 — Correct wording without creating work

**On screen:** Open **Shared Context**, select **Fix wording**, correct
`annuallly` to `annually`, save, and briefly show **Reviews** at zero open.

**Narration:** “Relay distinguishes editing words from changing meaning. This is
just a typo, so I choose Fix wording. The shared Note updates everywhere, but
Relay correctly creates no Review work.”

### 0:55–1:18 — Record a meaningful change

**On screen:** Return to the Note, select **Information changed**, replace
`annually` with `each semester`, save, then open **Reviews** and show two open
items with their before-and-after evidence.

**Narration:** “Now the underlying policy actually changes—from annual renewal
to renewal each semester. I record that as Information changed. Relay preserves
the before and after text, finds both dependent Playbooks, and creates one
Review for each.”

### 1:18–1:53 — Resolve the two review paths

**On screen:** Expand the first Review and choose **Still correct**. Expand the
second and choose **Needs updating**; choose **Edit playbook**, make the minimum
prepared Step edit, return to **Reviews**, and choose **Resolve review**.

**Narration:** “The rehearsal-booking instructions still work, so I confirm that
Review. Room-access renewal does need an update. Relay keeps that item open
while I revise the affected Step, and I resolve it only after the procedure is
current. The finished history retains why each decision happened.”

### 1:53–2:14 — Switch to the Member view

**On screen:** Switch to the prepared Member window. Show the same Playbook and
Context, then the open Question. Do not open any page that reveals an email.

**Narration:** “This is the same workspace as a Member. Members can read the
official Playbooks and their supporting Context, but the officer editing and
Review controls are absent. A Member can still participate by asking a Question
beside a specific instruction.”

### 2:14–2:34 — Answer as the Officer

**On screen:** Switch to Owner, open **Questions**, expand the prepared Question,
enter the short answer, and choose **Answer**.

**Narration:** “The Question reaches the officer with its original Step as the
subject. I can answer in place, so the clarification stays connected to the
knowledge that prompted it.”

### 2:34–2:45 — Show collaboration and close

**On screen:** Switch back to Member without refreshing, wait for polling if
needed, and show the answered Question. End on the populated Playbook or
Overview rather than a settings screen.

**Narration:** “The Member receives the answer without a manual refresh. Roles
protect official knowledge, while shared Context, Reviews, Questions, and saved
history let the club collaborate without losing why its procedures changed.”

## Account-switching and privacy

- Prefer two named Chrome profiles with neutral profile icons, or one normal
  window plus Incognito. Keep both authenticated before recording.
- Switch with the macOS application/window shortcut or by clicking the second
  window; do not sign out and sign in on camera.
- Crop the recording to the browser content area if the profile menu contains a
  personal name or email. Test the crop before the final take so dialogs are not
  cut off.
- Do not visit **Workspace**, invitation details, browser autofill, saved
  passwords, DevTools, Network panels, or application storage during the take.
- If an unexpected credential, token, email, or invitation code appears, stop
  and discard that take rather than trying to conceal it while recording.

## Final recording QA

Before uploading, verify all of the following:

- [ ] Final duration is at most 3:00; preferred range is 2:40–2:50.
- [ ] Narration is audible, even in volume, and present throughout the video.
- [ ] The cursor and every label used in the narration are legible at normal
  playback size; no important text is clipped.
- [ ] The video visibly shows the two Playbooks, one shared Context Note, the two
  update modes, two generated Reviews, both Review paths, the Member view, and
  the Question answer.
- [ ] Every narrated action is visible and succeeds; no claim depends on an
  off-screen action.
- [ ] No passwords, private email addresses, session/CSRF tokens, invitation
  codes, browser history, or unrelated notifications appear.
- [ ] Account switches are understandable without exposing account details.
- [ ] The uploaded file plays from beginning to end with synchronized audio.
- [ ] The final link opens in a signed-out/private window without requesting
  access.

## Where to publish and link the final materials

Upload the finished video to a stable public or unlisted host such as YouTube,
with link access that works while signed out. After the real URL exists, add it
to the project root `README.md` alongside the deployed app and the P4 design
document. Keep the supporting evidence and plan under `mvp/`, and link the
deployment verification record from the README or from a concise P4 materials
index there. Do not add a placeholder video URL.
