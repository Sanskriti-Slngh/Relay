# Relay

**Sanskriti Singh · MIT 6.1040 Software Design · Fall 2026**

Relay helps student clubs preserve recurring procedures and the knowledge behind them. When shared information changes, Relay identifies which Playbooks may need updating, preserving the original context so officers can make informed decisions.

**[Live Application](https://relay.mit-sdg.dev/)** · **[Narrated Demo](https://youtu.be/0bwM4Pb3J-0)** (2:59) · **[Final Design Document](design/p4-final-design.md)**

## What Relay does

Club knowledge often gets lost during leadership changes. Sometimes the opposite happens: outdated information continues to be passed down long after it stops being correct.

Relay addresses both problems through three connected features:

- **Playbooks:** Officers maintain step-by-step instructions for recurring club tasks.
- **Shared Context:** Policies, decisions, and lessons can be attached to multiple Playbooks without copying the same information everywhere.
- **Reviews:** When shared Context changes meaningfully, Relay preserves the before-and-after text and asks officers to reconsider the affected Playbooks.

Members can also ask Questions about specific Steps or Context Notes, allowing officers to clarify instructions without losing the discussion.

Relay supports multiple club workspaces with Owner, Officer, and Member roles. It uses Vue 3, Bun, and MongoDB, with persistent sessions, access control, and version checks to protect against conflicting edits.

## Project documentation

The main P4 materials and supporting documents are organized below.

| Document | Contents |
|---|---|
| **[P4 Final Design](design/p4-final-design.md)** | How Relay evolved from P1 and P3, significant decisions, and remaining tradeoffs |
| [Personal Design Notebook](https://github.com/Sanskriti-Slngh/6.1040/blob/main/relay-design-notebook.md) | My design reasoning, alternatives, challenges, and reflections |
| [Implementation Notebook](https://github.com/Sanskriti-Slngh/6.1040/blob/main/relay-implementation-notebook.md) | Development progress, technical decisions, and implementation records |
| [Concepts and Composition](design/README.md) | Current specifications, reactions, and earlier milestone designs |
| [Visual Design](design/visual-design.md) | Typography, colors, layout, and interface decisions |
| [Testing and Deployment Evidence](milestones/p4-deployment-verification.md) | Automated tests, deployed-app checks, and known limitations |
| [Manual Browser Checklist](milestones/p4-manual-browser-checklist.md) | Recorded Owner and Member workflow checks |
| [Milestone Archive](milestones/README.md) | Earlier P2 and P3 deliverables and supporting materials |

The personal notebooks are kept in my separate 6.1040 course repository. The application code, current specifications, and tests are in this repository.

## Run Relay locally

### Requirements

- [Bun 1.4.0](https://bun.sh/)
- [Podman](https://podman.io/) with a working `podman compose` provider
- Available ports: `3000`, `5173`, and `27018`

On macOS, start the Podman virtual machine if needed:

```sh
podman machine init
podman machine start
```

If the machine already exists, only run `podman machine start`.

### Installation

Clone the repository and install dependencies:

```sh
git clone https://github.com/Sanskriti-Slngh/Relay.git
cd Relay
bun install --frozen-lockfile
```

Start MongoDB, copy the example environment configuration, and launch the application:

```sh
bun run db:up
cp .env.example .env
bun run dev
```

Open **http://127.0.0.1:5173** in your browser.

Use `127.0.0.1` rather than `localhost`, since Relay checks the browser Origin exactly.

### Configuration

The included `.env.example` provides the required local settings:

```env
MONGODB_URL=mongodb://127.0.0.1:27018/relay?replicaSet=rs0
PUBLIC_ORIGIN=http://127.0.0.1:5173
```

`MONGODB_URL` must include a database name, and `PUBLIC_ORIGIN` must match the browser origin without a trailing slash. `HOST` and `PORT` are optional locally.

For a fresh demonstration workspace without changing the configured application database, you can run:

```sh
RELAY_DEMO_DATABASE=relay_demo_fresh bun run dev
```

The demo database name must differ from the configured database and can contain letters, numbers, underscores, and hyphens.

The local API runs at `http://127.0.0.1:3000`, with a health check at `http://127.0.0.1:3000/health`.

## Testing

Relay includes concept, composition, backend integration, multi-user, and frontend tests. The suite uses a real MongoDB server, with separate temporary databases for tests.

Start MongoDB if it is not already running:

```sh
bun run db:up
```

Run the test suite, typecheck, and production build:

```sh
bun test
bun run typecheck
bun run build
```

Validate the concept specifications, composition, and generated artifacts:

```sh
bunx sync-engine check --show-advisories
bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
bunx sync-engine artifacts check
git diff --check
```

The sync-engine source check has 30 documented nonfatal advisories. See the [P4 testing record](milestones/p4-deployment-verification.md) for verified test results, concurrency regression coverage, deployment checks, and testing limitations.

## Deployment

Relay is deployed through MIT 6.1040 Apps at **[relay.mit-sdg.dev](https://relay.mit-sdg.dev/)**.

Deployment configuration:

| Setting | Value |
|---|---|
| Runtime | Bun 1.4.0 |
| Package directory | `.` |
| Build script | `build` |
| Start script | `start` |
| Port | `3000` |
| Health check | `/health` |

The platform supplies `MONGODB_URL`, `HOST`, `PORT`, and `NODE_ENV`. Set `PUBLIC_ORIGIN` to `https://relay.mit-sdg.dev`.

Unlike local development, the deployed application serves the frontend and API from the same origin. Database credentials and other server configuration must remain server-side, never in frontend `VITE_` variables.