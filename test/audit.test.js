import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { auditSkills, getExitCode } from "../src/audit.js";
import { loadConfig } from "../src/config.js";
import { parseArgs } from "../src/cli.js";

const cwd = process.cwd();

await describe("skill-check", async () => {
  await it("passes a valid fixture without errors", async () => {
    const config = await loadConfig(undefined, cwd);
    const summary = await auditSkills({
      paths: [path.join("test", "fixtures", "valid-skill")],
      config,
      cwd
    });

    assert.equal(summary.errors, 0);
    assert.equal(getExitCode(summary, config), 0);
  });

  await it("flags risky fixtures", async () => {
    const config = await loadConfig(undefined, cwd);
    const summary = await auditSkills({
      paths: [path.join("test", "fixtures", "risky-skill")],
      config,
      cwd
    });

    const ruleIds = new Set(summary.diagnostics.map((diagnostic) => diagnostic.ruleId));
    assert.equal(summary.errors > 0, true);
    assert.equal(ruleIds.has("security/no-policy-bypass"), true);
    assert.equal(ruleIds.has("skill/name-format"), true);
    assert.equal(ruleIds.has("skill/referenced-files-exist"), true);
  });

  await it("parses cli options", () => {
    const args = parseArgs([
      "./skills",
      "--format",
      "json",
      "--output",
      "reports/out.json",
      "--fail-on",
      "warn",
      "--max-warnings",
      "0"
    ]);

    assert.deepEqual(args.paths, ["./skills"]);
    assert.equal(args.format, "json");
    assert.equal(args.outputPath, "reports/out.json");
    assert.equal(args.failOn, "warn");
    assert.equal(args.maxWarnings, 0);
  });
});
