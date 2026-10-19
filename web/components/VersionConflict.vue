<script setup lang="ts">
withDefaults(defineProps<{
  subject: string;
  savedValue: string;
  draftValue: string;
  savedLabel?: string;
  draftLabel?: string;
  useSavedLabel?: string;
  saveMineLabel?: string;
  canSaveMine?: boolean;
  explanation?: string;
  saveConsequence?: string;
  busy?: boolean;
}>(), {
  savedLabel: "Saved version",
  draftLabel: "Your unsaved version",
  useSavedLabel: "Use saved version",
  saveMineLabel: "Save my version",
  canSaveMine: true,
  explanation: "",
  saveConsequence: "Saving your version will replace the saved text shown above if it has not changed again.",
  busy: false,
});

defineEmits<{ useSaved: []; saveMine: [] }>();
</script>

<template>
  <aside class="version-conflict" role="alert" aria-live="polite">
    <div class="version-conflict-heading">
      <strong>This {{ subject }} changed while you were editing</strong>
      <p>Someone else saved a newer version. Your work is still here.</p>
    </div>
    <div class="version-comparison">
      <div><span>{{ savedLabel }}</span><p>{{ savedValue }}</p></div>
      <div><span>{{ draftLabel }}</span><p>{{ draftValue }}</p></div>
    </div>
    <p v-if="explanation" class="version-conflict-explanation">{{ explanation }}</p>
    <div class="version-conflict-actions">
      <button class="button button-small button-secondary" type="button" :disabled="busy" @click="$emit('useSaved')">{{ useSavedLabel }}</button>
      <button v-if="canSaveMine" class="button button-small button-primary" type="button" :disabled="busy" @click="$emit('saveMine')">{{ saveMineLabel }}</button>
    </div>
    <p class="version-conflict-caveat">Choosing <strong>{{ useSavedLabel }}</strong> discards only your local draft. <template v-if="canSaveMine">{{ saveConsequence }} Relay checks again first, so a newer change will not be overwritten.</template></p>
  </aside>
</template>
