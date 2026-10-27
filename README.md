# Relay

**Author:** Sanskriti Singh · MIT 6.1040 Software Design · Fall 2026

Relay helps student clubs preserve repeatable procedures and the context behind
them. When shared information changes meaningfully, Relay keeps the exact
before-and-after text and creates Review work for every affected active
Playbook. A wording correction updates the text without creating a Review.

- **Live P3 beta:** [relay.mit-sdg.dev](https://relay.mit-sdg.dev/)
- **Narrated P3 demonstration:** [YouTube](https://youtu.be/2jB5J9K8b5Y)
- **Implemented journey:** [P3 Beta user journey](mvp/p3-beta-user-journey.md)
- **Verification evidence:** [P3 Beta deployment record](mvp/p3-beta-deployment-verification.md)

## Repository guide

This public repository contains the P3 implementation, specifications, tests,
visual studies, and deployment evidence. The private individual repository
contains the design notebook and should be submitted separately in Commons.

- **[Design index](design/README.md)** — Problem framing, pitch, historical
  sketches, user journeys, and the P3 visual system.
- **Concept specifications:**
  [ProcedureMaintaining](design/concepts/ProcedureMaintaining.md),
  [ContextTracking](design/concepts/ContextTracking.md),
  [Questioning](design/concepts/Questioning.md),
  [Reviewing](design/concepts/Reviewing.md), and
  [RoleBasedAccessing](design/concepts/RoleBasedAccessing.md).
- **[Relay composition](design/compositions/Relay.md)** — Reactions, public
  operations, authorization, and HTTP contracts.
- **[Visual design specification](design/visual-design.md)** — The P3 audit,
  visual hierarchy, interaction patterns, accessibility choices, and sources.
- **Visual-study slides:** rendered
  [typography](slide-catalog/typography-slide.png) and
  [color](slide-catalog/color-slide.png), with editable
  [typography](slide-catalog/typography-slide.svg) and
  [color](slide-catalog/color-slide.svg) sources.
- **[Automated tests](tests/)** and
  **[saved verification output](artifacts/p3-verification-output.txt)** — The
  executable checks and the final P3 run.

## What the P3 beta supports

Relay is a persistent Vue and Bun application backed by MongoDB. Authenticated
users can belong to isolated club workspaces as Owner, Officer, or Member.

- Officers maintain ordered Playbooks and reusable Context Notes. Owners have
  the same domain permissions and can also manage Officers and transfer
  ownership.
- Members read official knowledge and ask Questions beside a Step or Context
  Note. Officers answer without detaching the discussion from its subject.
- A wording correction changes a Note quietly. A meaningful change preserves
  history and creates or updates Review work for affected active Playbooks.
- Optimistic versions reject stale edits, and the interface preserves the local
  draft for conflict recovery.
- Three-second polling and immediate local refresh expose saved changes without
  requiring a page reload or replacing unfinished local drafts.
- The server derives identity, workspace, and permissions from the authenticated
  session instead of trusting request-body identities.

Invitation codes are not emailed by Relay. An Owner or Officer must securely
share the one-time code with the invited address's owner. That person must
register with the same normalized email before accepting it.

## Local setup

Requirements: [Bun 1.4.0](https://bun.sh/) and [Podman](https://podman.io/)
with a working `podman compose` provider. Ensure ports 3000, 5173, and 27018
are available. On macOS, start a Podman machine first if necessary.

From a fresh clone:

```sh
bun install
bun run db:up
cp .env.example .env
bun run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Use this exact host rather
than `localhost` because Origin checks are exact. The API runs at
http://127.0.0.1:3000, and its database health endpoint is
http://127.0.0.1:3000/health.

The required environment variables are:

- `MONGODB_URL`: a MongoDB URI with an explicit database name. The supplied
  example uses `mongodb://127.0.0.1:27018/relay?replicaSet=rs0`.
- `PUBLIC_ORIGIN`: the exact browser origin, without a trailing slash. Local
  development uses `http://127.0.0.1:5173`.

`HOST` and `PORT` are optional locally; the API defaults to `0.0.0.0:3000`.
Never expose MongoDB configuration through a `VITE_` variable.

To open a clean demo workspace without changing the configured application
database, choose a fresh safe database name:

```sh
RELAY_DEMO_DATABASE=relay_demo_fresh bun run dev
```

The name must differ from the database in `MONGODB_URL` and may contain only
letters, numbers, `_`, and `-`.

## A useful grader journey

Create two Playbooks that depend on the same Context Note. Use **Fix wording**
and confirm that no Review appears; then use **Information changed** and inspect
the Reviews created for both Playbooks. Invite a Member, have that Member ask a
Question beside a Step, answer it as the Owner, and confirm both sessions update.
Finally, reload and verify that the Question, answer, Context history, and Review
history persist. The [P3 Beta user journey](mvp/p3-beta-user-journey.md) gives
the complete narrated sequence.

## Testing

The full suite uses a real MongoDB server. Run `bun run db:up` first; tests use
unique temporary database names rather than the configured Relay database.

```sh
bun test
bun run typecheck
bun run build
bunx sync-engine check --show-advisories
bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
bunx sync-engine artifacts check
git diff --check
```

The saved final run records **148 passing tests, 936 expectations, and zero
failures**. It also records successful typechecking, production build, design
and generated-artifact checks, whitespace validation, and production-process
shutdown. The 28 nonfatal sync-engine advisories and their reviewed scope are
explained in the [deployment record](mvp/p3-beta-deployment-verification.md).

## Security boundary

Passwords are salted and hashed with scrypt. Random session tokens are stored
only as SHA-256 digests in MongoDB. Session cookies are HttpOnly,
SameSite=Strict, expire after eight hours, and use `Secure` when
`PUBLIC_ORIGIN` is HTTPS. Mutations require the exact Origin and a CSRF token.
Registration grants no workspace Role; invitation codes are single-use and
email-bound. Removing a Member revokes access even if that browser session is
still active.

## Deployment

For 6.1040 Apps, use Bun 1.4.0, package directory `.`, build script `build`,
start script `start`, port `3000`, and health-check path `/health`. Supply the
platform MongoDB integration as `MONGODB_URL` and set
`PUBLIC_ORIGIN=https://relay.mit-sdg.dev` without a trailing slash. The platform
provides `HOST`, `PORT`, and `NODE_ENV`; it does not use the local `.env` or
Compose configuration.

Relay serves `dist/` and the API from one Bun process. During a deployment,
`SIGTERM` for the replaced process is expected; Relay closes its listener and
MongoDB connection before exiting. The deployment record documents the
production smoke check and the standalone-MongoDB correction discovered during
P3 verification.
