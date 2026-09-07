<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { inject } from "vue";
import { playgroundPaneContextKey } from "../context.js";
const host = inject(playgroundPaneContextKey);
</script>
<template>
  <div v-if="host" class="session-receipt">
    <section v-if="host.editReceipts.value.length" aria-label="fam edit receipts">
      <h2>FAM edit receipts</h2>
      <ul>
        <li v-for="(receipt, index) in host.editReceipts.value" :key="index" :data-edit-status="receipt.status">
          <strong>{{ receipt.status }}</strong> ops={{ receipt.appliedOperations }} touched={{ receipt.touchedPaths.join(", ") || "-" }} retained={{ receipt.retainedUntouchedPaths }}
          <span v-if="receipt.validation"> validator={{ receipt.validation.valid ? "valid" : `${receipt.validation.issueCount} issue(s)` }}</span>
          <span v-if="receipt.rejectedOperation"> — {{ receipt.rejectedOperation.reason }}</span>
          <span v-if="receipt.loss.length"> loss={{ receipt.loss.map((entry) => entry.kind).join(",") }}</span>
        </li>
      </ul>
    </section>
    <section aria-label="session decisions">
      <h2>Session decisions</h2>
      <ul>
        <li v-for="decision in host.sessionState.value.decisions" :key="decision.requestId" :data-decision-status="decision.status">
          <code>{{ decision.kind }}</code> {{ decision.requestId }} → <strong>{{ decision.status }}</strong><span v-if="decision.reason"> — {{ decision.reason }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
