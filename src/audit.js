import path from "node:path";
import { findSkillFiles } from "./fs-utils.js";
import { readSkillDocument } from "./skill-document.js";
import { RULES, hasRule } from "./rules/registry.js";

/**
 * @param {object} options
 * @param {string[]} options.paths
 * @param {import('./types.js').SkillLintConfig} options.config
 * @param {string} [options.cwd]
 * @returns {Promise<import('./types.js').AuditSummary>}
 */
export async function auditSkills(options) {
  const cwd = options.cwd ?? process.cwd();
  const targetPaths = options.paths.length > 0 ? options.paths : [cwd];
  const skillFiles = new Set();

  for (const targetPath of targetPaths) {
    const resolved = path.resolve(cwd, targetPath);
    const files = await findSkillFiles(resolved, options.config.include, options.config.exclude);
    for (const file of files) skillFiles.add(file);
  }

  const diagnostics = [];
  for (const filePath of [...skillFiles].sort((a, b) => a.localeCompare(b))) {
    const document = await readSkillDocument(filePath);
    for (const [ruleId, configuredSeverity] of Object.entries(options.config.rules)) {
      if (configuredSeverity === "off") continue;
      if (!hasRule(ruleId)) {
        diagnostics.push({
          ruleId: "config/unknown-rule",
          severity: "warn",
          message: `Unknown rule configured: ${ruleId}`,
          filePath,
          line: 1,
          column: 1,
          suggestion: "Remove the unknown rule or implement it in src/rules/registry.js."
        });
        continue;
      }

      const ruleDiagnostics = await RULES[ruleId](document, { config: options.config });
      for (const ruleDiagnostic of ruleDiagnostics) {
        diagnostics.push({
          ...ruleDiagnostic,
          severity: configuredSeverity
        });
      }
    }
  }

  return summarise({ files: skillFiles.size, diagnostics });
}

/**
 * @param {object} options
 * @param {number} options.files
 * @param {import('./types.js').Diagnostic[]} options.diagnostics
 * @returns {import('./types.js').AuditSummary}
 */
function summarise(options) {
  return {
    files: options.files,
    errors: options.diagnostics.filter((item) => item.severity === "error").length,
    warnings: options.diagnostics.filter((item) => item.severity === "warn").length,
    infos: options.diagnostics.filter((item) => item.severity === "info").length,
    diagnostics: options.diagnostics.sort((a, b) => {
      const fileCompare = a.filePath.localeCompare(b.filePath);
      if (fileCompare !== 0) return fileCompare;
      return a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId);
    })
  };
}

/**
 * @param {import('./types.js').AuditSummary} summary
 * @param {import('./types.js').SkillLintConfig} config
 * @param {number | undefined} maxWarnings
 * @returns {number}
 */
export function getExitCode(summary, config, maxWarnings) {
  if (config.failOn === "off") return 0;
  if (config.failOn === "error" && summary.errors > 0) return 1;
  if (config.failOn === "warn" && (summary.errors > 0 || summary.warnings > 0)) return 1;
  if (typeof maxWarnings === "number" && maxWarnings >= 0 && summary.warnings > maxWarnings) return 1;
  return 0;
}
