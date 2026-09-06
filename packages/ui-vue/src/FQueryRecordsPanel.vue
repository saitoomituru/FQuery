<script setup lang="ts">
defineProps<{
  fam?: unknown;
  semanticProjection?: unknown;
  famLog?: unknown;
  providerReceipt?: unknown;
  debugEvents?: unknown;
}>();
</script>

<template>
  <section class="fquery-records" aria-label="FQuery records">
    <article class="fquery-record" data-record-kind="fam">
      <h2>FAM</h2>
      <pre v-if="fam">{{ JSON.stringify(fam, null, 2) }}</pre>
      <p v-else>NOT IMPLEMENTED / 未生成</p>
    </article>
    <article class="fquery-record" data-record-kind="semantic-projection">
      <h2>Semantic block projection</h2>
      <pre v-if="semanticProjection">{{ JSON.stringify(semanticProjection, null, 2) }}</pre>
      <p v-else>未生成</p>
    </article>
    <article class="fquery-record" data-record-kind="famlog">
      <h2>FAMLog</h2>
      <pre v-if="famLog">{{ JSON.stringify(famLog, null, 2) }}</pre>
      <p v-else>NOT PROVIDED</p>
    </article>
    <article class="fquery-record" data-record-kind="provider-receipt">
      <h2>Provider receipt</h2>
      <pre v-if="providerReceipt">{{ JSON.stringify(providerReceipt, null, 2) }}</pre>
      <p v-else>NOT PROVIDED</p>
    </article>
    <article class="fquery-record" data-record-kind="debug-event">
      <h2>Debug event</h2>
      <pre v-if="debugEvents">{{ JSON.stringify(debugEvents, null, 2) }}</pre>
      <p v-else>NOT PROVIDED</p>
    </article>
  </section>
</template>

<style scoped>
.fquery-records { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.75rem; padding: 1rem; }
.fquery-record { min-width: 0; padding: 0.8rem; color: #c9d5ed; background: #111724; border: 1px solid #34405a; border-radius: 0.6rem; }
.fquery-record h2 { margin: 0 0 0.6rem; font-size: 0.9rem; color: #79c0ff; }
.fquery-record p { color: #aeb8cc; }
.fquery-record pre { max-height: 24rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.75rem; }
</style>
