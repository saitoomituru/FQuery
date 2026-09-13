import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CapabilityInvocation, CapabilityResult, PluginResolver } from "@fquery/core";
import { validateFamJson } from "@fquery/fam-core";
import { createAdapterProvenance, type PluginManifest } from "@fquery/plugin-sdk";

/**
 * @fam/stndio: Cのstdio同様、OS/protocol非依存の基本file read capabilityを
 * FQuery Plugin ABIへ接続する。命名は@fquery/*(FQuery自身のNode参照実装)とは
 * 別に@fam/*(refFAM/Q.pluginが参照する、protocol/OS中立なFAMエコシステム
 * capability名前空間)を使う(docs/specification/fam-q-declaration-execution.ja.md参照)。
 *
 * 提供capabilityはfile.fitのみ。単一segment内の`*`・`?`ワイルドカードのみ対応する
 * 最小glob実装で、**(再帰glob)・symlink追跡は行わない(fold-nicのbaseline safety
 * conditionと同じ理由: 明示していない拡張範囲を勝手に広げない)。
 */

export const CAPABILITIES = ["file.fit"] as const;
export type StdioFamCapability = (typeof CAPABILITIES)[number];

export const stdioPluginManifest: PluginManifest = Object.freeze({
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: "@fam/stndio",
  pluginVersion: "0.1.0-draft.0",
  capabilities: CAPABILITIES,
  accepts: ["application/json"],
  returns: ["application/json"],
  authority: { required: false, scopes: [] },
  sideEffect: "read",
  unknownPolicy: "retain",
  lastOrderPolicy: "return-envelope",
  implementation: { language: "typescript", runtime: "node" },
  famSupport: Object.freeze({
    schemaVersion: "fam.adapter-support/0.1.0-draft",
    level: 0,
    capabilityRefs: CAPABILITIES,
    observationSurfaces: ["fs-read"],
    limitations: [
      "single-path-segment-glob-only",
      "no-recursive-glob(**)",
      "no-symlink-follow",
      "base-structure-validation-only(ψ/∇φ/λ/Q axesのみ、decomposition profileは検証しない)",
    ],
  } as const),
});

export interface StdioFamPluginOptions {
  /** globパターンの解決起点。refFAM/自体を渡すことを想定する。 */
  readonly baseDir: string;
}

export interface FileFitMatch {
  readonly pattern: string;
  readonly matchedPath: string;
  readonly baseStructureStatus: "valid" | "invalid";
  readonly fam: unknown;
}

export class StdioFamPlugin implements PluginResolver {
  readonly #baseDir: string;

  constructor(options: StdioFamPluginOptions) {
    this.#baseDir = options.baseDir;
  }

  async invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined> {
    if (request.capability !== "file.fit") return undefined;
    if (request.sideEffect !== "read") {
      return {
        pluginId: stdioPluginManifest.pluginId,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "read-side-effect-not-authorized",
        adapterProvenance: createAdapterProvenance(stdioPluginManifest),
      };
    }
    const patterns = request.input;
    if (!Array.isArray(patterns) || !patterns.every((entry) => typeof entry === "string")) {
      return {
        pluginId: stdioPluginManifest.pluginId,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "file-fit-input-must-be-string-array",
        adapterProvenance: createAdapterProvenance(stdioPluginManifest),
      };
    }
    try {
      const matches: FileFitMatch[] = [];
      for (const pattern of patterns as readonly string[]) {
        for (const matchedPath of matchGlob(this.#baseDir, pattern)) {
          const text = readFileSync(matchedPath, "utf8");
          const parsed = text.trim().length === 0 ? {} : (JSON.parse(text) as unknown);
          const validation = validateFamJson(parsed);
          matches.push(Object.freeze({ pattern, matchedPath, baseStructureStatus: validation.baseStructureStatus, fam: parsed }));
        }
      }
      return {
        pluginId: stdioPluginManifest.pluginId,
        transportStatus: "succeeded",
        outputStatus: "accepted",
        value: Object.freeze(matches),
        evidenceRefs: matches.map((match) => `file://${match.matchedPath}`),
        adapterProvenance: createAdapterProvenance(stdioPluginManifest),
      };
    } catch (error) {
      return {
        pluginId: stdioPluginManifest.pluginId,
        transportStatus: "failed",
        reason: error instanceof Error ? error.message : "file-fit-read-failed",
        adapterProvenance: createAdapterProvenance(stdioPluginManifest),
      };
    }
  }
}

/** 単一path segment内の`*`・`?`のみ対応する最小glob。再帰glob(`**`)は非対応。 */
function matchGlob(baseDir: string, pattern: string): readonly string[] {
  const segments = pattern.split("/").filter((segment) => segment.length > 0);
  let candidates: readonly string[] = [baseDir];
  for (const segment of segments) {
    const next: string[] = [];
    if (!hasWildcard(segment)) {
      for (const dir of candidates) {
        const candidate = join(dir, segment);
        if (existsSync(candidate)) next.push(candidate);
      }
    } else {
      const regex = globSegmentToRegExp(segment);
      for (const dir of candidates) {
        let entries: readonly string[];
        try {
          entries = readdirSync(dir);
        } catch {
          entries = [];
        }
        for (const entry of entries) if (regex.test(entry)) next.push(join(dir, entry));
      }
    }
    candidates = next;
  }
  return [...candidates].sort();
}

function hasWildcard(segment: string): boolean {
  return segment.includes("*") || segment.includes("?");
}

function globSegmentToRegExp(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}
