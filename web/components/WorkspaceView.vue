<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { IssuedInvitation, PendingInvitation, WorkspaceMember, WorkspaceMembership } from "../api.ts";

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
  invite: [payload: { email: string; onSuccess: () => void }];
  reissue: [invitation: PendingInvitation];
  select: [workspace: string];
  claimOwnership: [];
  changeRole: [payload: { member: WorkspaceMember; role: "Officer" | "Member" }];
  removeMember: [member: WorkspaceMember];
  transferOwnership: [payload: { member: WorkspaceMember; formerOwnerRole: "Officer" | "Member"; onSuccess: () => void }];
}>();
const inviteEmail = ref("");
const copyStatus = ref("");
const transferTarget = ref("");
const formerOwnerRole = ref<"Officer" | "Member">("Officer");
const transferConfirmed = ref(false);
const transferableMembers = computed(() => props.members.filter((member) => member.user !== props.user?.id));

watch(() => props.createdInvite?.token, () => { copyStatus.value = ""; });

function invite() {
  const email = inviteEmail.value.trim(); if (!email) return;
  emit("invite", { email, onSuccess: () => { inviteEmail.value = ""; } });
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
</script>

<template>
  <header class="page-heading"><h1>Workspace</h1></header>

  <section class="workspace-identity" aria-labelledby="club-name">
    <div><h2 id="club-name">{{ workspaceName }}</h2><p>{{ user?.name }}</p></div>
    <span>{{ role }}</span>
  </section>

  <section class="workspace-settings-section" aria-labelledby="members-title">
    <header class="workspace-section-header"><h2 id="members-title">Members</h2><span>{{ members.length }}</span></header>
    <div class="management-list">
      <div v-for="member in members" :key="member.user" class="management-row">
        <div><strong>{{ member.name }}</strong><small v-if="member.email">{{ member.email }}</small></div>
        <div class="member-actions">
          <span>{{ member.role }}</span>
          <template v-if="canManage(member)">
            <button v-if="member.role === 'Member'" class="button button-small button-quiet" type="button" :disabled="!!actionBusy" :aria-label="`Promote ${member.name} to Officer`" @click="emit('changeRole', { member, role: 'Officer' })">Make Officer</button>
            <button v-if="role === 'Owner' && member.role === 'Officer'" class="button button-small button-quiet" type="button" :disabled="!!actionBusy" :aria-label="`Demote ${member.name} to Member`" @click="emit('changeRole', { member, role: 'Member' })">Make Member</button>
            <button class="button button-small button-quiet danger-text" type="button" :disabled="!!actionBusy" :aria-label="`Remove ${member.name} from workspace`" @click="emit('removeMember', member)">Remove</button>
          </template>
        </div>
      </div>
    </div>
  </section>

  <section v-if="!ownershipConfigured && role === 'Officer'" class="workspace-settings-section ownership-setup" aria-labelledby="ownership-setup-title">
    <h2 id="ownership-setup-title">Set workspace owner</h2>
    <p>This older workspace has no recorded Owner. Claim ownership to enable role management. Relay will not choose an Owner automatically.</p>
    <button class="button button-primary" type="button" :disabled="!!actionBusy" @click="emit('claimOwnership')">Claim ownership</button>
  </section>

  <section v-if="role === 'Owner' && transferableMembers.length" class="workspace-settings-section" aria-labelledby="transfer-title">
    <h2 id="transfer-title">Transfer ownership</h2>
    <p>The selected member becomes the only Owner. Choose the role you will keep.</p>
    <form class="ownership-transfer-form" @submit.prevent="transfer">
      <label for="new-owner">New Owner</label>
      <select id="new-owner" v-model="transferTarget" required :disabled="!!actionBusy"><option value="" disabled>Select a member</option><option v-for="member in transferableMembers" :key="member.user" :value="member.user">{{ member.name }} · {{ member.role }}</option></select>
      <label for="former-owner-role">Your role after transfer</label>
      <select id="former-owner-role" v-model="formerOwnerRole" :disabled="!!actionBusy"><option value="Officer">Officer</option><option value="Member">Member</option></select>
      <label class="confirmation-check"><input v-model="transferConfirmed" type="checkbox" :disabled="!!actionBusy"> I understand that only the new Owner can transfer ownership again.</label>
      <button class="button button-primary" type="submit" :disabled="!!actionBusy || !transferTarget || !transferConfirmed">Transfer ownership</button>
    </form>
  </section>

  <section v-if="canInvite" class="workspace-settings-section" aria-labelledby="pending-invitations-title">
    <header class="workspace-section-header"><h2 id="pending-invitations-title">Pending invitations</h2><span>{{ pendingInvitations.length }}</span></header>
    <p v-if="!pendingInvitations.length" class="quiet-empty">None pending.</p>
    <div v-else class="management-list">
      <div v-for="invitation in pendingInvitations" :key="invitation.invitation" class="management-row invitation-row">
        <div><strong>{{ invitation.email }}</strong><small>Pending · Expires {{ formatExpiry(invitation.expiresAt) }}</small></div>
        <button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="emit('reissue', invitation)">{{ actionBusy === `reissue-invitation-${invitation.invitation}` ? "Reissuing…" : "Reissue code" }}</button>
      </div>
    </div>
  </section>

  <section v-if="canInvite" class="workspace-settings-section" aria-labelledby="invite-member-title">
    <h2 id="invite-member-title">Invite a member</h2>
    <form class="invite-form" @submit.prevent="invite"><label for="workspace-invite-email">Email</label><div class="form-row"><input id="workspace-invite-email" v-model="inviteEmail" type="email" required maxlength="254" placeholder="member@example.org"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !inviteEmail.trim()">{{ actionBusy === "invite-member" ? "Creating…" : "Create code" }}</button></div></form>
    <output v-if="createdInvite" class="invite-output">
      <span>{{ createdInvite.reissued ? `Replacement code for ${createdInvite.email}` : `Code for ${createdInvite.email}` }}</span>
      <div class="invite-code-row"><strong class="invite-code">{{ createdInvite.token }}</strong><button class="button button-small button-secondary" type="button" @click="copyCode">Copy</button></div>
      <small>{{ createdInvite.reissued ? "This replaces the previous code." : "Share it securely. It works once for this email." }} Expires {{ formatExpiry(createdInvite.expiresAt) }}.</small>
      <small v-if="copyStatus" role="status">{{ copyStatus }}</small>
    </output>
  </section>

  <section v-if="workspaces.length > 1" class="workspace-settings-section" aria-labelledby="other-clubs-title">
    <h2 id="other-clubs-title">Other clubs</h2>
    <div class="editorial-list"><button v-for="club in workspaces.filter(({ workspace: id }) => id !== workspace)" :key="club.workspace" type="button" :disabled="!!actionBusy" @click="emit('select', club.workspace)"><strong>{{ club.name }}</strong><span>{{ club.role }}</span></button></div>
  </section>
</template>
