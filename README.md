# Relay

Relay helps student clubs preserve repeatable procedures and the context behind
them. When shared information changes meaningfully, Relay keeps the exact
before-and-after evidence and asks officers to reconsider every affected
Playbook.

- **Live application:** [relay.mit-sdg.dev](https://relay.mit-sdg.dev/)
- **Final P4 design:** [Relay — Final Design](design/p4-final-design.md)
- **Final P4 demonstration:** [Relay — P4 narrated demo](recordings/p4.mp4)
  (2:59.648)
- **Historical P3 demonstration:** [Relay — P3](https://youtu.be/2jB5J9K8b5Y)

## What Relay supports

Relay is a persistent Vue and Bun application backed by MongoDB. Distinct users
can belong to multiple isolated club workspaces as Owner, Officer, or Member.

- Officers maintain ordered Playbooks and reusable Context Notes.
- A wording correction changes a Note quietly; a meaningful change preserves
  history and creates or updates Review work for affected active Playbooks.
- Members read official knowledge and ask Questions beside a Step or Context
  Note; Officers answer without detaching the conversation from its subject.
- Optimistic versions reject stale edits, and the interface preserves the local
  draft for conflict recovery.
- The server derives user, workspace, and permissions from the authenticated
  session rather than trusting request-body identities.

Invitation codes are not emailed by Relay. An Owner or Officer securely shares
the one-time code with the invited address's owner, who must register with that
same normalized email before accepting it.

## Design and implementation

Start with the [final P4 design summary](design/p4-final-design.md). The
[design index](design/README.md) keeps the broader P1–P4 history and visual
studies accessible.

Current specifications:

- Concepts: [ProcedureMaintaining](design/concepts/ProcedureMaintaining.md),
  [ContextTracking](design/concepts/ContextTracking.md),
  [Questioning](design/concepts/Questioning.md),
  [Reviewing](design/concepts/Reviewing.md), and
  [RoleBasedAccessing](design/concepts/RoleBasedAccessing.md)
- [Relay composition and HTTP contract](design/compositions/Relay.md)
- [Visual design](design/visual-design.md)
- [Collaborative version control](design/version-control.md)
- [Generated wire contract](generated/wire.ts)

## Local setup

Requirements:

- [Bun 1.4.0](https://bun.sh/)
- [Podman](https://podman.io/) with a working `podman compose` provider

From a fresh clone:

1. Install the locked dependencies.

   ```sh
   bun install
   ```

2. Start and initialize the local single-node MongoDB replica set.

   ```sh
   bun run db:up
   ```

3. Create the ignored local environment file from the safe example.

   ```sh
   cp .env.example .env
   ```

4. Start the Bun API and Vite development server.

   ```sh
   bun run dev
   ```

5. Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Use this exact host,
   rather than `localhost`, because Origin checks are exact.

The required variables in `.env` are:

- `MONGODB_URL`: a MongoDB URI with an explicit database name. The example uses
  `mongodb://127.0.0.1:27018/relay?replicaSet=rs0`.
- `PUBLIC_ORIGIN`: the exact browser origin, with no trailing slash. Local
  development uses `http://127.0.0.1:5173`.

`HOST` and `PORT` are optional locally; the API defaults to `0.0.0.0:3000`.
Never expose MongoDB configuration through a `VITE_` variable.

To exercise a clean local workspace without changing the configured application
database, choose a fresh safe database name:

```sh
RELAY_DEMO_DATABASE=relay_demo_fresh bun run dev
```

The name must differ from the database in `MONGODB_URL` and may contain only
letters, numbers, `_`, and `-`.

## Testing and verification

The full suite uses a real MongoDB server. Run `bun run db:up` first; the
database-backed tests create and drop uniquely named test databases rather than
using the configured Relay application database.

```sh
bun test
bun run typecheck
bun run build
bunx sync-engine check --show-advisories
bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
bunx sync-engine artifacts check
git diff --check
```

Generated contracts under `generated/` are committed and checked by
`sync-engine artifacts check`. The final source check reports 30 nonfatal
advisories; the earlier deployed-release count and scope remain documented in
the [P4 deployment-verification record](mvp/p4-deployment-verification.md).

## Project materials

- [P4 deployment verification](mvp/p4-deployment-verification.md) — preserves
  the detailed evidence for release `8eb920e…` and separately identifies the
  later user-reported validation of `21a6fac…`
- [P4 narrated demonstration](recordings/p4.mp4) — the completed 2:59.648
  submission recording with audio narration
- [P4 demonstration recording plan](mvp/p4-demo-recording-plan.md) — the
  timestamped plan used to prepare the final recording
- [P5 user-testing preparation](mvp/p5-user-testing-prep.md) — preparation only;
  no participant results are claimed
- [Milestone index](mvp/README.md) — P2, P3, and P4 evidence
- [Automated tests](tests/)

The current design notebook remains in the private individual course
repository and is intentionally ignored here.

## Security and deployment notes

Passwords use salted scrypt hashes. Session tokens are stored only as SHA-256
digests; browser cookies are HttpOnly and SameSite=Strict, with `Secure` enabled
for HTTPS. Protected mutations require the exact Origin and a per-session CSRF
token. Registration alone grants no workspace access.

For 6.1040 Apps, use Bun 1.4.0, package directory `.`, build script `build`,
start script `start`, port `3000`, and health-check path `/health`. Provide the
platform MongoDB integration as `MONGODB_URL` and set
`PUBLIC_ORIGIN=https://relay.mit-sdg.dev` without a trailing slash. The platform
supplies `HOST`, `PORT`, and `NODE_ENV`; it does not use the local `.env` or
Compose configuration.
