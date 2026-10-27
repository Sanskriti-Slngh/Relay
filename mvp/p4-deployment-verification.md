# P4 deployment and test evidence

This record separates independently observed results, project-owner reports,
and automated checks. It contains no credentials, tokens, invitation codes, or
database configuration.

## Releases covered

- **October 24, 2026:** commit
  [`8eb920e`](https://github.com/Sanskriti-Slngh/Relay/commit/8eb920e9624838679d3b8a80d7932148a1dea9bf),
  observed deployment `a925054a-77ee-40ad-a65d-fd289f826b6d`. This is the
  release for which the HTTP responses and asset digests below were recorded.
  The manual browser checklist was completed on the same date, but does not
  independently establish this revision for every interaction.
- **Later UI release:** commit
  [`21a6fac`](https://github.com/Sanskriti-Slngh/Relay/commit/21a6fac0bbd6f86bdd587f2acc41030b3ff9e5fd)
  was deployed and its browser checks were reported as passing by the project
  owner. No independent deployment identity, asset comparison, screenshots, or
  per-check notes were supplied.
- **Earlier 184-test implementation:** commit
  [`a0fc5c4`](https://github.com/Sanskriti-Slngh/Relay/commit/a0fc5c46ae1415e1f7562d2d800b4e0537c30a81).
  This release remains historical evidence for the expanded P4 application and
  its concurrency correction.
- **Current code-changing P4 implementation:** commit
  [`8c163889`](https://github.com/Sanskriti-Slngh/Relay/commit/8c1638897719b00de7e8cbfc76c6bf02806236d9).
  This release adds the final interaction-design corrections and is the source
  revision for the current local verification reported below.
- **Current deployed repository revision:** commit
  [`528c1c97`](https://github.com/Sanskriti-Slngh/Relay/commit/528c1c97b0cc255b26ad0c8c27a4dfcc75facaea),
  selected by the project owner for platform deployment. Its application tree
  is unchanged from `8c163889`; the intervening commits update evidence and
  documentation only. The observed platform deployment identifier is
  `8e767b2e-b314-4b98-a30c-1017453a90d5`.

Relay is available at [relay.mit-sdg.dev](https://relay.mit-sdg.dev/). Local
verification and live HTTP observations remain identified separately below;
neither is presented as a substitute for the other.

## Automated verification

The October 24 release passed 161 tests with 999 assertions across 19 files,
typechecking, the production build, generated-artifact validation, and
`git diff --check`. Sync-engine source and design checks passed with 28
documented nonfatal advisories.

The earlier `a0fc5c4` implementation passed:

- 184 tests with 1,116 assertions across 23 files and no failures;
- TypeScript and Vue typechecking;
- the production build;
- source checks with 30 nonfatal advisories (24
  `MISSING_ENDPOINT_FALLBACK`, 6 `ORDER_SENSITIVE_FORMER`);
- design checks for seven specification files; and
- generated-artifact validation and `git diff --check`.

The same `a0fc5c4` code was rechecked after the documentation cleanup on October 26:
184 tests passed with 1,113 `expect()` calls, and typechecking, the production
build, all sync-engine checks, artifact validation, and `git diff --check`
passed again.

The current `8c163889` interaction-design implementation was verified locally
on October 26. Two complete runs each passed 189 tests across 23 files with no
failures; Bun reported 1,134 `expect()` calls in the earlier run and 1,131 in
the final documentation-verification run. This record preserves both observed
counts rather than presenting the runtime assertion count as invariant.
TypeScript and Vue typechecking, the production build, sync-engine source and
design checks, generated-artifact validation, and `git diff --check` also
passed. These are local repository results; they are not presented as
verification of the live deployment.

Regression tests specifically cover concurrent Context changes: exactly one
unfinished Review must remain and retain every distinct Cause without
duplication. Integration tests also cover stale-version rejection, backend
permissions, workspace isolation, Context deletion, workspace lifecycle
operations, and partial failures during Context replacement.

## Verification sources

The automated tests are included in the submitted repository. The most important regression and integration checks are:

- **[Composition and concurrency tests](../tests/compositions/Relay.test.ts)** — Verify that changes to shared Context create the required Reviews, concurrent changes retain every distinct Cause, and a rejected concurrent Review request is recovered.
- **[Reviewing concept tests](../tests/concepts/Reviewing.test.ts)** — Check Review lifecycle behavior, uniqueness, concurrent updates, and invalid transitions.
- **[Version-control tests](../tests/concepts/VersionControl.test.ts)** — Verify that stale mutations cannot overwrite newer data or create invalid history.
- **[Multi-user and permissions tests](../tests/host/multi-user.test.ts)** — Exercise accounts, invitations, workspace isolation, authorization, session persistence, and invalid requests.
- **[Backend integration tests](../tests/host/backend.test.ts)** — Exercise full application workflows through HTTP, including shared Context changes, Reviews, error handling, and partial failures.
- **[Frontend tests](../tests/frontend/)** — Check interface behavior, state handling, conflict recovery, and unsaved-work protection.

The most consequential regression was the loss of a Review Cause during concurrent Context changes. Individual concept invariants remained valid, but the composed application could lose evidence. The correction recovers a rejected concurrent Review request by adding its Cause to the existing Review. The composition tests now exercise both concurrent Context changes and the refusal-recovery path.

## Independently observed production evidence for `8eb920e`

The following was observed directly on October 24 for the earlier `8eb920e`
release and observed deployment `a925054a-77ee-40ad-a65d-fd289f826b6d`:

- `GET /health` returned HTTP 200 with `{"status":"ok"}` and `Cache-Control:
  no-store`. The endpoint's live MongoDB ping established current connectivity,
  not persistence of a complete user journey.
- Unauthenticated `GET /session` returned HTTP 200 with
  `{"authenticated":false}`.
- `GET /` and its JavaScript and CSS assets returned HTTP 200. Asset SHA-256
  digests matched a clean production build of the release commit:
  - JavaScript: `3e09824e7c993ddaf024f0c8d66abc2dbc0bc6fc2ad06be909d613a92bcfa33b`
  - CSS: `c7ea260720f965df28d13f18d517929dc852ac9831028179884ff9a9020ec112`
- The deployed JavaScript contained no Relay MongoDB URI or server-secret
  configuration names.
- A deliberately nonexistent login returned HTTP 401 and
  `INVALID_CREDENTIALS`; the same request with a foreign Origin returned HTTP
  403 and `ORIGIN_REJECTED`.

These checks verify the release front end, public HTTP behavior, and database
connectivity. Platform startup history and absence of earlier restarts were not
available for verification.

## Current deployment evidence for `528c1c97`

The project owner selected full commit
`528c1c97b0cc255b26ad0c8c27a4dfcc75facaea` for deployment. On October 26,
read-only requests to the resulting live application consistently returned
platform deployment identifier `8e767b2e-b314-4b98-a30c-1017453a90d5` and the
following results:

- `GET /`, `GET /health`, and unauthenticated `GET /session` returned HTTP 200.
- `/health` returned `{"status":"ok"}` with `Cache-Control: no-store`,
  establishing live database connectivity at the time of the request.
- `/session` returned `{"authenticated":false}` with `Cache-Control: no-store`.
- A login attempt for a deliberately nonexistent account from the exact
  configured production Origin reached authentication and returned HTTP 401
  with `INVALID_CREDENTIALS`; the same request with a foreign Origin returned
  HTTP 403 with `ORIGIN_REJECTED`.
- The live application returned `index-BX3bAd6W.js` and
  `index-CRu-Ukdh.css`. Their SHA-256 digests were:
  - JavaScript: `d83733ba6c03bd50966341738a829d293c49c085ece4c41b046fdef23358ff4f`
  - CSS: `b4ede1d1e96b02f6d6ab2b78cc7ba826813c9fbf05354d215862e08866db44fc`

The production asset names and digests differed from the verified local build,
so they are not presented as a byte-for-byte local-build comparison. The live
JavaScript nevertheless contained the exact final interaction markers for
invitation-address guidance, unrecoverable-draft session expiration, duplicate
attachment prevention, the Playbook restoration limitation, and the revised
Questions empty state. The live CSS contained the final viewport notification
and mobile **More** navigation rules. Together with the recorded deployment
selection and platform identifier, this establishes that the deployment
contains the final `8c163889` application changes packaged by `528c1c97`.

For comparison, the verified local production build produced
`index-CtV7UDag.js` and `index-D5y0AuC1.css`, with these digests:

- JavaScript: `e193404bf1c8104de686c7260e3cb1994fd1505d5081d9976465ccd3a4c6b4cd`
- CSS: `9f44d24f3899cb1518d1debf5ba24f8b0b700de88539e097d0c512a91d664eea`

## Project-owner browser verification

On October 24, 2026, I manually tested the deployed application in two Chrome
sessions using controlled Owner and Member accounts. I recorded 21 of 21 checks
as passing, covering the Owner workflow, Member permissions and collaboration,
concurrency, error handling, accessibility, and persistence. The exact deployed
revision active during every interaction was not independently established.

- Owner workflow: 6/6
- Member workflow, permissions, and polling: 8/8
- Concurrency, errors, mobile, keyboard, and persistence: 7/7

The [full manual checklist](./p4-manual-browser-checklist.md) records each check,
its expected behavior, the reported result, and the limits of that evidence.

On October 26, final browser-check attempts against both the local application
and deployment `8e767b2e-b314-4b98-a30c-1017453a90d5` could not proceed because
the controlled browser's enforced security verification did not grant access.
The 320-pixel **More** menu, 390-pixel Context controls, viewport notification,
and invitation guidance were therefore not newly observed in those attempts.
No result from a blocked attempt is reported as a pass; the October 24 checklist
remains historical project-owner evidence with the revision-attribution limits
stated above.

## Final deliverables and limits

The [P4 narrated demo](https://youtu.be/0bwM4Pb3J-0) (2:59.648) demonstrates selected user-facing features. Automated tests provide strong evidence for concept behavior, integration, concurrency, and access control, but do not replace authenticated browser testing of the final deployed revision. The concurrency tests cover the overlapping schedules exercised; they do not establish exactly-once reaction delivery across arbitrary process crashes.
