import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { createApplication } from "../../src/assembly.ts";
import { AccountStore } from "../../src/host/accounts.ts";
import type { DeploymentHostConfig } from "../../src/host/config.ts";
import { createMultiUserRelayHttpHandler } from "../../src/host/multiUserHttp.ts";
import { provisionApplicationRoles } from "../../src/host/provision.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) throw new Error("MONGODB_URL is required.");
const client = new MongoClient(configuredUrl);
const databaseName = `relay_multi_user_${crypto.randomUUID().replaceAll("-", "")}`;
const database = client.db(databaseName);
const origin = "http://127.0.0.1:5173";
const config: DeploymentHostConfig = { mongodbUrl: configuredUrl, appOrigin: origin, secureCookies: false };

type Browser = { cookie: string; csrf: string };
let handler: (request: Request) => Promise<Response>;
let application: ReturnType<typeof createApplication>["application"];
let roleAccess: ReturnType<typeof createApplication>["roleAccess"];

async function call(path: string, body?: Record<string, unknown>, browser?: Browser) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (browser) { headers.set("cookie", browser.cookie); headers.set("x-relay-csrf", browser.csrf); }
  const result = await handler(new Request(`http://127.0.0.1${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: result.status, headers: result.headers, body: await result.json() as Record<string, any> };
}

async function register(email: string): Promise<Browser> {
  const result = await call("/auth/register", { email, password: "a secure password", name: email.split("@")[0] });
  expect(result.status).toBe(200);
  return { cookie: result.headers.get("set-cookie")!.split(";")[0], csrf: result.body.csrfToken };
}

describe("multi-user Relay host", () => {
  beforeAll(async () => {
    await client.connect();
    ({ application, roleAccess } = createApplication(database, client));
    const roles = await provisionApplicationRoles(roleAccess);
    handler = createMultiUserRelayHttpHandler(application, new AccountStore(database, roleAccess), config, roles);
  });

  afterAll(async () => {
    try { if (application) await application.whenIdle(); await database.dropDatabase(); }
    finally { await client.close(); }
  });

  test("registers distinct users, creates isolated clubs, and never trusts forged identities", async () => {
    const officer = await register("officer@example.org");
    const firstClub = await call("/workspaces/create", { name: "First Club" }, officer);
    expect(firstClub.status).toBe(200);
    const firstWorkspace = firstClub.body.workspace as string;
    const privateInvitation = await call("/invitations/create", { email: "private@example.org" }, officer);
    const procedure = await call("/api/workspaces/procedures/create", { title: "Private plan", user: "forged", workspace: "forged" }, officer);
    expect(procedure.status).toBe(200);

    const outsider = await register("outsider@example.org");
    const secondClub = await call("/workspaces/create", { name: "Second Club" }, outsider);
    expect(secondClub.status).toBe(200);
    expect(secondClub.body.workspace).not.toBe(firstWorkspace);
    const outsiderRead = await call("/api/workspaces/procedures", { workspace: firstWorkspace, user: firstClub.body.user?.id }, outsider);
    expect(outsiderRead.status).toBe(200);
    expect(outsiderRead.body.procedures).toEqual([]);
    const forgedRosterRead = await call("/workspaces/members", { workspace: firstWorkspace }, outsider);
    expect(forgedRosterRead.status).toBe(200);
    expect(forgedRosterRead.body.members).toEqual([
      expect.objectContaining({ name: "outsider", role: "Owner", email: "outsider@example.org" }),
    ]);
    expect(forgedRosterRead.body.members).not.toContainEqual(expect.objectContaining({ name: "officer" }));
    expect((await call("/invitations/pending", { workspace: firstWorkspace }, outsider)).body.invitations).toEqual([]);
    expect((await call("/invitations/reissue", { invitation: privateInvitation.body.invitation }, outsider)).status).toBe(404);
    const selectForeign = await call("/workspaces/select", { workspace: firstWorkspace }, outsider);
    expect(selectForeign).toEqual(expect.objectContaining({ status: 404 }));
  });

  test("supports one-time member invitations and enforces Member and Officer permissions", async () => {
    const officer = await register("leader@example.org");
    const club = await call("/workspaces/create", { name: "Robotics" }, officer);
    const procedure = await call("/api/workspaces/procedures/create", { title: "Competition setup" }, officer);
    const step = await call("/api/workspaces/procedures/steps/add", { procedure: procedure.body.procedure, text: "Charge batteries" }, officer);
    const invitation = await call("/invitations/create", { email: "member@example.org", role: "Officer" }, officer);
    expect(invitation.status).toBe(200);
    expect(invitation.body).toEqual(expect.objectContaining({
      invitation: expect.any(String),
      email: "member@example.org",
      token: expect.any(String),
      expiresAt: expect.any(String),
    }));
    const storedInvitation = await database.collection("host_invitations").findOne({ _id: invitation.body.invitation });
    expect(storedInvitation?.tokenHash).not.toBe(invitation.body.token);
    expect(storedInvitation).not.toHaveProperty("token");
    expect((await call("/workspaces/members", {}, officer)).body.members).toEqual([
      expect.objectContaining({ name: "leader", role: "Owner", email: "leader@example.org" }),
    ]);
    expect((await call("/invitations/pending", {}, officer)).body.invitations).toEqual([
      expect.objectContaining({ invitation: invitation.body.invitation, email: "member@example.org", status: "PENDING" }),
    ]);

    const member = await register("member@example.org");
    const accepted = await call("/invitations/accept", { token: invitation.body.token, role: "Officer" }, member);
    expect(accepted.status).toBe(200);
    expect(accepted.body.role).toBe("Member");
    expect(accepted.body.workspace).toBe(club.body.workspace);
    const reused = await call("/invitations/accept", { token: invitation.body.token }, member);
    expect(reused.status).toBe(404);
    expect((await call("/invitations/pending", {}, officer)).body.invitations).toEqual([]);
    expect((await call("/workspaces/members", {}, officer)).body.members).toEqual([
      expect.objectContaining({ name: "leader", role: "Owner", email: "leader@example.org" }),
      expect.objectContaining({ name: "member", role: "Member", email: "member@example.org" }),
    ]);
    const memberRoster = await call("/workspaces/members", {}, member);
    expect(memberRoster.status).toBe(200);
    expect(memberRoster.body.members).toEqual([
      expect.objectContaining({ name: "leader", role: "Owner" }),
      expect.objectContaining({ name: "member", role: "Member" }),
    ]);
    expect(memberRoster.body.members.every((entry: Record<string, unknown>) => !("email" in entry))).toBe(true);
    expect((await call("/invitations/pending", {}, member)).status).toBe(403);
    expect((await call("/invitations/reissue", { invitation: invitation.body.invitation }, member)).status).toBe(403);

    const read = await call("/api/workspaces/procedures", {}, member);
    expect(read.status).toBe(200);
    expect(read.body.procedures[0].title).toBe("Competition setup");
    const forbiddenEdit = await call("/api/workspaces/procedures/rename", { procedure: procedure.body.procedure, title: "Forged edit", user: accepted.body.user?.id }, member);
    expect(forbiddenEdit.status).toBe(403);
    const question = await call("/api/workspaces/questions/steps/ask", { procedure: procedure.body.procedure, step: step.body.step, text: "Which charger?" }, member);
    expect(question.status).toBe(200);
    const forbiddenAnswer = await call("/api/workspaces/questions/steps/answer", { question: question.body.question, answer: "Mine" }, member);
    expect(forbiddenAnswer.status).toBe(403);
    const officerAnswer = await call("/api/workspaces/questions/steps/answer", { question: question.body.question, answer: "Use the labeled charger." }, officer);
    expect(officerAnswer.status).toBe(200);
    const forbiddenRevision = await call("/api/workspaces/questions/steps/revise", { question: question.body.question, answer: "Forged revision", user: club.body.user?.id }, member);
    expect(forbiddenRevision.status).toBe(403);
    const officerRevision = await call("/api/workspaces/questions/steps/revise", { question: question.body.question, answer: "Use the blue labeled charger." }, officer);
    expect(officerRevision.status).toBe(200);
    const questionHistory = await call("/api/workspaces/questions", {}, member);
    expect(questionHistory.body.stepQuestions).toContainEqual(expect.objectContaining({
      question: question.body.question,
      answer: "Use the blue labeled charger.",
    }));

    const original = await call("/invitations/create", { email: "replacement@example.org" }, officer);
    const replacement = await call("/invitations/reissue", { invitation: original.body.invitation }, officer);
    expect(replacement.status).toBe(200);
    expect(replacement.body.token).not.toBe(original.body.token);
    expect(replacement.body.email).toBe("replacement@example.org");
    const replacementMember = await register("replacement@example.org");
    expect((await call("/invitations/accept", { token: original.body.token }, replacementMember)).status).toBe(404);
    expect((await call("/invitations/accept", { token: replacement.body.token }, replacementMember)).status).toBe(200);
    expect((await call("/invitations/pending", {}, officer)).body.invitations).toEqual([]);
  });

  test("enforces Owner, Officer, and Member transitions with revocation and safe legacy migration", async () => {
    const owner = await register("roles-owner@example.org");
    const club = await call("/workspaces/create", { name: "Roles Club" }, owner);
    expect(club.body.role).toBe("Owner");
    expect(club.body.workspaces[0].ownershipConfigured).toBe(true);
    const ownerId = club.body.user.id as string;

    const officerBrowser = await register("roles-officer@example.org");
    const officerId = (await call("/session", undefined, officerBrowser)).body.user.id as string;
    const memberBrowser = await register("roles-member@example.org");
    const memberId = (await call("/session", undefined, memberBrowser)).body.user.id as string;
    for (const [email, browser] of [["roles-officer@example.org", officerBrowser], ["roles-member@example.org", memberBrowser]] as const) {
      const invitation = await call("/invitations/create", { email }, owner);
      expect((await call("/invitations/accept", { token: invitation.body.token }, browser)).status).toBe(200);
    }

    expect((await call("/workspaces/members/role", { targetUser: officerId, role: "Officer", actor: memberId }, memberBrowser)).status).toBe(403);
    expect((await call("/workspaces/members/role", { targetUser: officerId, role: "Officer" }, owner)).status).toBe(200);
    expect((await call("/workspaces/members/role", { targetUser: memberId, role: "Officer" }, officerBrowser)).status).toBe(200);
    const applicationRoles = await provisionApplicationRoles(roleAccess);
    const duplicate = await roleAccess.assign({ user: memberId, resource: club.body.workspace, role: applicationRoles.memberRole });
    expect((await call("/api/workspaces/procedures", {}, memberBrowser)).status).toBe(403);
    await roleAccess.unassign({ assignment: duplicate.assignment });
    expect((await call("/workspaces/members/role", { targetUser: memberId, role: "Member" }, officerBrowser)).status).toBe(403);
    expect((await call("/workspaces/members/remove", { targetUser: ownerId }, officerBrowser)).status).toBe(403);
    expect((await call("/workspaces/members/remove", { targetUser: ownerId }, owner)).status).toBe(409);

    expect((await call("/workspaces/members/role", { targetUser: officerId, role: "Member" }, owner)).status).toBe(200);
    const restorationInvite = await call("/invitations/create", { email: "roles-officer@example.org" }, owner);
    expect((await call("/workspaces/members/remove", { targetUser: officerId }, owner)).status).toBe(200);
    expect((await call("/api/workspaces/procedures", {}, officerBrowser)).status).toBe(409);
    expect((await call("/session", undefined, officerBrowser)).body.workspace).toBeUndefined();
    expect((await call("/invitations/accept", { token: restorationInvite.body.token }, officerBrowser)).status).toBe(404);

    expect((await call("/workspaces/ownership/transfer", { targetUser: memberId, formerOwnerRole: "Member" }, officerBrowser)).status).toBe(409);
    const transferred = await call("/workspaces/ownership/transfer", { targetUser: memberId, formerOwnerRole: "Member", actor: memberId }, owner);
    expect(transferred.status).toBe(200);
    expect(transferred.body.role).toBe("Member");
    expect((await call("/api/workspaces/procedures/create", { title: "Former owner edit" }, owner)).status).toBe(403);
    const memberSession = await call("/session", undefined, memberBrowser);
    expect(memberSession.body.role).toBe("Owner");
    expect((await call("/workspaces/members/remove", { targetUser: ownerId }, memberBrowser)).status).toBe(200);
    expect((await call("/api/workspaces/procedures", {}, owner)).status).toBe(409);
    expect((await call("/session", undefined, owner)).body.workspace).toBeUndefined();

    const roleEvents = await call("/workspaces/activity", {}, memberBrowser);
    expect(roleEvents.body.events.map((event: Record<string, unknown>) => event.type)).toEqual(expect.arrayContaining([
      "OWNERSHIP_TRANSFERRED", "MEMBER_REMOVED", "OFFICER_DEMOTED", "MEMBER_PROMOTED",
    ]));
    expect(JSON.stringify(roleEvents.body.events)).not.toContain("roles-officer@example.org");

    const legacyA = await register("legacy-a@example.org");
    const legacyB = await register("legacy-b@example.org");
    const legacyAId = (await call("/session", undefined, legacyA)).body.user.id as string;
    const legacyBId = (await call("/session", undefined, legacyB)).body.user.id as string;
    const legacyWorkspace = crypto.randomUUID();
    const roles = applicationRoles;
    const workspaceDocuments = database.collection<{ _id: string; name: string; createdAt: Date; owner?: string }>("host_workspaces");
    await workspaceDocuments.insertOne({ _id: legacyWorkspace, name: "Legacy Club", createdAt: new Date() });
    await roleAccess.assign({ user: legacyAId, resource: legacyWorkspace, role: roles.officerRole });
    await roleAccess.assign({ user: legacyBId, resource: legacyWorkspace, role: roles.officerRole });
    await call("/workspaces/select", { workspace: legacyWorkspace }, legacyA);
    await call("/workspaces/select", { workspace: legacyWorkspace }, legacyB);
    expect((await call("/session", undefined, legacyA)).body.workspaces.find((entry: Record<string, unknown>) => entry.workspace === legacyWorkspace).ownershipConfigured).toBe(false);
    const claims = await Promise.all([
      call("/workspaces/ownership/claim", {}, legacyA),
      call("/workspaces/ownership/claim", {}, legacyB),
    ]);
    expect(claims.map(({ status }) => status).toSorted()).toEqual([200, 409]);
    const storedLegacy = await workspaceDocuments.findOne({ _id: legacyWorkspace });
    expect(storedLegacy?.owner).toBeDefined();
    expect([legacyAId, legacyBId]).toContain(storedLegacy!.owner!);
    const legacyMembers = await call("/workspaces/members", {}, claims[0].status === 200 ? legacyA : legacyB);
    expect(legacyMembers.body.members.filter((entry: Record<string, unknown>) => entry.role === "Owner")).toHaveLength(1);
  });

  test("serializes concurrent ownership transfers and limits Officer management to Members", async () => {
    const owner = await register("concurrent-owner@example.org");
    const club = await call("/workspaces/create", { name: "Concurrent Roles" }, owner);
    const browsers = {
      officer: await register("concurrent-officer@example.org"),
      first: await register("concurrent-first@example.org"),
      second: await register("concurrent-second@example.org"),
      removable: await register("concurrent-removable@example.org"),
    };
    const ids: Record<string, string> = {};
    for (const [key, browser] of Object.entries(browsers)) {
      const session = await call("/session", undefined, browser);
      ids[key] = session.body.user.id;
      const invitation = await call("/invitations/create", { email: session.body.user.email }, owner);
      expect((await call("/invitations/accept", { token: invitation.body.token }, browser)).status).toBe(200);
    }
    expect((await call("/workspaces/members/role", { targetUser: ids.officer, role: "Officer" }, owner)).status).toBe(200);
    expect((await call("/invitations/create", { email: "officer-invited@example.org" }, browsers.officer)).status).toBe(200);
    expect((await call("/workspaces/members/remove", { targetUser: ids.removable }, browsers.officer)).status).toBe(200);
    expect((await call("/workspaces/members/role", { targetUser: ids.first, role: "Officer" }, browsers.officer)).status).toBe(200);
    expect((await call("/workspaces/members/remove", { targetUser: ids.first }, browsers.officer)).status).toBe(403);

    const outsider = await register("concurrent-outsider@example.org");
    const outsiderClub = await call("/workspaces/create", { name: "Foreign Roles" }, outsider);
    expect((await call("/workspaces/members/role", { targetUser: outsiderClub.body.user.id, role: "Officer" }, owner)).status).toBe(404);

    const transfers = await Promise.all([
      call("/workspaces/ownership/transfer", { targetUser: ids.first, formerOwnerRole: "Officer" }, owner),
      call("/workspaces/ownership/transfer", { targetUser: ids.second, formerOwnerRole: "Officer" }, owner),
    ]);
    expect(transfers.map(({ status }) => status).toSorted()).toEqual([200, 403]);
    const stored = await database.collection("host_workspaces").findOne({ _id: club.body.workspace });
    expect([ids.first, ids.second]).toContain(stored?.owner);
    const winner = stored?.owner === ids.first ? browsers.first : browsers.second;
    const roster = await call("/workspaces/members", {}, winner);
    expect(roster.body.members.filter((entry: Record<string, unknown>) => entry.role === "Owner")).toHaveLength(1);
  });

  test("persists the five newest successful activities with Officer-only workspace isolation", async () => {
    const officer = await register("activity-officer@example.org");
    const club = await call("/workspaces/create", { name: "Activity Club" }, officer);
    const startedAt = Date.now();
    const created = await call("/api/workspaces/procedures/create", { title: "Book Rehearsal Space" }, officer);
    expect(created.status).toBe(200);

    const firstRead = await call("/workspaces/activity", {}, officer);
    expect(firstRead.status).toBe(200);
    expect(firstRead.body.events).toEqual([
      expect.objectContaining({
        actorName: "activity-officer",
        type: "PLAYBOOK_CREATED",
        procedure: created.body.procedure,
        procedureTitle: "Book Rehearsal Space",
      }),
    ]);
    expect(new Date(firstRead.body.events[0].occurredAt).getTime()).toBeGreaterThanOrEqual(startedAt);

    await call("/api/workspaces/procedures/rename", { procedure: created.body.procedure, title: "Reserve Rehearsal Space" }, officer);
    const added = await call("/api/workspaces/procedures/steps/add", { procedure: created.body.procedure, text: "Open the booking portal" }, officer);
    await call("/api/workspaces/procedures/steps/edit", { procedure: created.body.procedure, step: added.body.step, text: "Open the campus booking portal" }, officer);
    await call("/api/workspaces/procedures/steps/remove", { procedure: created.body.procedure, step: added.body.step }, officer);
    const note = await call("/api/workspaces/context/notes", { text: "Bookings open on Mondays." }, officer);
    const countAfterContextCreation = await database.collection("host_activity").countDocuments({ workspace: club.body.workspace });
    await call("/api/workspaces/context/attachments", { context: note.body.context, procedure: created.body.procedure }, officer);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(countAfterContextCreation);
    await call("/api/workspaces/context/change", { context: note.body.context, text: "Bookings open on Tuesdays." }, officer);

    const recent = await call("/workspaces/activity", {}, officer);
    expect(recent.status).toBe(200);
    expect(recent.body.events).toHaveLength(5);
    expect(recent.body.events.map((event: Record<string, unknown>) => event.type)).toEqual([
      "CONTEXT_CHANGED", "CONTEXT_ATTACHED", "STEP_REMOVED", "STEP_EDITED", "STEP_ADDED",
    ]);
    expect(recent.body.events[1]).toEqual(expect.objectContaining({ context: note.body.context, procedure: created.body.procedure }));
    expect(recent.body.events[2]).toEqual(expect.objectContaining({ step: added.body.step, stepPosition: 1 }));

    const beforeFailure = await database.collection("host_activity").countDocuments({ workspace: club.body.workspace });
    expect((await call("/api/workspaces/procedures/steps/edit", {
      procedure: created.body.procedure,
      step: added.body.step,
      text: "This removed Step cannot be edited",
    }, officer)).status).toBe(404);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(beforeFailure);

    const invitation = await call("/invitations/create", { email: "activity-member@example.org" }, officer);
    const member = await register("activity-member@example.org");
    await call("/invitations/accept", { token: invitation.body.token }, member);
    expect((await call("/workspaces/activity", {}, member)).status).toBe(403);
    expect((await call("/api/workspaces/procedures/rename", {
      procedure: created.body.procedure,
      title: "Forged member edit",
    }, member)).status).toBe(403);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(beforeFailure);

    const outsider = await register("activity-outsider@example.org");
    const otherClub = await call("/workspaces/create", { name: "Other Activity Club" }, outsider);
    await call("/api/workspaces/procedures/create", { title: "Private Other Playbook" }, outsider);
    const otherEvents = await call("/workspaces/activity", {}, outsider);
    expect(otherEvents.body.events).toHaveLength(1);
    expect(otherEvents.body.events[0].procedureTitle).toBe("Private Other Playbook");
    expect(otherEvents.body.events.every((event: Record<string, unknown>) => event.procedureTitle !== "Reserve Rehearsal Space")).toBe(true);
    expect(otherClub.body.workspace).not.toBe(club.body.workspace);

    const roles = await provisionApplicationRoles(roleAccess);
    handler = createMultiUserRelayHttpHandler(application, new AccountStore(database, roleAccess), config, roles);
    const persisted = await call("/workspaces/activity", {}, officer);
    expect(persisted.body.events.map((event: Record<string, unknown>) => event.event)).toEqual(
      recent.body.events.map((event: Record<string, unknown>) => event.event),
    );
  });

  test("records meaningful archive, Context, Review, and Question activity without workflow spam", async () => {
    const officer = await register("expanded-activity@example.org");
    const club = await call("/workspaces/create", { name: "Expanded Activity Club" }, officer);
    const procedure = await call("/api/workspaces/procedures/create", { title: "Officer Handoff" }, officer);
    const step = await call("/api/workspaces/procedures/steps/add", {
      procedure: procedure.body.procedure,
      text: "Review the handoff notes",
    }, officer);

    const standalone = await call("/api/workspaces/context/notes", { text: "This note remains shared." }, officer);
    expect((await call("/workspaces/activity", {}, officer)).body.events[0]).toEqual(expect.objectContaining({
      type: "CONTEXT_CREATED",
      context: standalone.body.context,
    }));

    const inline = await call("/api/workspaces/context/notes", { text: "Use the current officer checklist." }, officer);
    const countAfterInlineCreation = await database.collection("host_activity").countDocuments({ workspace: club.body.workspace });
    const inlineAttachment = await call("/api/workspaces/context/step-attachments", {
      context: inline.body.context,
      procedure: procedure.body.procedure,
      step: step.body.step,
    }, officer);
    expect(inlineAttachment.status).toBe(200);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(countAfterInlineCreation);
    expect((await call("/workspaces/activity", {}, officer)).body.events[0]).toEqual(expect.objectContaining({
      type: "CONTEXT_ATTACHED",
      context: inline.body.context,
      attachment: inlineAttachment.body.attachment,
      procedure: procedure.body.procedure,
      step: step.body.step,
      stepPosition: 1,
    }));

    const existing = await call("/api/workspaces/context/notes", { text: "Officers meet each semester." }, officer);
    await database.collection("host_activity").updateOne(
      { workspace: club.body.workspace, context: existing.body.context, type: "CONTEXT_CREATED" },
      { $set: { occurredAt: new Date("2020-01-01T00:00:00Z") } },
    );
    const countBeforeExistingAttachment = await database.collection("host_activity").countDocuments({ workspace: club.body.workspace });
    expect((await call("/api/workspaces/context/attachments", {
      context: existing.body.context,
      procedure: procedure.body.procedure,
    }, officer)).status).toBe(200);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(countBeforeExistingAttachment + 1);

    const beforeFailedAttachment = await database.collection("host_activity").countDocuments({ workspace: club.body.workspace });
    expect((await call("/api/workspaces/context/attachments", {
      context: "missing-context",
      procedure: procedure.body.procedure,
    }, officer)).status).toBe(404);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(beforeFailedAttachment);

    await call("/api/workspaces/context/change", { context: existing.body.context, text: "Officers meet each month." }, officer);
    const firstReview = (await call("/api/workspaces/reviews/pending", {}, officer)).body.reviews[0];
    expect((await call("/api/workspaces/reviews/confirm", {
      review: firstReview.review,
      procedure: procedure.body.procedure,
    }, officer)).status).toBe(200);
    expect((await call("/workspaces/activity", {}, officer)).body.events[0]).toEqual(expect.objectContaining({
      type: "REVIEW_CONFIRMED",
      review: firstReview.review,
      procedure: procedure.body.procedure,
    }));

    await call("/api/workspaces/context/change", { context: existing.body.context, text: "Officers meet each week." }, officer);
    const secondReview = (await call("/api/workspaces/reviews/pending", {}, officer)).body.reviews[0];
    await call("/api/workspaces/reviews/require-changes", {
      review: secondReview.review,
      procedure: procedure.body.procedure,
    }, officer);
    expect((await call("/api/workspaces/reviews/resolve", {
      review: secondReview.review,
      procedure: procedure.body.procedure,
    }, officer)).status).toBe(200);
    expect((await call("/workspaces/activity", {}, officer)).body.events[0]).toEqual(expect.objectContaining({
      type: "REVIEW_RESOLVED",
      review: secondReview.review,
      procedure: procedure.body.procedure,
    }));

    const contextQuestion = await call("/api/workspaces/questions/context/ask", {
      procedure: procedure.body.procedure,
      context: existing.body.context,
      text: "Does this apply this week?",
    }, officer);
    expect((await call("/api/workspaces/questions/context/answer", {
      question: contextQuestion.body.question,
      answer: "Yes, use the weekly schedule.",
    }, officer)).status).toBe(200);
    const contextAnswerEvent = (await call("/workspaces/activity", {}, officer)).body.events[0];
    expect(contextAnswerEvent).toEqual(expect.objectContaining({
      type: "QUESTION_ANSWERED",
      question: contextQuestion.body.question,
      context: existing.body.context,
      procedure: procedure.body.procedure,
    }));
    expect(contextAnswerEvent).not.toHaveProperty("answer");

    const question = await call("/api/workspaces/questions/steps/ask", {
      procedure: procedure.body.procedure,
      step: step.body.step,
      text: "Which notes?",
    }, officer);
    expect((await call("/api/workspaces/questions/steps/answer", {
      question: question.body.question,
      answer: "Use the current handoff notes.",
    }, officer)).status).toBe(200);
    expect((await call("/workspaces/activity", {}, officer)).body.events[0]).toEqual(expect.objectContaining({
      type: "QUESTION_ANSWERED",
      question: question.body.question,
      procedure: procedure.body.procedure,
      step: step.body.step,
    }));

    const beforeNoise = await database.collection("host_activity").countDocuments({ workspace: club.body.workspace });
    expect((await call("/api/workspaces/procedures/steps/move", {
      procedure: procedure.body.procedure,
      step: step.body.step,
      position: 1,
    }, officer)).status).toBe(200);
    expect((await call("/api/workspaces/context/correct", {
      context: standalone.body.context,
      text: "This shared note remains available.",
    }, officer)).status).toBe(200);
    expect(await database.collection("host_activity").countDocuments({ workspace: club.body.workspace })).toBe(beforeNoise);

    expect((await call("/api/workspaces/procedures/archive", { procedure: procedure.body.procedure }, officer)).status).toBe(200);
    expect((await call("/workspaces/activity", {}, officer)).body.events[0]).toEqual(expect.objectContaining({
      type: "PLAYBOOK_ARCHIVED",
      procedure: procedure.body.procedure,
      procedureTitle: "Officer Handoff",
    }));
  });

  test("rejects expired invitation tokens and omits them from pending administration", async () => {
    const previousHandler = handler;
    let now = new Date("2026-10-01T12:00:00Z");
    const { application: expiringApplication, roleAccess } = createApplication(database, client);
    const roles = await provisionApplicationRoles(roleAccess);
    handler = createMultiUserRelayHttpHandler(expiringApplication, new AccountStore(database, roleAccess, () => now), config, roles);
    try {
      const officer = await register("expiry-officer@example.org");
      const club = await call("/workspaces/create", { name: "Expiry Club" }, officer);
      const invitation = await call("/invitations/create", { email: "expired@example.org" }, officer);
      now = new Date("2026-10-09T12:00:00Z");
      const invitee = await register("expired@example.org");
      expect((await call("/invitations/accept", { token: invitation.body.token }, invitee)).status).toBe(404);
      const renewedOfficer = await call("/auth/login", { email: "expiry-officer@example.org", password: "a secure password" });
      const currentOfficer = { cookie: renewedOfficer.headers.get("set-cookie")!.split(";")[0], csrf: renewedOfficer.body.csrfToken };
      await call("/workspaces/select", { workspace: club.body.workspace }, currentOfficer);
      expect((await call("/invitations/pending", {}, currentOfficer)).body.invitations).toEqual([]);
    } finally {
      handler = previousHandler;
    }
  });

  test("persists sessions across handler instances and expires them server-side", async () => {
    let now = new Date("2026-10-17T12:00:00Z");
    const { application: secondApplication, roleAccess } = createApplication(database, client);
    const roles = await provisionApplicationRoles(roleAccess);
    const store = new AccountStore(database, roleAccess, () => now);
    const firstHandler = createMultiUserRelayHttpHandler(secondApplication, store, config, roles);
    handler = firstHandler;
    const browser = await register("persistent@example.org");
    const freshHandler = createMultiUserRelayHttpHandler(secondApplication, new AccountStore(database, roleAccess, () => now), config, roles);
    handler = freshHandler;
    expect((await call("/session", undefined, browser)).body.authenticated).toBe(true);
    now = new Date(now.getTime() + 8 * 60 * 60 * 1_000 + 1);
    expect((await call("/session", undefined, browser)).body).toEqual({ authenticated: false });
  });

  test("logs out without interpreting proxy-added or caller-supplied request bodies", async () => {
    const browser = await register("logout-contract@example.org");
    expect((await call("/session/logout", { ignored: "proxy-shape" }, browser)).status).toBe(200);
    expect((await call("/session", undefined, browser)).body).toEqual({ authenticated: false });
  });

  test("rejects wrong credentials, foreign invitation emails, missing CSRF, and cross-origin requests", async () => {
    const officer = await register("security@example.org");
    await call("/workspaces/create", { name: "Security Club" }, officer);
    const invite = await call("/invitations/create", { email: "intended@example.org" }, officer);
    const wrong = await register("wrong@example.org");
    expect((await call("/invitations/accept", { token: invite.body.token }, wrong)).status).toBe(404);
    expect((await call("/auth/login", { email: "security@example.org", password: "wrong password" })).status).toBe(401);
    const noCsrf = await handler(new Request("http://127.0.0.1/api/workspaces/procedures", { method: "POST", headers: { origin, cookie: officer.cookie, "content-type": "application/json" }, body: "{}" }));
    expect(noCsrf.status).toBe(403);
    const crossOrigin = await handler(new Request("http://127.0.0.1/session", { headers: { origin: "https://attacker.example", cookie: officer.cookie } }));
    expect(crossOrigin.status).toBe(403);
  });
});
