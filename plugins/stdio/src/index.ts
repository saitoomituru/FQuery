import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { CapabilityInvocation, CapabilityResult, PluginResolver } from "@fquery/core";
import { validateFamJson } from "@fquery/fam-core";
import { createAdapterProvenance, type PluginManifest } from "@fquery/plugin-sdk";

/**
 * @fam/stndio: Cのstdio同様、OS/protocol非依存の基本file read/write capabilityを
 * FQuery Plugin ABIへ接続する。命名は@fquery/*(FQuery自身のNode参照実装)とは
 * 別に@fam/*(refFAM/Q.pluginが参照する、protocol/OS中立なFAMエコシステム
 * capability名前空間)を使う(docs/specification/fam-q-declaration-execution.ja.md参照)。
 *
 * file.fit(read)とfile.write(write)は同一plugin(@fam/stndio)だが、
 * PluginManifest.sideEffectは1manifestにつき1値のため、PluginRegistry経由で
 * 使う場合はcapabilityごとに別manifestとして登録する(stdioFileFitPluginManifest
 * / stdioFileWritePluginManifest)。StdioFamPlugin.invoke()自体も、capability
 * ごとに要求するsideEffectを個別に検査する(defense in depth、PluginResolverへ
 * 直接渡す使い方でも安全なままにする)。
 *
 * file.fitは単一segment内の`*`・`?`ワイルドカードのみ対応する最小glob実装で、
 * **(再帰glob)・symlink追跡は行わない。file.writeはbaseDir外へのpath
 * traversalを拒否する(fold-nicのbaseline safety conditionと同じ理由:
 * 明示していない拡張範囲を勝手に広げない)。
 */

export const CAPABILITIES = ["file.fit", "file.write"] as const;
export type StdioFamCapability = (typeof CAPABILITIES)[number];

const PLUGIN_ID = "@fam/stndio";

export const stdioFileFitPluginManifest: PluginManifest = Object.freeze({
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: PLUGIN_ID,
  pluginVersion: "0.1.0-draft.0",
  capabilities: ["file.fit"],
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
    capabilityRefs: ["file.fit"],
    observationSurfaces: ["fs-read"],
    limitations: [
      "single-path-segment-glob-only",
      "no-recursive-glob(**)",
      "no-symlink-follow",
      "base-structure-validation-only(ψ/∇φ/λ/Q axesのみ、decomposition profileは検証しない)",
    ],
  } as const),
});

export const stdioFileWritePluginManifest: PluginManifest = Object.freeze({
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: PLUGIN_ID,
  pluginVersion: "0.1.0-draft.0",
  capabilities: ["file.write"],
  accepts: ["application/json"],
  returns: ["application/json"],
  authority: { required: false, scopes: [] },
  sideEffect: "write",
  unknownPolicy: "retain",
  lastOrderPolicy: "return-envelope",
  implementation: { language: "typescript", runtime: "node" },
  famSupport: Object.freeze({
    schemaVersion: "fam.adapter-support/0.1.0-draft",
    level: 0,
    capabilityRefs: ["file.write"],
    observationSurfaces: ["fs-write"],
    limitations: [
      "no-path-traversal-outside-baseDir",
      "no-symlink-follow",
      "overwrites-without-diff(既存fileの上書き前差分確認はしない)",
    ],
  } as const),
});

/** @deprecated file.fitのみを指す旧名。stdioFileFitPluginManifestを使うこと。 */
export const stdioPluginManifest = stdioFileFitPluginManifest;

export interface StdioFamPluginOptions {
  /** globパターン/書き込みpathの解決起点。refFAM/自体を渡すことを想定する。 */
  readonly baseDir: string;
}

export interface FileFitMatch {
  readonly pattern: string;
  readonly matchedPath: string;
  readonly baseStructureStatus: "valid" | "invalid";
  readonly fam: unknown;
}

export interface FileWriteInput {
  readonly path: string;
  readonly fam: unknown;
}

export class StdioFamPlugin implements PluginResolver {
  readonly #baseDir: string;

  constructor(options: StdioFamPluginOptions) {
    this.#baseDir = options.baseDir;
  }

  async invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined> {
    if (request.capability === "file.fit") return this.#invokeFileFit(request);
    if (request.capability === "file.write") return this.#invokeFileWrite(request);
    return undefined;
  }

  async #invokeFileFit(request: CapabilityInvocation): Promise<CapabilityResult> {
    if (request.sideEffect !== "read") {
      return {
        pluginId: PLUGIN_ID,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "read-side-effect-not-authorized",
        adapterProvenance: createAdapterProvenance(stdioFileFitPluginManifest),
      };
    }
    const patterns = request.input;
    if (!Array.isArray(patterns) || !patterns.every((entry) => typeof entry === "string")) {
      return {
        pluginId: PLUGIN_ID,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "file-fit-input-must-be-string-array",
        adapterProvenance: createAdapterProvenance(stdioFileFitPluginManifest),
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
        pluginId: PLUGIN_ID,
        transportStatus: "succeeded",
        outputStatus: "accepted",
        value: Object.freeze(matches),
        evidenceRefs: matches.map((match) => `file://${match.matchedPath}`),
        adapterProvenance: createAdapterProvenance(stdioFileFitPluginManifest),
      };
    } catch (error) {
      return {
        pluginId: PLUGIN_ID,
        transportStatus: "failed",
        reason: error instanceof Error ? error.message : "file-fit-read-failed",
        adapterProvenance: createAdapterProvenance(stdioFileFitPluginManifest),
      };
    }
  }

  async #invokeFileWrite(request: CapabilityInvocation): Promise<CapabilityResult> {
    if (request.sideEffect !== "write") {
      return {
        pluginId: PLUGIN_ID,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "write-side-effect-not-authorized",
        adapterProvenance: createAdapterProvenance(stdioFileWritePluginManifest),
      };
    }
    const input = request.input as Partial<FileWriteInput> | undefined;
    if (!input || typeof input.path !== "string" || input.path.length === 0 || input.fam === undefined) {
      return {
        pluginId: PLUGIN_ID,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "file-write-input-must-have-path-and-fam",
        adapterProvenance: createAdapterProvenance(stdioFileWritePluginManifest),
      };
    }
    const resolvedBase = resolve(this.#baseDir);
    const resolvedTarget = resolve(resolvedBase, input.path);
    const relativeToBase = relative(resolvedBase, resolvedTarget);
    if (relativeToBase.startsWith("..") || relativeToBase.split(sep).includes("..")) {
      return {
        pluginId: PLUGIN_ID,
        pluginStatus: "rejected",
        transportStatus: "failed",
        reason: "path-traversal-outside-base-dir-rejected",
        adapterProvenance: createAdapterProvenance(stdioFileWritePluginManifest),
      };
    }
    try {
      mkdirSync(dirname(resolvedTarget), { recursive: true });
      writeFileSync(resolvedTarget, `${JSON.stringify(input.fam, null, 2)}\n`, "utf8");
      return {
        pluginId: PLUGIN_ID,
        transportStatus: "succeeded",
        outputStatus: "accepted",
        value: Object.freeze({ writtenPath: resolvedTarget }),
        evidenceRefs: [`file://${resolvedTarget}`],
        adapterProvenance: createAdapterProvenance(stdioFileWritePluginManifest),
      };
    } catch (error) {
      return {
        pluginId: PLUGIN_ID,
        transportStatus: "failed",
        reason: error instanceof Error ? error.message : "file-write-failed",
        adapterProvenance: createAdapterProvenance(stdioFileWritePluginManifest),
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
