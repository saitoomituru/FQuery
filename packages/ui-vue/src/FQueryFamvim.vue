<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GuiEventAbi } from "@fquery/ui-core";
import {
  diffJson,
  getAtPointer,
  openFamText,
  partitionPointers,
  patchFromDiff,
  renderPointerLines,
  serializeFamValue,
  type FamValidator,
  type JsonValue,
} from "@fquery/fam-edit";

/**
 * ∇φ.FAMVIM — universal RAW FAM editor。
 * canonical FAMを直接表示・編集する最低限の正規GUIであり、debug viewerではない。
 * 編集はModelを書かず、property.change.requestedをemitするだけ。
 */
const props = defineProps<{
  targetRef: string;
  value?: unknown;
  text?: string | undefined;
  validate?: FamValidator | undefined;
  knownPointers?: readonly string[] | undefined;
  jumpTo?: string | null | undefined;
}>();
const emit = defineEmits<{ event: [event: GuiEventAbi] }>();

let requestSequence = 0;
const editor = ref<HTMLTextAreaElement>();
const selectedPointer = ref<string>("");

const canonicalText = computed(() => props.text ?? (props.value === undefined ? "" : serializeFamValue(props.value as JsonValue)));
const canonical = computed(() => canonicalText.value ? openFamText(canonicalText.value) : undefined);
const draft = ref(canonicalText.value);
watch(canonicalText, (next) => { draft.value = next; });

const draftDocument = computed(() => draft.value ? openFamText(draft.value) : undefined);
const dirty = computed(() => draft.value !== canonicalText.value);
const diff = computed(() => canonical.value?.parse === "parsed" && draftDocument.value?.parse === "parsed" ? diffJson(canonical.value.value, draftDocument.value.value) : []);
const validation = computed(() => props.validate && draftDocument.value?.parse === "parsed" ? props.validate(draftDocument.value.value) : undefined);
const render = computed(() => canonical.value?.parse === "parsed" ? renderPointerLines(canonical.value.value) : undefined);
const partition = computed(() => canonical.value?.parse === "parsed" && props.knownPointers ? partitionPointers(canonical.value.value, props.knownPointers) : undefined);
const unsupported = computed(() => new Set(partition.value?.unsupported ?? []));
const authority = computed(() => {
  if (canonical.value?.parse !== "parsed") return undefined;
  const value = canonical.value.value;
  return { famId: getAtPointer(value, "/fam_id"), revisionId: getAtPointer(value, "/revision_id"), schemaVersion: getAtPointer(value, "/schema_version"), provenance: getAtPointer(value, "/provenance") };
});
const canApply = computed(() => dirty.value && draftDocument.value !== undefined && canonical.value !== undefined);

watch(() => props.jumpTo, (pointer) => { if (pointer) select(pointer); }, { immediate: true });

function select(pointer: string) {
  selectedPointer.value = pointer;
  const line = render.value?.lines.find((entry) => entry.pointer === pointer)?.line;
  const element = editor.value;
  if (line === undefined || !element || dirty.value) return;
  const offset = draft.value.split("\n").slice(0, line).reduce((total, current) => total + current.length + 1, 0);
  const lineLength = draft.value.split("\n")[line]?.length ?? 0;
  element.focus();
  element.setSelectionRange(offset, offset + lineLength);
}

function apply() {
  if (!canApply.value || !draftDocument.value) return;
  requestSequence += 1;
  const requestId = `ui:famvim:${requestSequence}`;
  if (draftDocument.value.parse === "parsed" && canonical.value?.parse === "parsed") {
    emit("event", { type: "property.change.requested", requestId, targetRef: props.targetRef, property: "fam.patch", value: patchFromDiff(diff.value) });
    return;
  }
  // malformed draftは失わず、RAW置換requestとしてHostへ渡す。採否と loss receipt はHostが決める。
  emit("event", { type: "property.change.requested", requestId, targetRef: props.targetRef, property: "fam.text", value: draft.value });
}

function discard() { draft.value = canonicalText.value; }

async function copyCanonical() {
  if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(canonicalText.value);
}

function describe(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
</script>

<template>
  <section class="fquery-famvim" :data-target-ref="targetRef" aria-label="FAMVIM RAW FAM editor">
    <header class="fquery-famvim-header">
      <h3>∇φ.FAMVIM</h3>
      <dl v-if="authority" class="fquery-famvim-authority" aria-label="canonical authority">
        <dt>fam_id</dt><dd>{{ describe(authority.famId) }}</dd>
        <dt>revision_id</dt><dd>{{ describe(authority.revisionId) }}</dd>
        <dt>schema_version</dt><dd>{{ describe(authority.schemaVersion) }}</dd>
      </dl>
      <p v-else-if="canonical?.parse === 'unparsed'" class="fquery-famvim-warning" role="status">canonical text is unparsed: {{ canonical.parseError }}</p>
      <p v-else class="fquery-famvim-muted">NOT PROVIDED / canonical FAM未生成</p>
    </header>

    <div class="fquery-famvim-body">
      <nav v-if="render" class="fquery-famvim-paths" aria-label="FAM path navigation">
        <ul>
          <li v-for="entry in render.lines.filter((line) => line.pointer !== '')" :key="entry.pointer">
            <button
              type="button"
              :data-pointer="entry.pointer"
              :data-unsupported="unsupported.has(entry.pointer) ? 'true' : undefined"
              :aria-current="selectedPointer === entry.pointer ? 'true' : undefined"
              @click="select(entry.pointer)"
            >{{ entry.pointer }}<small v-if="unsupported.has(entry.pointer)"> unsupported</small></button>
          </li>
        </ul>
      </nav>

      <label class="fquery-famvim-editor">
        <span>RAW FAM</span>
        <textarea ref="editor" v-model="draft" spellcheck="false" :disabled="!canonical" rows="18" />
      </label>
    </div>

    <section class="fquery-famvim-status" aria-label="validator result">
      <p v-if="draftDocument?.parse === 'unparsed'" class="fquery-famvim-warning" role="alert">draft unparsed（保持中）: {{ draftDocument.parseError }}</p>
      <template v-else-if="validation">
        <p :data-valid="validation.valid">validator: {{ validation.valid ? "valid" : `${validation.issues.length} issue(s)` }}</p>
        <ul v-if="!validation.valid">
          <li v-for="issue in validation.issues" :key="`${issue.path}:${issue.code}`"><code>{{ issue.path }}</code> {{ issue.code }} — {{ issue.message }}</li>
        </ul>
      </template>
      <p v-else class="fquery-famvim-muted">validator: NOT PROVIDED</p>
    </section>

    <section class="fquery-famvim-diff" aria-label="diff preview">
      <p v-if="!dirty" class="fquery-famvim-muted">diff: なし</p>
      <ul v-else-if="diff.length">
        <li v-for="entry in diff" :key="`${entry.path}:${entry.change}`" :data-change="entry.change">
          <code>{{ entry.path }}</code> {{ entry.change }}
          <span v-if="entry.change !== 'added'"> − {{ describe(entry.before) }}</span>
          <span v-if="entry.change !== 'removed'"> + {{ describe(entry.after) }}</span>
        </li>
      </ul>
      <p v-else class="fquery-famvim-muted">diff: textのみ変更（構造差分なし）またはunparsed</p>
    </section>

    <footer class="fquery-famvim-actions">
      <button type="button" :disabled="!canApply" @click="apply">編集をrequest</button>
      <button type="button" :disabled="!dirty" @click="discard">破棄</button>
      <button type="button" :disabled="!canonicalText" @click="copyCanonical">canonicalをcopy</button>
    </footer>

    <details v-if="authority?.provenance !== undefined" class="fquery-famvim-provenance">
      <summary>provenance (read-only)</summary>
      <pre>{{ JSON.stringify(authority.provenance, null, 2) }}</pre>
    </details>
  </section>
</template>

<style scoped>
.fquery-famvim { display: grid; gap: 0.75rem; padding: 1rem; color: #eef2ff; background: #111724; border: 1px solid #34405a; border-radius: 0.75rem; }
.fquery-famvim-header { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
.fquery-famvim-header h3 { margin: 0; font-size: 1rem; }
.fquery-famvim-authority { display: flex; gap: 0.5rem 1rem; flex-wrap: wrap; margin: 0; font: 0.75rem/1.3 ui-monospace, monospace; color: #aeb8cc; }
.fquery-famvim-authority dt { opacity: 0.7; }
.fquery-famvim-authority dd { margin: 0; overflow-wrap: anywhere; }
.fquery-famvim-body { display: grid; grid-template-columns: minmax(12rem, 1fr) 2fr; gap: 0.75rem; }
.fquery-famvim-paths { max-height: 24rem; overflow: auto; border: 1px solid #34405a; border-radius: 0.5rem; }
.fquery-famvim-paths ul { margin: 0; padding: 0; list-style: none; }
.fquery-famvim-paths button { width: 100%; text-align: left; color: #c9d5ed; background: transparent; border: 0; padding: 0.25rem 0.5rem; font: 0.75rem/1.3 ui-monospace, monospace; overflow-wrap: anywhere; }
.fquery-famvim-paths button[aria-current="true"] { background: #252d40; }
.fquery-famvim-paths button[data-unsupported="true"] { color: #d2a8ff; }
.fquery-famvim-editor { display: grid; gap: 0.35rem; color: #aeb8cc; }
.fquery-famvim-editor textarea { width: 100%; color: #eef2ff; background: #080b13; border: 1px solid #59647a; border-radius: 0.5rem; padding: 0.6rem; font: 0.8rem/1.4 ui-monospace, monospace; }
.fquery-famvim-status ul, .fquery-famvim-diff ul { margin: 0.25rem 0 0; padding-left: 1.2rem; font: 0.75rem/1.4 ui-monospace, monospace; }
.fquery-famvim-status p[data-valid="false"] { color: #e3b341; }
.fquery-famvim-status p[data-valid="true"] { color: #7ee787; }
.fquery-famvim-diff li[data-change="removed"] { color: #ff7b72; }
.fquery-famvim-diff li[data-change="added"] { color: #7ee787; }
.fquery-famvim-diff li[data-change="replaced"] { color: #e3b341; }
.fquery-famvim-warning { margin: 0; color: #e3b341; }
.fquery-famvim-muted { margin: 0; color: #8b98b4; }
.fquery-famvim-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.fquery-famvim-actions button { color: inherit; background: #252d40; border: 1px solid #59647a; border-radius: 0.35rem; padding: 0.3rem 0.55rem; }
.fquery-famvim-actions button:focus-visible { outline: 3px solid #79c0ff; outline-offset: 2px; }
.fquery-famvim-actions button:disabled { opacity: 0.45; }
.fquery-famvim-provenance pre { max-height: 12rem; overflow: auto; font-size: 0.75rem; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 720px) { .fquery-famvim-body { grid-template-columns: 1fr; } }
</style>
