<script setup lang="ts">
import { ref } from "vue";
import type { WorkspaceMembership } from "../api.ts";

defineProps<{ workspace: string; workspaceName: string; role: string; user?: { id: string; email: string; name: string }; workspaces: WorkspaceMembership[]; canInvite: boolean; createdInvite: string; actionBusy: string }>();
const emit = defineEmits<{ invite: [payload: { email: string; onSuccess: () => void }]; select: [workspace: string] }>();
const inviteEmail = ref("");
function invite() {
  const email = inviteEmail.value.trim(); if (!email) return;
  emit("invite", { email, onSuccess: () => { inviteEmail.value = ""; } });
}
</script>

<template>
  <header class="page-heading"><h1>Workspace</h1><p class="page-intro">Membership, invitations, and the club currently in view.</p></header>
  <section class="workspace-settings-section"><h2>Current club</h2><dl class="workspace-facts"><div><dt>Name</dt><dd>{{ workspaceName }}</dd></div><div><dt>Your role</dt><dd>{{ role }}</dd></div><div><dt>Signed in as</dt><dd>{{ user?.name }} <small>{{ user?.email }}</small></dd></div></dl></section>
  <section v-if="workspaces.length > 1" class="workspace-settings-section"><h2>Your clubs</h2><div class="editorial-list"><button v-for="club in workspaces" :key="club.workspace" type="button" :aria-current="club.workspace === workspace ? 'true' : undefined" :disabled="!!actionBusy || club.workspace === workspace" @click="emit('select', club.workspace)"><strong>{{ club.name }}</strong><span>{{ club.role }}{{ club.workspace === workspace ? " · Current" : "" }}</span></button></div></section>
  <section v-if="canInvite" class="workspace-settings-section"><h2>Invite a member</h2><p>Invitation codes are one-time and tied to the email address entered here. Relay does not send email.</p><form class="invite-form" @submit.prevent="invite"><label for="workspace-invite-email">Member email</label><div class="form-row"><input id="workspace-invite-email" v-model="inviteEmail" type="email" required maxlength="254" placeholder="member@example.org"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !inviteEmail.trim()">{{ actionBusy === "invite-member" ? "Creating…" : "Create invite code" }}</button></div></form><output v-if="createdInvite" class="invite-output"><span>Share this code securely</span><strong class="invite-code">{{ createdInvite }}</strong><small>It can be accepted once by the invited email address.</small></output></section>
</template>
