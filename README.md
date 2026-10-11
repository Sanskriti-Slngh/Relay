# Relay

Relay helps MIT student clubs keep repeatable Procedures and shared Context
connected. A meaningful context change preserves its before/after text and
creates a pending Review for each attached active Procedure; a wording
correction does not.

## Local P2 demo

The local host is a **single-officer demo**, not production authentication. It
binds to `127.0.0.1` and uses a configured shared access credential to create a
short-lived, server-managed browser session. The session cookie is HttpOnly,
SameSite=Strict, held in memory on the server, and protected by a same-origin
check and CSRF token. Restarting the host expires all browser sessions.

1. Install Bun 1.3.4 or later and Podman with Compose. Install dependencies:

   ```sh
   bun install
   ```

2. Create the local MongoDB replica set if it is not already running:

   ```sh
   bun run db:up
   ```

3. Create a private `.env` from the example and set stable identities. The
   example values are intentionally invalid. Generate a fresh 32-byte random
   base64url credential in a local terminal:

   ```sh
   cp .env.example .env
   bun -e 'process.stdout.write(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url") + "\n")'
   ```

   Put the generated value in `LOCAL_ACCESS_CREDENTIAL` in `.env`. Set
   `CLUB_WORKSPACE_ID` and `OFFICER_USER_ID` to stable IDs and use a MongoDB URI
   with an explicit database name. Keep `.env` private; do not use a `VITE_`
   variable for the credential. Use a disposable local database name if you
   want to reset demo data.

4. Start the API and Vite development server together. For a clean first-run
   demo, choose a fresh isolated database name. This overrides only the URI's
   database path for the dev API process; it does not change `.env`:

   ```sh
   RELAY_DEMO_DATABASE=relay_demo_first_run bun run dev
   ```

   Choose a new name if that database already contains demo data. To use the
   configured URI database instead, run `bun run dev`. Startup validates
   configuration, connects to MongoDB, and creates or
   verifies the private Officer Role and workspace assignment before opening
   the API listener. It also starts Vite on loopback. Open
   [http://127.0.0.1:5173](http://127.0.0.1:5173), sign in with the local
   credential, and follow the workflow below.

5. Demonstrate the MVP:

   - Create two playbooks and add ordered steps to each.
   - Record one shared context note, then attach it to both playbooks. Optionally
     attach it to a particular Step.
   - Use **Correct wording** to fix text; this does not create Reviews.
   - Use **Meaningful change** to change the underlying meaning. Relay preserves
     the exact before/after text and waits for the associated review work to
     settle before refreshing the dashboard.
   - Open **Reviews**, inspect each playbook's cause text, and confirm a Review.
     The other affected Review remains pending.
   - Archive a Playbook from the Playbooks page when it is no longer active.
     Archiving preserves its Steps, Context attachments, and Reviews; open
     **Archived playbooks** to inspect it later.

The browser talks only to the composition's authorized HTTP operations and
read formers. Role-management and bootstrap actions are not public. User and
workspace identities are injected by the host; request-body identity fields
cannot change them.

### Local security boundary

The shared credential is entered by the user at sign-in and exchanged for an
in-memory session; it is not embedded in the frontend bundle or returned by an
endpoint. Any person or local process with the credential can act as the
configured Officer. Do not expose the listener beyond loopback, share the
credential, or treat this host as multi-user authentication. There is no TLS,
identity provider, persistent session store, or production-grade rate limiting.
The credential must be stored outside source control. The installed sync-engine
HTTP package documents Node.js 24 support; this project continues to host it
with Bun, which is outside that package's formal runtime support contract.

## Checks

```sh
bun run test
bun run typecheck
bun run build
bunx sync-engine check --show-advisories
bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
git diff --check
```

The MongoDB-backed tests require the configured test MongoDB replica set and
create/drop uniquely named test databases. They do not use the configured Relay
application database for fixtures.
