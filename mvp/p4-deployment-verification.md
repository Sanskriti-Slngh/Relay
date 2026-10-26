# P4 deployment and test evidence

This record separates independently observed results, project-owner reports,
and automated checks. It contains no credentials, tokens, invitation codes, or
database configuration.

## Releases covered

- **October 24, 2026:** commit
  [`8eb920e`](https://github.com/Sanskriti-Slngh/Relay/commit/8eb920e9624838679d3b8a80d7932148a1dea9bf),
  observed deployment `a925054a-77ee-40ad-a65d-fd289f826b6d`. This is the
  release for which HTTP responses, asset digests, and the 21-check browser run
  below were recorded.
- **Later UI release:** commit
  [`21a6fac`](https://github.com/Sanskriti-Slngh/Relay/commit/21a6fac0bbd6f86bdd587f2acc41030b3ff9e5fd)
  was deployed and its browser checks were reported as passing by the project
  owner. No independent deployment identity, asset comparison, screenshots, or
  per-check notes were supplied.
- **Final implementation:** commit
  [`a0fc5c4`](https://github.com/Sanskriti-Slngh/Relay/commit/a0fc5c46ae1415e1f7562d2d800b4e0537c30a81).
  Later commits changed documentation and demo links, not application behavior.

The project owner reports that the final implementation was redeployed to
[relay.mit-sdg.dev](https://relay.mit-sdg.dev/). The final deployment's exact
front-end and back-end revisions were not independently established.

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

## Independently observed production evidence

The following was observed directly on October 24 for commit `8eb920e`:

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

The managed browser could not access the authenticated production application.
The project owner therefore ran the deployed journey manually in two Chrome
sessions with test-controlled accounts and reported all 21 checks passing:

- Owner workflow: 6/6
- Member workflow, permissions, and polling: 8/8
- Concurrency, errors, mobile, keyboard, and persistence: 7/7

The run covered:

- two ordered Playbooks sharing one Context Note;
- wording correction without Review creation;
- a meaningful Context change creating Reviews for both affected Playbooks;
- the **Still correct** and **Needs updating** Review paths;
- email-bound invitation acceptance and one-time-code rejection on reuse;
- Member read access, hidden editing controls, and server rejection of a forged
  mutation;
- a Question attached to a Step and answered by an Officer;
- polling without lost drafts;
- persistence across reload and re-login;
- stale-edit rejection with draft recovery; and
- invalid-input feedback, keyboard access, and a 390-pixel responsive check.

These are project-owner-reported results, not independently reproduced results.
No browser screenshots or per-check observation notes were supplied.

## Final deliverables and limits

The [P4 narrated demo](https://youtu.be/0bwM4Pb3J-0) has a reported duration of
2:59.648. Automated tests provide strong evidence for concept behavior,
integration, concurrency, and access control, but do not replace authenticated
browser testing of the final deployed revision. The concurrency tests cover the
overlapping schedules exercised; they do not establish exactly-once reaction
delivery across arbitrary process crashes.
