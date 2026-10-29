<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { IssuedInvitation, PendingInvitation, WorkspaceMember, WorkspaceMembership } from "../api.ts";
import { hasMeaningfulDraft } from "../unsaved-work.ts";

const props = defineProps<{
  workspace: string;
  workspaceName: string;
  role: string;
  user?: { id: string; email: string; name: string };
  workspaces: WorkspaceMembership[];
  members: WorkspaceMember[];
  pendingInvitations: PendingInvitation[];
  canInvite: boolean;
  createdInvite?: IssuedInvitation;
  actionBusy: string;
  ownershipConfigured: boolean;
}>();
const emit = defineEmits<{
  createClub: [payload: { name: string; onSuccess: () => void }];
  joinClub: [payload: { token: string; onSuccess: () => void }];
  invite: [payload: { email: string; onSuccess: () => void }];
  reissue: [invitation: PendingInvitation];
  select: [workspace: string];
  claimOwnership: [];
  changeRole: [payload: { member: WorkspaceMember; role: "Officer" | "Member" }];
  removeMember: [member: WorkspaceMember];
  transferOwnership: [payload: { member: WorkspaceMember; formerOwnerRole: "Officer" | "Member"; onSuccess: () => void }];
  renameWorkspace: [payload: { name: string; onSuccess: () => void }];
  archiveWorkspace: [];
  restoreWorkspace: [workspace: WorkspaceMembership];
  deleteWorkspace: [workspace: WorkspaceMembership];
  dirtyChange: [dirty: boolean];
}>();
const inviteEmail = ref("");
const newClubName = ref("");
const invitationToken = ref("");
const showCreateClub = ref(false);
const showJoinClub = ref(false);
const showInviteForm = ref(false);
const copyStatus = ref("");
const transferTarget = ref("");
const formerOwnerRole = ref<"Officer" | "Member">("Officer");
const transferConfirmed = ref(false);
const editingWorkspaceName = ref(false);
const workspaceNameDraft = ref("");
const openAdminSection = ref<"rename" | "transfer" | "archive" | "">("");
const transferableMembers = computed(() => props.members.filter((member) => member.user !== props.user?.id));
const activeWorkspaces = computed(() => props.workspaces.filter(({ status }) => status === "ACTIVE"));
const otherActiveWorkspaces = computed(() => activeWorkspaces.value.filter(({ workspace }) => workspace !== props.workspace));
const archivedWorkspaces = computed(() => props.workspaces.filter(({ status }) => status === "ARCHIVED"));
const hasUnsavedWork = computed(() => hasMeaningfulDraft([inviteEmail.value, newClubName.value, invitationToken.value]) ||
  (editingWorkspaceName.value && workspaceNameDraft.value.trim() !== props.workspaceName) || !!transferTarget.value || transferConfirmed.value);

watch(() => props.createdInvite?.token, () => { copyStatus.value = ""; });
watch(() => props.workspaceName, (name) => { if (!editingWorkspaceName.value) workspaceNameDraft.value = name; }, { immediate: true });
watch(hasUnsavedWork, (dirty) => emit("dirtyChange", dirty), { immediate: true });
onUnmounted(() => emit("dirtyChange", false));

function invite() {
  const email = inviteEmail.value.trim(); if (!email) return;
  emit("invite", { email, onSuccess: () => { inviteEmail.value = ""; } });
}

function createClub() {
  const name = newClubName.value.trim(); if (!name) return;
  emit("createClub", { name, onSuccess: () => { newClubName.value = ""; showCreateClub.value = false; } });
}

function joinClub() {
  const token = invitationToken.value.trim(); if (!token) return;
  emit("joinClub", { token, onSuccess: () => { invitationToken.value = ""; showJoinClub.value = false; } });
}

function toggleCreateClub() {
  showCreateClub.value = !showCreateClub.value;
  if (showCreateClub.value) showJoinClub.value = false;
}

function toggleJoinClub() {
  showJoinClub.value = !showJoinClub.value;
  if (showJoinClub.value) showCreateClub.value = false;
}

function toggleInviteForm() {
  showInviteForm.value = !showInviteForm.value;
}

async function copyCode() {
  if (!props.createdInvite) return;
  try {
    await navigator.clipboard.writeText(props.createdInvite.token);
    copyStatus.value = "Copied";
  } catch {
    copyStatus.value = "Select and copy the code manually";
  }
}

function formatExpiry(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function canManage(member: WorkspaceMember): boolean {
  if (member.user === props.user?.id || member.role === "Owner") return false;
  return props.role === "Owner" || (props.role === "Officer" && member.role === "Member");
}

function transfer() {
  const member = transferableMembers.value.find(({ user }) => user === transferTarget.value);
  if (!member || !transferConfirmed.value) return;
  emit("transferOwnership", {
    member,
    formerOwnerRole: formerOwnerRole.value,
    onSuccess: () => { transferTarget.value = ""; transferConfirmed.value = false; formerOwnerRole.value = "Officer"; },
  });
}

function beginWorkspaceRename() {
  workspaceNameDraft.value = props.workspaceName;
  editingWorkspaceName.value = true;
}

function renameWorkspace() {
  const name = workspaceNameDraft.value.trim();
  if (!name || name === props.workspaceName) return;
  emit("renameWorkspace", { name, onSuccess: () => { editingWorkspaceName.value = false; } });
}

function cancelWorkspaceRename() {
  workspaceNameDraft.value = props.workspaceName;
  editingWorkspaceName.value = false;
}

function toggleAdminSection(section: "rename" | "transfer" | "archive", event: Event) {
  event.preventDefault();
  if (openAdminSection.value === section) {
    openAdminSection.value = "";
    if (section === "rename") cancelWorkspaceRename();
    return;
  }
  openAdminSection.value = section;
  if (section === "rename") {
    workspaceNameDraft.value = props.workspaceName;
    editingWorkspaceName.value = true;
  }
}
</script>

<template>
  <header class="page-heading"><h1>Workspace</h1></header>

  <section class="workspace-identity" aria-labelledby="club-name">
    <div class="workspace-identity-copy"><h2 id="club-name">{{ workspaceName }}</h2><p>{{ user?.name }}</p></div>
    <span class="role-chip" :class="`role-chip-${role.toLowerCase()}`">{{ role }}</span>
  </section>

  <section class="workspace-settings-section workspace-access" aria-labelledby="your-clubs-title">
    <header class="workspace-section-header compact-header">
      <h2 id="your-clubs-title">{{ otherActiveWorkspaces.length ? "Switch club" : "Your clubs" }}</h2>
      <div class="header-actions">
        <button class="link-action" type="button" :disabled="!!actionBusy" :aria-expanded="showCreateClub" aria-controls="create-club-form" @click="toggleCreateClub">Create club</button>
        <button class="link-action" type="button" :disabled="!!actionBusy" :aria-expanded="showJoinClub" aria-controls="join-club-form" @click="toggleJoinClub">Join club</button>
      </div>
    </header>

    <form v-if="showCreateClub" id="create-club-form" class="workspace-access-form disclosure-form" @submit.prevent="createClub">
      <label for="additional-club-name">Club name</label>
      <div class="form-row"><input id="additional-club-name" v-model="newClubName" required maxlength="120" placeholder="Robotics Club"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !newClubName.trim()">{{ actionBusy === "create-workspace" ? "Creating…" : "Create as Owner" }}</button></div>
    </form>

    <form v-if="showJoinClub" id="join-club-form" class="workspace-access-form disclosure-form" @submit.prevent="joinClub">
      <label for="additional-invite-token">One-time invitation code</label>
      <div class="form-row"><input id="additional-invite-token" v-model="invitationToken" required maxlength="64" spellcheck="false" autocomplete="off"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !invitationToken.trim()">{{ actionBusy === "accept-invitation" ? "Joining…" : "Join as Member" }}</button></div>
    </form>

    <div v-if="otherActiveWorkspaces.length" class="club-switch-list" aria-label="Other clubs">
      <div v-for="club in otherActiveWorkspaces" :key="club.workspace" class="club-switch-row">
        <div><strong>{{ club.name }}</strong><small>{{ club.role }}</small></div>
        <button class="role-toggle-btn" type="button" :disabled="!!actionBusy" :aria-label="`Switch to ${club.name}`" @click="emit('select', club.workspace)">{{ actionBusy === "select-workspace" ? "Switching…" : "Switch" }}</button>
      </div>
    </div>
    <div v-if="archivedWorkspaces.length" class="archived-workspace-list">
      <h3>Archived workspaces</h3>
      <p>Restore a workspace to recover it. Permanent deletion removes all of its data and cannot be undone.</p>
      <div v-for="club in archivedWorkspaces" :key="club.workspace" class="club-switch-row archived-workspace-row">
        <div><strong>{{ club.name }}</strong><small>Archived · {{ club.role }}</small></div>
        <div class="workspace-management-actions"><button class="role-toggle-btn" type="button" :disabled="!!actionBusy" @click="emit('restoreWorkspace', club)">{{ actionBusy === `restore-workspace-${club.workspace}` ? "Restoring…" : "Restore" }}</button><button class="icon-x-btn" type="button" :disabled="!!actionBusy" aria-label="Delete workspace forever" :title="`Delete ${club.name} forever`" @click="emit('deleteWorkspace', club)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button></div>
      </div>
    </div>
  </section>

  <section class="workspace-settings-section" aria-labelledby="members-title">
    <header class="workspace-section-header compact-header">
      <div class="section-title-row"><h2 id="members-title">Members</h2><span class="section-count">{{ members.length }}</span></div>
      <button v-if="canInvite" class="link-action" type="button" :disabled="!!actionBusy" :aria-expanded="showInviteForm" aria-controls="inline-invite-form" @click="toggleInviteForm">{{ showInviteForm ? "Close" : "Invite member" }}</button>
    </header>

    <form v-if="canInvite && showInviteForm" id="inline-invite-form" class="workspace-access-form disclosure-form" @submit.prevent="invite">
      <label for="workspace-invite-email">Member email</label>
      <div class="form-row"><input id="workspace-invite-email" v-model="inviteEmail" type="email" required maxlength="254" placeholder="member@example.org"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !inviteEmail.trim()">{{ actionBusy === "invite-member" ? "Generating…" : "Generate invite code" }}</button></div>
      <p class="form-hint">Relay doesn't send email. Generate a one-time code and share it with the invitee.</p>
      <output v-if="createdInvite" class="invite-output">
        <span>{{ createdInvite.reissued ? `Replacement code for ${createdInvite.email}` : `Code for ${createdInvite.email}` }}</span>
        <div class="invite-code-row"><strong class="invite-code">{{ createdInvite.token }}</strong><button class="button button-small button-secondary" type="button" @click="copyCode">Copy</button></div>
        <small>{{ createdInvite.reissued ? "This replaces the previous code." : "Share it securely. It works once for this email." }} Expires {{ formatExpiry(createdInvite.expiresAt) }}.</small>
        <small v-if="copyStatus" role="status">{{ copyStatus }}</small>
      </output>
    </form>

    <div class="management-list">
      <div v-for="member in members" :key="member.user" class="management-row">
        <div class="management-row-copy"><strong>{{ member.name }}</strong><small v-if="member.email">{{ member.email }}</small></div>
        <div class="member-actions">
          <span class="role-chip" :class="`role-chip-${member.role.toLowerCase()}`">{{ member.role }}</span>
          <details v-if="canManage(member)" class="manage-menu">
            <summary aria-label="Manage member">Manage</summary>
            <div class="manage-menu-items">
              <button v-if="member.role === 'Member'" class="manage-menu-item" type="button" :disabled="!!actionBusy" @click="emit('changeRole', { member, role: 'Officer' })">{{ actionBusy === `role-${member.user}` ? "Updating…" : "Change role to Officer" }}</button>
              <button v-if="role === 'Owner' && member.role === 'Officer'" class="manage-menu-item" type="button" :disabled="!!actionBusy" @click="emit('changeRole', { member, role: 'Member' })">{{ actionBusy === `role-${member.user}` ? "Updating…" : "Change role to Member" }}</button>
              <button class="manage-menu-item danger-text" type="button" :disabled="!!actionBusy" @click="emit('removeMember', member)">{{ actionBusy === `remove-member-${member.user}` ? "Removing…" : "Remove member" }}</button>
            </div>
          </details>
        </div>
      </div>
    </div>
    <p v-if="canInvite && !pendingInvitations.length" class="members-invite-hint">No pending invitations.</p>
  </section>

  <section v-if="!ownershipConfigured && role === 'Officer'" class="workspace-settings-section ownership-setup" aria-labelledby="ownership-setup-title">
    <h2 id="ownership-setup-title">Set workspace owner</h2>
    <p>This older workspace has no recorded Owner. Claim ownership to enable role management. Relay will not choose an Owner automatically.</p>
    <button class="button button-primary" type="button" :disabled="!!actionBusy" @click="emit('claimOwnership')">{{ actionBusy === "claim-ownership" ? "Claiming…" : "Claim ownership" }}</button>
  </section>

  <section v-if="canInvite && pendingInvitations.length" class="workspace-settings-section" aria-labelledby="pending-invitations-title">
    <header class="workspace-section-header compact-header">
      <div class="section-title-row"><h2 id="pending-invitations-title">Pending invitations</h2><span class="section-count">{{ pendingInvitations.length }}</span></div>
    </header>
    <div class="management-list">
      <div v-for="invitation in pendingInvitations" :key="invitation.invitation" class="management-row invitation-row">
        <div><strong>{{ invitation.email }}</strong><small>Pending · Expires {{ formatExpiry(invitation.expiresAt) }}</small></div>
        <button class="role-toggle-btn" type="button" :disabled="!!actionBusy" @click="emit('reissue', invitation)">{{ actionBusy === `reissue-invitation-${invitation.invitation}` ? "Reissuing…" : "Reissue code" }}</button>
      </div>
    </div>
  </section>

  <details v-if="role === 'Owner'" class="workspace-administration quiet-history">
    <summary><span class="admin-summary-chevron" aria-hidden="true"></span>Advanced workspace management</summary>
    <div class="workspace-administration-content">
      <details class="administrative-disclosure" :open="openAdminSection === 'rename'" @toggle="($event.target as HTMLDetailsElement).open ? openAdminSection = 'rename' : openAdminSection === 'rename' && (openAdminSection = '')">
        <summary @click="toggleAdminSection('rename', $event)"><span class="admin-summary-chevron" aria-hidden="true"></span>Rename workspace</summary>
        <div class="admin-section-body">
          <form class="admin-stacked-form" @submit.prevent="renameWorkspace">
            <label for="workspace-name-edit">Workspace name</label>
            <input id="workspace-name-edit" v-model="workspaceNameDraft" required maxlength="120" class="admin-stacked-input">
            <div class="admin-stacked-actions"><button class="role-toggle-btn" type="submit" :disabled="!!actionBusy || !workspaceNameDraft.trim() || workspaceNameDraft.trim() === workspaceName">{{ actionBusy === "rename-workspace" ? "Renaming…" : "Save" }}</button><button class="link-action" type="button" :disabled="!!actionBusy" @click="cancelWorkspaceRename(); openAdminSection = ''">Cancel</button></div>
          </form>
        </div>
      </details>
      <details v-if="transferableMembers.length" class="administrative-disclosure" :open="openAdminSection === 'transfer'" @toggle="($event.target as HTMLDetailsElement).open ? openAdminSection = 'transfer' : openAdminSection === 'transfer' && (openAdminSection = '')">
        <summary @click="toggleAdminSection('transfer', $event)"><span class="admin-summary-chevron" aria-hidden="true"></span>Transfer ownership</summary>
        <div class="admin-section-body">
          <p>The selected member becomes the only Owner. Choose the role you will keep.</p>
          <form class="admin-stacked-form" @submit.prevent="transfer">
            <label for="new-owner">New Owner</label>
            <select id="new-owner" v-model="transferTarget" required :disabled="!!actionBusy" class="admin-stacked-input"><option value="" disabled>Select a member</option><option v-for="member in transferableMembers" :key="member.user" :value="member.user">{{ member.name }} · {{ member.role }}</option></select>
            <label for="former-owner-role">Your role after transfer</label>
            <select id="former-owner-role" v-model="formerOwnerRole" :disabled="!!actionBusy" class="admin-stacked-input"><option value="Officer">Officer</option><option value="Member">Member</option></select>
            <label class="confirmation-check"><input v-model="transferConfirmed" type="checkbox" :disabled="!!actionBusy"><span>I understand that only the new Owner can transfer ownership again.</span></label>
            <div class="admin-stacked-actions"><button class="role-toggle-btn" type="submit" :disabled="!!actionBusy || !transferTarget || !transferConfirmed">{{ actionBusy === "transfer-ownership" ? "Transferring…" : "Transfer ownership" }}</button></div>
          </form>
        </div>
      </details>
      <details class="administrative-disclosure" :open="openAdminSection === 'archive'" @toggle="($event.target as HTMLDetailsElement).open ? openAdminSection = 'archive' : openAdminSection === 'archive' && (openAdminSection = '')">
        <summary @click="toggleAdminSection('archive', $event)"><span class="admin-summary-chevron" aria-hidden="true"></span>Archive workspace</summary>
        <div class="admin-section-body">
          <p>Hide this workspace from every member while keeping its knowledge recoverable.</p>
          <div class="admin-stacked-actions"><button class="role-toggle-btn danger-text" type="button" :disabled="!!actionBusy" @click="emit('archiveWorkspace')">{{ actionBusy === "archive-workspace" ? "Archiving…" : "Archive workspace" }}</button></div>
        </div>
      </details>
    </div>
  </details>

</template>
