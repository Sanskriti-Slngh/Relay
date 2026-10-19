# Relay

Relay helps student clubs preserve repeatable procedures and the context behind
them. When shared information changes meaningfully, Relay preserves the exact
before-and-after text and creates a Review for each affected active Playbook.
A wording correction changes the text without creating Review work.

The live beta is available at [relay.mit-sdg.dev](https://relay.mit-sdg.dev/).
The narrated P3 demonstration is available on
[YouTube](https://youtu.be/2jB5J9K8b5Y).

## P3 Beta submission

### Implementation and design

- [Design index and specifications](design/README.md)
- [ProcedureMaintaining](design/concepts/ProcedureMaintaining.md)
- [ContextTracking](design/concepts/ContextTracking.md)
- [Questioning](design/concepts/Questioning.md)
- [Reviewing](design/concepts/Reviewing.md)
- [RoleBasedAccessing](design/concepts/RoleBasedAccessing.md)
- [Relay composition](design/compositions/Relay.md)
- [Visual design specification](design/visual-design.md)
- [Automated tests](tests/)
- [Saved verification output](artifacts/p3-verification-output.txt)

### Design deliverables

- [Typography study](slide-catalog/typography-slide.png)
- [Color study](slide-catalog/color-slide.png)
- [Typography study source](slide-catalog/typography-slide.svg)
- [Color study source](slide-catalog/color-slide.svg)
- [Updated P3 Beta user journey](mvp/p3-beta-user-journey.md)
- [Narrated screen recording](https://youtu.be/2jB5J9K8b5Y)
- [Deployment verification record](mvp/p3-beta-deployment-verification.md)

The current design notebook belongs in the private individual repository, not
in this public project repository. The private repository README should link to
its notebook and its submitted commit should be supplied separately in Commons.

## Implemented beta

Relay supports distinct authenticated users, persistent server-side sessions,
multiple isolated club workspaces, one Owner per configured workspace, Officer
and Member roles, one-time email-bound invitation codes, and permission-aware
Vue interfaces.

- Members can read Playbooks and Context Notes and ask Questions.
- Officers can edit official knowledge, answer Questions, complete Reviews,
  invite Members, promote Members, and remove Members.
- Owners have Officer permissions and can additionally manage Officers and
  transfer ownership.
- The server derives the actor and selected workspace from the session. Request
  bodies cannot choose a user, workspace, or role.
- Three-second polling and immediate local refresh keep sessions current without
  replacing unfinished local drafts.

Invitation codes are not sent by email. Relay creates a one-time code that an
Owner or Officer shares securely with the invited email address's owner. The
recipient must register with that same normalized email before accepting it.

## Local development

Requirements: Bun 1.4.0 and Podman with Compose.

1. Install dependencies:

   ```sh
   bun install
   ```

2. Start the local MongoDB replica set:

   ```sh
   bun run db:up
   ```

3. Create a private environment file:

   ```sh
   cp .env.example .env
   ```

   `MONGODB_URL` must contain an explicit database name. `PUBLIC_ORIGIN` must
   exactly match the browser origin, including whether it uses `localhost` or
   `127.0.0.1`. Never expose MongoDB credentials through a `VITE_` variable.

4. Start the API and Vite development server:

   ```sh
   bun run dev
   ```

   Open [http://127.0.0.1:5173](http://127.0.0.1:5173). To use a clean demo
   database without modifying `.env`, choose a new isolated name:

   ```sh
   RELAY_DEMO_DATABASE=relay_demo_fresh bun run dev
   ```

## Demonstration journey

1. Create a club and a Playbook, then add ordered Steps.
2. Add optional Context to a Step or reuse an existing shared Context Note.
3. Invite a Member by creating and securely sharing a one-time code.
4. Have the Member ask a Question beside a Step or Context Note.
5. Answer it from the Officer Questions inbox and confirm both sessions update.
6. Use **Fix wording** and confirm that no Review appears.
7. Use **Information changed** and inspect the generated affected Reviews.
8. Confirm one still-correct Playbook. Mark another as requiring changes, edit
   its Step, return to the Review, and resolve it.
9. Verify Question and Review history after reload.
10. Create a second club and confirm its users cannot access the first club.

## Verification

Start the test database, then run:

```sh
bun test
bun run typecheck
bun run build
bunx sync-engine check --show-advisories
bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md
bunx sync-engine artifacts check
git diff --check
```

The MongoDB-backed tests create and drop uniquely named test databases; they do
not use the configured Relay application database. The 28 sync-engine
advisories are documented in the deployment record. Generated contracts under
`generated/` are checked into source and validated with `artifacts check`.

## Security boundary

Passwords are salted and hashed with scrypt. Random session tokens are stored
only as SHA-256 digests in MongoDB. Session cookies are HttpOnly,
SameSite=Strict, expire after eight hours, and use `Secure` when
`PUBLIC_ORIGIN` is HTTPS. State-changing requests require the exact Origin and
a CSRF token. Registration grants no workspace role, invitation codes are
single-use and email-bound, and revoked Members immediately lose access even
if their browser session remains active.

## Deploying to 6.1040 Apps

The platform deploys a pushed Git commit and does not use local `.env`, Compose,
or Docker files. Use:

- Runtime: Bun 1.4.0
- Package directory: `.`
- Build script: `build`
- Start script: `start`
- Port: `3000`
- Health-check path: `/health`

Add the platform MongoDB integration with its URI exposed as `MONGODB_URL`.
Set `PUBLIC_ORIGIN=https://relay.mit-sdg.dev` with no trailing slash. The
platform supplies `HOST`, `PORT`, and `NODE_ENV`. Relay uses one MongoClient,
calls `client.db()` so the URI selects the database, serves `dist/` from the
same Bun process, and answers `/health` only after a live database ping.

During a deployment or environment-variable change, 6.1040 Apps sends the old
process `SIGTERM` and starts a replacement. Relay handles SIGTERM and SIGINT by
closing its listener and MongoDB connection. A log saying the previous start
script received SIGTERM is therefore expected during an intentional restart;
an exit code 1 or a replacement that never logs `Relay listening` is not.
