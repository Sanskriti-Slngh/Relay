# Relay

Relay helps MIT student clubs keep repeatable Procedures and shared Context
connected. A meaningful context change preserves its before/after text and
creates a pending Review for each attached active Procedure; a wording
correction does not.

The implemented beta walkthrough is documented in the
[P3 Beta user journey](mvp/p3-beta-user-journey.md). Its room-renewal policy is
fictional demo content, not a statement of current MIT policy. The original
[P1 journey](design/user-journey.md) and historical
[P2 MVP journey](mvp/p2-mvp-user-journey.md) remain available for comparison.

## P3 Beta submission map

- [Design index and specifications](design/README.md), including all five
  [concept specifications](design/concepts), the
  [Relay composition](design/compositions/Relay.md), and the
  [visual-system specification](design/visual-design.md)
- [Automated tests](tests) and
  [saved P3 verification output](artifacts/p3-verification-output.txt)
- [Updated P3 Beta user journey](mvp/p3-beta-user-journey.md)
- [Deployment-preparation and verification record](mvp/p3-beta-deployment-verification.md)
- [Implementation design notebook](mvp/design-notebook.md); the submission must
  also link the current notebook from the private individual repository

The required two-slide visual design study, final YouTube recording, confirmed
live deployment URL, private-repository link, and final submitted commit hashes
must be added before submission. The tracked `mvp/My Movie.mp4` is an obsolete
P2 recording longer than the P3 two-minute limit and is not submission-ready.

## Local development

Relay supports distinct accounts, persistent server-side sessions, multiple
club workspaces, and invitation-based Member onboarding. Workspace creators
become the sole Owner; Owner and Officer domain permissions continue to come
from RoleBasedAccessing
authorizes every composition operation using the User and selected workspace
loaded from the server-side session.

Invitations are email-bound but are not delivered by email. An Owner or Officer creates
a one-time code in Relay and shares it securely with the invited address's
owner, who must register with that same normalized email before accepting it.

1. Install Bun 1.4.0 and Podman with Compose. Install dependencies:

   ```sh
   bun install
   ```

2. Create the local MongoDB replica set if it is not already running:

   ```sh
   bun run db:up
   ```

3. Create a private `.env` from the example. Set `MONGODB_URL` to a URI with an
   explicit database name and set the exact browser origin:

   ```sh
   cp .env.example .env
   PUBLIC_ORIGIN=http://127.0.0.1:5173
   ```

   Keep MongoDB credentials private and do not expose them through a `VITE_`
   variable. Use a disposable local database name if you want to reset data.

4. Start the API and Vite development server together. For a clean first-run
   demo, choose a fresh isolated database name. This overrides only the URI's
   database path for the dev API process; it does not change `.env`:

   ```sh
   RELAY_DEMO_DATABASE=relay_demo_first_run bun run dev
   ```

   Choose a new name if that database already contains demo data. To use the
   configured URI database instead, run `bun run dev`. Startup validates
   configuration, connects to MongoDB, and creates or verifies the private
   Owner, Officer, and Member Roles before opening the API listener. It also starts
   Vite on loopback. Open
   [http://127.0.0.1:5173](http://127.0.0.1:5173), create an account and club,
   and follow the workflow below.

5. Demonstrate the MVP:

   - Create **Plan the Annual Club Showcase** and **Renew Club Room Access**,
     then add an ordered Step to each.
   - Record one fictional annual room-renewal Context Note, then attach it to
     the relevant Step in both Playbooks.
   - Use **Correct wording** to fix text; this does not create Reviews.
   - Use **Meaningful change** to change the underlying meaning. Relay preserves
     the exact before/after text and waits for the associated review work to
     settle before refreshing the dashboard.
   - Open **Reviews**, inspect each playbook's cause text, and confirm a Review.
     The other affected Review remains pending.
   - Mark a pending Review as requiring changes, edit the affected Playbook,
     and return to resolve it. A Review that is no longer relevant can be
     cancelled instead; both outcomes retain the Review's causes in history.
   - Rename Playbooks and edit, reorder, or remove their active Steps. Removing
     a Step detaches Context links anchored specifically to that Step while
     preserving the removed Step's identity.
   - Ask a Question beside a Step or attached Context Note. The Questions
     navigation count and officer inbox keep every unanswered item actionable;
     answering preserves the original Question beside its resolution.
   - Archive a Playbook from the Playbooks page when it is no longer active.
     Archiving preserves its Steps, Context attachments, and Reviews; open
     **Archived playbooks** to inspect it later.

The browser talks only to the composition's authorized HTTP operations and
read formers. Role-management and bootstrap actions are not public. User and
workspace identities are injected by the host; request-body identity fields
cannot change them.

All five P1 concepts are implemented. The P3 Beta host adds multi-user accounts,
multiple isolated club workspaces, Member invitations, workspace selection,
and permission-aware interfaces without adding a new domain concept.

### Security boundary

Passwords are salted and hashed with scrypt. Random session tokens are stored
only as SHA-256 digests in MongoDB; cookies are HttpOnly, SameSite=Strict,
eight-hour limited, and Secure whenever `PUBLIC_ORIGIN` uses HTTPS. State-changing
requests also require an exact Origin and CSRF token. Registration grants no
workspace role, invitation codes are single-use and email-bound, and the host
replaces any request-body User or workspace fields with verified session state.
Production deployments must use HTTPS and a private MongoDB connection string.
The installed sync-engine HTTP package documents Node.js 24 support; this
project continues to host it with Bun, outside that formal runtime contract.

## Checks

```sh
bun run test
bun run typecheck
bun run build
bunx sync-engine check --show-advisories
bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
bunx sync-engine artifacts check
git diff --check
```

`artifacts check` verifies the pinned read-back and wire contract under
`generated/`; it does not generate or modify them. The browser adapter derives
its response types from that wire contract but remains host-aware because it
must omit caller-controlled User and workspace fields from protected request
bodies. After an intentional composition or contract change, run
`bun run generate`, review both generated diffs, and then rerun the check.

The MongoDB-backed tests require the configured test MongoDB replica set and
create/drop uniquely named test databases. They do not use the configured Relay
application database for fixtures.

## Deploying to 6.1040 Apps

Relay follows the Fall 2026 course deployment procedure. The platform must
deploy a pushed commit; it does not use local files, Docker Compose, or `.env`.
Use these application settings:

- Runtime: Bun 1.4.0
- Package directory: `.`
- Build script: `build`
- Start script: `start`
- Port: `3000`
- Health-check path: `/health`

Add the platform MongoDB integration and expose its connection string to Relay
as `MONGODB_URL` (map a generated `MONGODB_URI` value if necessary). Add
`PUBLIC_ORIGIN=https://<app-name>.mit-sdg.dev` with no trailing slash. The
platform supplies `HOST`, `PORT`, and `NODE_ENV`; Relay reads `HOST` and `PORT`
and serves the built Vue application and API from the same origin. Never add a
MongoDB URI, invitation token, session token, or password to source control or
to a `VITE_` variable.

For a private GitHub repository, install the read-only deploy key generated by
6.1040 Apps and use **Check access** before deploying. Review the selected
branch and exact commit on the deployment screen, then deploy. `/health`
returns 200 only after the process has connected to MongoDB and a live ping
succeeds. Locally, `bun run preview` builds and starts the same production
host using the private `.env` configuration.

Relay detects whether MongoDB is a replica set. It uses database transactions
when they are available and serializes guarded multi-operation actions in the
single application process when running against the standalone MongoDB supplied
by 6.1040 Apps. Both modes retain the concepts' conditional-write and unique-
index checks.
