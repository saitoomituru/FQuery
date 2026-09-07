import type { FamRole } from "./core-nodes.js";
import type { PluginPresentationRegistration, PluginPresentationRegistry } from "./index.js";
import type { PluginPaneContribution } from "./pane-contract.js";

/**
 * Node Panel pluginが編集できるQ fieldの宣言。JSON Schemaの最小subset。
 * keyは`/Q`配下の相対JSON Pointer token（例: `observer_ref`）。
 */
export interface QSchemaProperty {
  readonly type: "string" | "number" | "boolean" | "enum";
  readonly enum?: readonly string[];
  readonly label?: string;
  readonly description?: string;
  readonly readOnly?: boolean;
}

export interface QSchema {
  readonly schemaVersion: "fquery.q-schema/0.1.0-draft";
  readonly properties: Readonly<Record<string, QSchemaProperty>>;
}

/**
 * pluginはFAM ontologyの所有者ではなく、特定Q schema／subtreeのpresentation + edit capabilityを提供する。
 * `presentation`（Presentation FAM）がpresentation_schemaに相当する。
 */
export interface PluginEditorContract {
  readonly famRole?: FamRole;
  readonly qSchema?: QSchema;
  /** Q以外でpluginが編集責務を持つcanonical pathのprefix（JSON Pointer） */
  readonly knownPointers?: readonly string[];
  readonly capabilities?: readonly string[];
  /** 左Tool pane／右Inspector paneへのtab／section宣言（Issue #33）。componentRefはHostが解決する */
  readonly panes?: readonly PluginPaneContribution[];
}

export const Q_SCHEMA_VERSION = "fquery.q-schema/0.1.0-draft" as const;

/** editor contractからknown pointer prefix集合を導出する。qSchemaのkeyは`/Q/<key>`へ写像する。 */
export function deriveKnownPointers(editor: PluginEditorContract | undefined): readonly string[] {
  if (!editor) return Object.freeze([]);
  const fromSchema = Object.keys(editor.qSchema?.properties ?? {}).map((key) => `/Q/${escapePointerToken(key)}`);
  return Object.freeze([...fromSchema, ...(editor.knownPointers ?? [])]);
}

export function findRegistrationByPresentation(registry: PluginPresentationRegistry, presentationId: string | undefined): PluginPresentationRegistration | undefined {
  if (!presentationId) return undefined;
  return registry.registrations().find((registration) => registration.presentation.presentationId === presentationId);
}

export function escapePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}
