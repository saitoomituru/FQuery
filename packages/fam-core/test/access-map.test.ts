import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyWithAccessMap, readAccessMapProfile, readFamJson } from "../src/index.js";

const fixtureUrl = new URL("../../../fixtures/test-cases/basic-commons-access-mapper/access-map.fam.json", import.meta.url);

describe("Basic Commons Access Mapper FAM", () => {
  const document = readFamJson(readFileSync(fixtureUrl, "utf8"));
  const profile = readAccessMapProfile(document.value);

  it("FAM identityとrevisionを保持した注入profileとして読める", () => {
    expect(profile).toMatchObject({
      famId: "fam://fquery/test/basic-commons-access-mapper",
      revisionId: "rev://fquery/test/basic-commons-access-mapper/1",
      unknownPolicy: "retain",
      unmappedPolicy: "retain-unmapped",
    });
  });

  it("Astral factをactor/action-local scopeへ明示写像する", () => {
    expect(classifyWithAccessMap(profile, "astral-fact")).toMatchObject({
      status: "mapped",
      dimensionRef: "dimension://fquery/test/astral",
      evidenceScope: ["actor-local", "action-local", "not-world-global"],
    });
  });

  it("未知claim kindを推測分類せずunmappedとして保持する", () => {
    expect(classifyWithAccessMap(profile, "theology-local")).toMatchObject({
      status: "unmapped",
      evidenceScope: ["unknown", "not-absence"],
    });
  });
});
