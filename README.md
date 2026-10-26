# Relay

Relay helps student clubs keep repeatable procedures and the context behind
them. When shared information changes meaningfully, Relay preserves the
before-and-after evidence and asks officers to review every affected Playbook.

- **Live application:** [relay.mit-sdg.dev](https://relay.mit-sdg.dev/)
- **P4 final design:** [Relay — Final Design](design/p4-final-design.md)
- **P4 narrated demo:** [YouTube](https://youtu.be/0bwM4Pb3J-0) (2:59.648)
- **Personal reflections:** [private 6.1040 repository](https://github.com/Sanskriti-Slngh/6.1040/blob/main/relay-design-notebook.md)

## Repository guide

This public repository contains the application, reviewed design documents,
generated contracts, tests, and deployment evidence. My private 6.1040
repository remains separate because it contains individual course work and
personal reflections; those reflections are not implementation records and are
not reproduced here. Its [P4 design reflections](https://github.com/Sanskriti-Slngh/6.1040/blob/main/relay-design-notebook.md)
record my design reasoning and lessons, while the separate
[implementation notebook](https://github.com/Sanskriti-Slngh/6.1040/blob/main/relay-implementation-notebook.md)
preserves technical progress, verification results, and AI-assisted records.

- [P4 final design](design/p4-final-design.md) is the short, reader-facing account
  of the problem, design evolution, major decisions, and tradeoffs.
- [Design index](design/README.md) links the current concept specifications and
  preserved P1–P3 design work.
- [P4 deployment verification](mvp/p4-deployment-verification.md) records test and
  deployment evidence with its provenance and limitations.
- [Milestone index](mvp/README.md) links the P2–P5 journeys and evidence.
- [`generated/`](generated/) contains tool-generated contracts; [`tests/`](tests/)
  contains automated verification. Neither is presented as personal reflection.

## What Relay supports

Relay is a persistent Vue and Bun application backed by MongoDB. Users can
belong to isolated club workspaces as Owner, Officer, or Member.

- Officers maintain ordered Playbooks and reusable Context Notes.
- A wording correction changes a Note quietly; a meaningful change preserves
  history and creates or updates Review work for affected active Playbooks.
- Members read official knowledge and ask Questions beside a Step or Context
  Note; Officers answer without detaching the discussion from its subject.
- Optimistic versions reject stale edits, and the interface keeps the local
  draft available for conflict recovery.
- The server derives identity, workspace, and permissions from the authenticated
  session instead of trusting request-body identities.

Invitation codes are not emailed by Relay. An Owner or Officer must securely
share the one-time code with the invited address's owner, who must register with
that same normalized email before accepting it.

## Local setup

Requirements: [Bun 1.4.0](https://bun.sh/) and [Podman](https://podman.io/) with
a working `podman compose` provider.

From a fresh clone:

```sh
bun install
bun run db:up
cp .env.example .env
bun run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Use this exact host rather
than `localhost` because Origin checks are exact.

The required environment variables are:

- `MONGODB_URL`: a MongoDB URI with an explicit database name. The example uses
  `mongodb://127.0.0.1:27018/relay?replicaSet=rs0`.
- `PUBLIC_ORIGIN`: the exact browser origin, without a trailing slash. Local
  development uses `http://127.0.0.1:5173`.

`HOST` and `PORT` are optional locally; the API defaults to `0.0.0.0:3000`.
Never expose MongoDB configuration through a `VITE_` variable.

To use a clean local workspace without changing the configured application
database, choose a fresh safe database name:

```sh
RELAY_DEMO_DATABASE=relay_demo_fresh bun run dev
```

The name must differ from the database in `MONGODB_URL` and may contain only
letters, numbers, `_`, and `-`.

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

Generated contracts are committed and checked by `sync-engine artifacts check`.
The current source check reports 30 nonfatal advisories; the release-specific
counts and verification scope are in the [P4 evidence record](mvp/p4-deployment-verification.md).

## Deployment

For 6.1040 Apps, use Bun 1.4.0, package directory `.`, build script `build`,
start script `start`, port `3000`, and health-check path `/health`. Supply the
platform MongoDB integration as `MONGODB_URL` and set
`PUBLIC_ORIGIN=https://relay.mit-sdg.dev` without a trailing slash. The platform
provides `HOST`, `PORT`, and `NODE_ENV`; it does not use the local `.env` or
Compose configuration.
