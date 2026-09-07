<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { computed, inject } from "vue";
import { decomposerContextKey } from "../context.js";
/** Host contribution: Ψ.NL nodeがactiveのときだけ右paneへ出るdecomposer route設定。 */
const context = inject(decomposerContextKey);
const selectedRoute = computed(() => context?.routes.value.find((route) => route.provider === context.provider.value));
</script>
<template>
  <section v-if="context" class="controls" aria-label="route controls (inspector)">
    <label>Provider
      <select v-model="context.provider.value">
        <option v-for="route in context.routes.value" :key="route.provider" :value="route.provider" :disabled="!route.available">{{ route.label }}{{ route.available ? "" : " — unavailable" }}</option>
      </select>
    </label>
    <label>Model
      <select v-model="context.model.value"><option v-for="candidate in selectedRoute?.models ?? []" :key="candidate" :value="candidate">{{ candidate }}</option></select>
    </label>
    <p class="route-note">route: {{ context.provider.value }} / {{ context.model.value }}<template v-if="selectedRoute?.credentialName"> / credential: {{ selectedRoute.credentialName }}</template><template v-if="selectedRoute?.reason"> / {{ selectedRoute.reason }}</template></p>
    <label class="source">Natural language source<textarea v-model="context.source.value" rows="6" /></label>
    <button type="button" :disabled="context.running.value || !selectedRoute?.available || !context.model.value || !context.source.value.trim()" @click="context.execute()">{{ context.running.value ? "推論中…" : "自然言語をFAMへ分解" }}</button>
  </section>
</template>
