# P4 deployed application verification

Date: October 24, 2026 (America/New_York)

This is a non-secret evidence record for the P4 release. It contains no account
credentials, session or CSRF tokens, invitation codes, or MongoDB configuration.

## Later UI release

The detailed HTTP, asset-digest, and 21-check evidence below applies to commit
`8eb920e9624838679d3b8a80d7932148a1dea9bf`. The project owner later deployed
the final UI refinement commit
`21a6fac0bbd6f86bdd587f2acc41030b3ff9e5fd` and reported that its browser checks
passed. Those later checks were user-operated, not agent-controlled. No new
deployment identity, HTTP capture, asset-digest comparison, screenshots, or
per-check notes were supplied, so the original evidence remains attributed to
the release that actually produced it rather than being relabeled.

## Release under test

- URL: <https://relay.mit-sdg.dev/>
- Release commit: `8eb920e9624838679d3b8a80d7932148a1dea9bf`
- Commit message: `Harden P4 integration, concurrency recovery, and regression coverage`
- Deployment action: manually performed in 6.1040 Apps and reported by the
  project owner. The deployment action itself was not independently observed.
- Observed platform deployment identity: `a925054a-77ee-40ad-a65d-fd289f826b6d`

## Automated release checks

Before deployment, the release passed the complete automated verification run:

- 161 tests passed with 0 failures across 19 test files.
- 999 assertions passed.
- Typechecking passed.
- The production build passed.
- Sync-engine source and design checks passed, with the same 28 documented
  nonfatal advisories.
- Generated-artifact validation and `git diff --check` passed.

These results establish the tested behavior of the release commit; they are not
substitutes for observations made against the deployed application.

## Independently verified production HTTP evidence

The following results were observed directly on October 24 after the reported
deployment:

- `GET /health` returned HTTP 200, `Content-Type: application/json`,
  `Cache-Control: no-store`, and `{"status":"ok"}`. Because the endpoint performs
  a live MongoDB ping, this establishes that the current process can reach its
  configured database; it does not establish persistence of a user journey.
- `GET /session` with the production Origin and no cookie returned HTTP 200 and
  `{"authenticated":false}`.
- `GET /` returned HTTP 200 and production HTML referencing
  `index-RnQvPtWc.js` and `index-C2h2P7qI.css`.
- Both assets loaded successfully. Their SHA-256 digests exactly matched a clean
  production build from the checked-out release commit:
  - JavaScript: `3e09824e7c993ddaf024f0c8d66abc2dbc0bc6fc2ad06be909d613a92bcfa33b`
  - CSS: `c7ea260720f965df28d13f18d517929dc852ac9831028179884ff9a9020ec112`
- A scan of the deployed JavaScript found no MongoDB URI or server configuration
  variable names used for Relay's secrets.
- A login attempt with a deliberately nonexistent identity returned HTTP 401
  and `INVALID_CREDENTIALS`; it created no account or workspace state.
- The same request with a foreign Origin returned HTTP 403 and
  `ORIGIN_REJECTED`.

The matching assets provide independent evidence that the public frontend is the
build produced by the release SHA. Current health is verified, but 6.1040 Apps
startup and restart logs were not available here, so absence of earlier startup
errors or repeated crashes is **not verified**.

## Browser-control limitation and evidence provenance

The managed browser refused access because it could not verify its
administrator-enforced policy. That restriction was not bypassed. Therefore no
authenticated browser journey, responsive-layout result, polling observation,
cookie inspection, or screenshot was independently observed by the agent.

The project owner subsequently executed the production checklist in Chrome
with two test-controlled accounts and reported all 21 checks passing:

- **Task 2.2A — Owner workflow:** 6/6 PASS.
- **Task 2.2B — Member workflow, permissions, and polling:** 8/8 PASS.
- **Task 2.2C — Concurrency, errors, mobile, keyboard, and persistence:**
  7/7 PASS.
- **Total:** 21/21 PASS.

These are user-reported production-browser results, not agent-operated tests.
No screenshots, credentials, invitation codes, or more granular observation
notes were supplied. The checklist below records the actions and expected
outcomes that the reported batches exercised; the aggregate results above are
the available outcome record. Its 13 high-level sections do not map one-to-one
to the 21 executed checks, so the blank per-section note fields are retained
rather than inventing a more granular result breakdown.

## Manual Chrome checklist exercised by the project owner

Use two test-controlled accounts in separate Chrome sessions (for example,
regular and Incognito) and a dedicated workspace named
`P4 Validation Club — 2026-10-24`. Do not record credentials or invitation codes
in this file. For every failure, record the exact visible message and whether a
retry succeeds.

### 1. Owner creates two ordered Playbooks

- **Action:** Sign in or register as Account A, create the dedicated workspace,
  create **Book Rehearsal Space** and **Renew Club Room Access**, and add at least
  three realistic Steps to each. Move one Step up and back down.
- **Expected:** Both Playbooks display the intended contiguous order; navigation
  away and back preserves the order and Step text without a page reload.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 2. One Context Note is shared by both Playbooks

- **Action:** Create one Note saying
  `Room access must be renewed annuallly under the current fictional policy.`
  Attach it to a Step in the first Playbook, then use **Use existing** to attach
  that same Note to a Step in the second.
- **Expected:** Shared Context shows one Note with two Step attachments, not two
  independent copies; both Step disclosures show the same Note.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 3. Wording correction creates no Review

- **Action:** Choose **Fix wording** and correct `annuallly` to `annually`.
- **Expected:** The corrected text appears wherever the Note is attached and the
  Reviews inbox remains empty.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 4. Meaningful change creates two Reviews

- **Action:** Choose **Information changed** and change the requirement from
  annual renewal to semester renewal.
- **Expected:** Two affected Playbooks appear in Reviews. Context history shows
  the exact annual before-text and semester after-text.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 5. Complete both Review paths

- **Action:** Mark **Book Rehearsal Space** as **Still correct**. Mark
  **Renew Club Room Access** as **Needs updating**, edit the affected Step, return
  to its Review, and resolve it.
- **Expected:** No unfinished Reviews remain. Review history preserves one
  completed confirmation and one completed update path with their Cause.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 6. Member joins through an invitation

- **Action:** As Account A, create an invitation for Account B's exact email.
  Open the separate Account B session, sign in or register with that email, and
  accept the one-time code.
- **Expected:** Account B joins the dedicated workspace as Member; reusing the
  code is refused with an understandable unavailable/expired message.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 7. Member reads but cannot modify official knowledge

- **Action:** As Account B, open both Playbooks and Shared Context. Confirm that
  create/edit/archive, Context correction/change, Review, invitation, and role
  controls are absent. For a server-enforcement check, run this in Account B's
  DevTools Console; it uses the session's CSRF value without printing it:

  ```js
  (async () => {
    const session = await fetch("/session").then((response) => response.json());
    const response = await fetch("/api/workspaces/procedures/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-CSRF": session.csrfToken },
      body: JSON.stringify({
        title: "Unauthorized test — must not exist",
        user: "forged-user",
        workspace: "forged-workspace",
      }),
    });
    console.log(response.status, await response.json());
  })();
  ```
- **Expected:** Reads succeed. The direct mutation returns HTTP 403 and no
  Playbook with the test title appears. Do not copy the CSRF value into notes.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 8. Member asks and Owner answers a Question

- **Action:** Account B asks a Question beside a specific Step. Return to
  Account A's existing session and answer it from Questions.
- **Expected:** The Question preserves its Step subject; Account A can answer,
  while Account B cannot. Account B sees the final answer.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 9. Collaborative updates arrive without manual refresh

- **Action:** Keep both sessions open during Check 8. After each user submits,
  wait at least six seconds without reloading the other session.
- **Expected:** Account A receives the open Question and Account B receives the
  answer through normal polling. Any text currently being typed remains intact.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 10. Refresh and re-login preserve state

- **Action:** Reload both sessions. Then sign both accounts out and back in and
  reselect the dedicated workspace if necessary.
- **Expected:** Playbooks and Step order, the single shared Note and both
  attachments, before/after Context history, Review history, membership, the
  Question, and its answer all remain correct.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 11. Invalid operations provide useful recovery

- **Action:** Attempt an invalid sign-in in a separate signed-out window; try to
  submit blank Playbook, Step, Context, and Question forms; enter a fabricated
  invitation code; and inspect the existing-Context selector for an already
  attached target.
- **Expected:** Invalid sign-in explains that the email or password is incorrect;
  blank submissions are disabled or blocked; the invitation is described as
  invalid/unavailable; and duplicate attachment is prevented or refused without
  creating another attachment. No failed action displays success.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

### 12. Two-Officer stale Step conflict, if practical

- **Action:** Account A promotes Account B to Officer. Both open the same Step
  for editing. Account B types and leaves an unsaved draft. Account A saves a
  different edit. Without reloading, Account B submits the stale draft.
- **Expected:** Account B's save is rejected rather than silently overwriting
  Account A. The latest saved instruction and Account B's preserved draft appear
  together with **Use saved** and **Save mine** recovery choices. Choose one,
  confirm the final saved value, then reload and confirm it persists.
- **Result:** ☐ PASS ☐ FAIL ☐ NOT PRACTICAL — Notes: ______________

### 13. Desktop, mobile, and keyboard smoke check

- **Action:** Exercise main navigation, Playbook selection, Context disclosures,
  Questions, Reviews, and Sign out with keyboard Tab/Enter controls. In Chrome
  responsive mode, set the viewport to approximately 390 px wide and revisit
  populated and empty sections.
- **Expected:** Focus remains visible, every primary action is reachable, Sign
  out remains available, status messages are readable, and no page has horizontal
  overflow requiring sideways scrolling.
- **Result:** ☐ PASS ☐ FAIL — Notes: ______________________________

## Current outcome summary

- Release/build identity: **VERIFIED**
- Public homepage, static assets, `/health`, and unauthenticated `/session`:
  **VERIFIED**
- Current database connectivity through `/health`: **VERIFIED**
- Invalid credentials and foreign-Origin rejection: **VERIFIED**
- Startup-log history and repeated-crash absence: **NOT VERIFIED**
- Owner authentication and workflow: **USER-REPORTED PASS (6/6)**
- Member authentication, read access, mutation restrictions, invitation flow,
  Questions, and polling: **USER-REPORTED PASS (8/8)**
- Persistence across refresh/re-login, stale-edit conflict recovery, invalid
  operation feedback, mobile layout, and keyboard operation:
  **USER-REPORTED PASS (7/7)**

## Remaining limitations

- The agent could not operate the managed browser, so the authenticated journey
  and its UI details were not independently reproduced.
- No browser screenshots or per-check observation notes were supplied; only the
  three batch totals and their stated coverage are recorded.
- Historical platform startup logs were unavailable. Current process/database
  health was verified, but absence of earlier startup errors or restarts was not.
- The HTTP checks establish the release frontend and current service health;
  the authenticated behavior, persistence, access-control, concurrency, and UI
  evidence rely on the project owner's reported Chrome run.

With those provenance limits stated, Task 2.2 is complete: the release identity
and public HTTP behavior were independently verified, and the required deployed
browser scenarios were reported as 21/21 passing. Automated tests remain
supporting evidence, not a substitute for those production-browser checks.
