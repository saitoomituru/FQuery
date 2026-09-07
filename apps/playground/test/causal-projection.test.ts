import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLiteralDecompositionFam, readAccessMapProfile, readFamJson } from "@fquery/fam-core";
import { reprojectWithAccessMap } from "../src/host/causal-projection.js";

const accessMap = readAccessMapProfile(readFamJson(readFileSync(resolve(process.cwd(), "../../fixtures/test-cases/basic-commons-access-mapper/access-map.fam.json"), "utf8")).value);

describe("Playground Access Mapper causal adapter", () => {
  it("38→68はactive branchを保持してfresh再投影する", () => {
    const fam = createLiteralDecompositionFam("降水確率は68%である。不安である。傘を持つ。", "q://test/tc2/68");
    expect(reprojectWithAccessMap(fam, accessMap)).toMatchObject({ projectionStatus: "fresh", manifestations: ["降水確率は68%である。", "不安である。", "傘を持つ。"] });
  });

  it("38→0はfallbackを発明せずneeds-recompositionにする", () => {
    const fam = createLiteralDecompositionFam("降水確率は0%である。不安である。傘を持つ。", "q://test/tc2/0");
    expect(reprojectWithAccessMap(fam, accessMap)).toMatchObject({ projectionStatus: "needs-recomposition", stale: true, manifestations: [], cancelledGateRefs: ["gate://fquery/test/issue-35/rain-anxiety"] });
  });

  it("明示extractorに一致しない通常文に因果を付与しない", () => {
    const fam = createLiteralDecompositionFam("雨が降る。傘を持つ。", "q://test/no-gate");
    expect(reprojectWithAccessMap(fam, accessMap)).toBeUndefined();
  });
});
