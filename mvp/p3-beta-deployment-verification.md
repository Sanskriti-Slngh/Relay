# P3 Beta deployment verification

Date: October 18, 2026 (America/New_York)

This file records non-secret execution evidence for the deployment-hardening
increment. It intentionally contains no account credentials, session tokens,
invitation tokens, MongoDB URIs, or deployment keys.

## Official deployment requirements reviewed

The Fall 2026 6.1040 guide was read from **Before you start** through its
deployment, MongoDB, authentication, and troubleshooting guidance. Relay's
prepared 6.1040 Apps settings are Bun 1.4.0, package directory `.`, build
script `build`, start script `start`, port 3000, and health path `/health`.
The deployment must set `MONGODB_URL` and the exact HTTPS `PUBLIC_ORIGIN`.

The obsolete 38.9 MB P2 recording has been removed from the deployment tree,
leaving the source comfortably below the platform's 50 MB commit limit.
`.env` is ignored; only `.env.example` is tracked. The application creates one
MongoClient and reuses it, uses the database encoded in `MONGODB_URL`, and does
not write application files at runtime.

## Automated checks

The final October 18 local run is saved verbatim in
[`artifacts/p3-verification-output.txt`](../artifacts/p3-verification-output.txt).
It records 148 passing tests and 936 assertions with no failures, successful Vue and TypeScript
checks, a successful production build, passing design and generated-artifact
checks, a clean `git diff --check` result, and a successful production
SIGTERM lifecycle smoke test.

The 28 advisories comprise 22 `MISSING_ENDPOINT_FALLBACK` warnings and six
`ORDER_SENSITIVE_FORMER` notices. They were reviewed as described in the
design notebook. Existing backend tests cover missing resources, lifecycle
conflicts, invalid inputs, role failures, foreign-workspace access, forged
identities, and repeat actions; all return bounded responses rather than
timing out. Every repeated former collection uses an explicit arrangement
key. No functional deployment risk was found in the advisories.

## Production-mode smoke check

Relay was built and started through the exact production command, `bun run
start` (which invokes `bun src/main.ts`), on a non-default `PORT`, with an exact
same-origin `PUBLIC_ORIGIN` and the private local MongoDB configuration.
Startup and shutdown logged:

```text
Relay listening on port 3199.
Relay received SIGTERM; closing the HTTP listener and MongoDB connection.
[exit 0]
```

The smoke script waited for a successful `/health` response before sending
SIGTERM. This verifies the production entry point, database connectivity,
health contract, and graceful platform shutdown. It is not a substitute for
the required deployed Officer/Member browser journey.

## Deployment status and browser verification

The configured public address is <https://relay.mit-sdg.dev/>. A direct public
check returned `200 {"status":"ok"}` from `/health`. Its HTML referenced
`index-HJQ_6TZY.js` and `index-pjuGeR9K.css`, exactly matching the verified
local production build. This confirms that the current release application
build is live.

The submitted narrated recording demonstrates the Owner and Member journey in
the deployed interface. This audit still did not independently control that
browser because the available browser's administrative policy could not be
verified, and that restriction was not bypassed. The 6.1040 Apps deployment
screen should be checked once more after the final documentation commit so the
commit selected there exactly matches the hash submitted in Commons.

The platform log showed an existing process receive `SIGTERM` after running for
about nine minutes, followed two seconds later by a new `bun src/main.ts`
process. This is consistent with the documented 6.1040 Apps behavior: saving an
environment variable restarts the app immediately, and a deployment starts a
replacement before retiring the old process. Relay now handles SIGTERM and
SIGINT by closing the HTTP listener and MongoDB client. A platform-generated
`script "start" was terminated by signal SIGTERM` line during an intentional
restart is informational, not an application exception. The replacement still
must log `Relay listening on port ...` and pass `/health`; if it does neither,
inspect the deployment's **Errors** and confirm `MONGODB_URL`, `PUBLIC_ORIGIN`,
`HOST`, and `PORT` in 6.1040 Apps.

## Deployment-specific MongoDB regression

The first deployed `POST /workspaces/create` returned 500. Reproduction against
a local standalone MongoDB produced MongoDB code 20: transaction numbers are
only accepted by replica-set members or `mongos`. Relay now detects the
topology and uses real transactions on replica sets or serialized guarded
operations on standalone MongoDB. The complete suite passes against both the
development replica set and a standalone MongoDB 8 container. The unrelated
browser-console message `No Listener: tabs:outgoing.message.ready` originates
from the browser controller/extension rather than a Relay route.
