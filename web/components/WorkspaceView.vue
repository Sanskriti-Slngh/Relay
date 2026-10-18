<script setup lang="ts">
import { ref, watch } from "vue";
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
}>();
const emit = defineEmits<{
  invite: [payload: { email: string; onSuccess: () => void }];
  reissue: [invitation: PendingInvitation];
  select: [workspace: string];
}>();
const inviteEmail = ref("");
const copyStatus = ref("");

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
        <span>{{ member.role }}</span>
      </div>
    </div>
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
