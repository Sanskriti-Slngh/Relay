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
- **Final implementation:** commit
  [`a0fc5c4`](https://github.com/Sanskriti-Slngh/Relay/commit/a0fc5c46ae1415e1f7562d2d800b4e0537c30a81).
  Later commits changed documentation and demo links, not application behavior.

The final implementation was redeployed to
[relay.mit-sdg.dev](https://relay.mit-sdg.dev/), but this record does not
independently establish the exact revision currently served.

## Automated verification

The October 24 release passed 161 tests with 999 assertions across 19 files,
typechecking, the production build, generated-artifact validation, and
`git diff --check`. Sync-engine source and design checks passed with 28
documented nonfatal advisories.

The final implementation passed:

- 184 tests with 1,116 assertions across 23 files and no failures;
- TypeScript and Vue typechecking;
- the production build;
- source checks with 30 nonfatal advisories (24
  `MISSING_ENDPOINT_FALLBACK`, 6 `ORDER_SENSITIVE_FORMER`);
- design checks for seven specification files; and
- generated-artifact validation and `git diff --check`.

The same code was rechecked after the documentation cleanup on October 26:
184 tests passed with 1,113 `expect()` calls, and typechecking, the production
build, all sync-engine checks, artifact validation, and `git diff --check`
passed again.

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

## Final deliverables and limits

The [P4 narrated demo](https://youtu.be/0bwM4Pb3J-0) (2:59.648) demonstrates selected user-facing features. Automated tests provide strong evidence for concept behavior, integration, concurrency, and access control, but do not replace authenticated browser testing of the final deployed revision. The concurrency tests cover the overlapping schedules exercised; they do not establish exactly-once reaction delivery across arbitrary process crashes.
