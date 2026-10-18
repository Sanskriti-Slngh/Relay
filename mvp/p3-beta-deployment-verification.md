# P3 Beta deployment verification

Date: October 17, 2026 (America/New_York)

This file records non-secret execution evidence for the deployment-hardening
increment. It intentionally contains no account credentials, session tokens,
invitation tokens, MongoDB URIs, or deployment keys.

## Official deployment requirements reviewed

The Fall 2026 6.1040 guide was read from **Before you start** through its
deployment, MongoDB, authentication, and troubleshooting guidance. Relay's
prepared 6.1040 Apps settings are Bun 1.4.0, package directory `.`, build
script `build`, start script `start`, port 3000, and health path `/health`.
The deployment must set `MONGODB_URL` and the exact HTTPS `PUBLIC_ORIGIN`.

Tracked source size is 39,928 KiB, below the platform's 50 MB source limit.
`.env` is ignored; only `.env.example` is tracked. The application creates one
MongoClient and reuses it, uses the database encoded in `MONGODB_URL`, and does
not write application files at runtime.

## Automated checks

All commands below completed on Bun 1.4.0:

```text
$ bun test
131 pass
0 fail
727 expect() calls
Ran 131 tests across 12 files. [3.80s on the development replica set]

$ MONGODB_URL=mongodb://127.0.0.1:27019/relay_standalone bun test
131 pass
0 fail
730 expect() calls
Ran 131 tests across 12 files. [2.13s on standalone MongoDB 8]

$ bun run typecheck
$ tsc --noEmit && vue-tsc --noEmit -p tsconfig.web.json
exit 0

$ bun run build
vite v8.3.4 building client environment for production...
23 modules transformed
dist/index.html                  0.56 kB (gzip 0.34 kB)
dist/assets/index-*.css         29.97 kB (gzip 7.24 kB)
dist/assets/index-*.js         123.63 kB (gzip 40.66 kB)
build completed in 227 ms

$ bunx sync-engine check --show-advisories
Concept action/query source check passed for 6 concepts.
Application diagnostic check passed with 26 advisories.

$ bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
Design form check passed for 7 files.

$ bunx sync-engine artifacts check
exit 0

$ git diff --check
exit 0
```

The 26 advisories comprise 20 `MISSING_ENDPOINT_FALLBACK` warnings and six
`ORDER_SENSITIVE_FORMER` notices. They were reviewed as described in the
design notebook. Existing backend tests cover missing resources, lifecycle
conflicts, invalid inputs, role failures, foreign-workspace access, forged
identities, and repeat actions; all return bounded responses rather than
timing out. Every repeated former collection uses an explicit arrangement
key. No functional deployment risk was found in the advisories.

## Production-mode smoke check

Relay was built and started through `src/main.ts` with a loopback `HOST`, a
non-default `PORT`, an exact same-origin `PUBLIC_ORIGIN`, and the private local
MongoDB configuration. Startup logged `Relay listening on port 3001.` The
following responses were observed:

```text
GET /health   -> 200 {"status":"ok"}
GET /session  -> 200 {"authenticated":false}
HEAD /        -> 200 (built Vue index, Content-Length: 566)
```

This verifies the production entry point, database connectivity, health
contract, unauthenticated session contract, and static build serving. It is
not a substitute for the required deployed Officer/Member browser journey.

## Unresolved external verification

The authorized browser could list its controlled tab, but navigation to
`https://mit-sdg.dev` was denied because the admin-enforced browser policy
could not be verified. The browser explicitly prohibited bypassing that
control. Consequently, no 6.1040 Apps project, MongoDB integration, environment
secret, deploy key, deployment, live URL, or deployed test data was created in
this run. Real-browser Officer/Member verification remains pending until the
authorized browser policy is available. The immutable application name also
still requires an owner choice before project creation.

## Deployment-specific MongoDB regression

The first deployed `POST /workspaces/create` returned 500. Reproduction against
a local standalone MongoDB produced MongoDB code 20: transaction numbers are
only accepted by replica-set members or `mongos`. Relay now detects the
topology and uses real transactions on replica sets or serialized guarded
operations on standalone MongoDB. The complete suite passes against both the
development replica set and a standalone MongoDB 8 container. The unrelated
browser-console message `No Listener: tabs:outgoing.message.ready` originates
from the browser controller/extension rather than a Relay route.
