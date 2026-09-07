import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { assessNegativeFixture, validateNegativeFixture, type NegativeFixture } from "../src/index.js";

const fixtureDirectory = new URL("../../../fixtures/negative/world-mismatch/", import.meta.url);

describe("ちくわ砲negative fixture", () => {
  it("TC-01からTC-07を機械可読契約として検証する", async () => {
    const files = (await readdir(fixtureDirectory)).filter((file) => file.endsWith(".json")).sort();
    expect(files).toHaveLength(7);
    for (const file of files) {
      const fixture: unknown = JSON.parse(await readFile(new URL(file, fixtureDirectory), "utf8"));
      expect(validateNegativeFixture(fixture), file).toEqual([]);
    }
  });

  it("status、failure、event、fallbackの不足を別findingで返す", async () => {
    const fixture = JSON.parse(await readFile(new URL("tc-01-reality-fantasy-capability.json", fixtureDirectory), "utf8")) as NegativeFixture;
    const failed = assessNegativeFixture(fixture, { status: { semanticStatus: "satisfied" }, failureClasses: [], famlogEvents: [], fallback: null });
    expect(failed.passed).toBe(false);
    expect(failed.findings).toEqual(expect.arrayContaining([
      expect.stringContaining("status:semanticStatus"),
      "failure-class-missing:world-mismatch",
      "famlog-event-missing:capability-resolve",
      "fallback:expected=capability://reality/emergency-route:actual=null",
    ]));
  });

  it("期待観測が揃った場合だけpassする", async () => {
    const fixture = JSON.parse(await readFile(new URL("tc-05-capability-resource-insufficient.json", fixtureDirectory), "utf8")) as NegativeFixture;
    const result = assessNegativeFixture(fixture, {
      status: fixture.expected_status,
      failureClasses: [fixture.expected_failure_class],
      famlogEvents: fixture.expected_famlog_events,
      fallback: fixture.expected_fallback,
    });
    expect(result).toEqual({ passed: true, findings: [] });
  });
});
