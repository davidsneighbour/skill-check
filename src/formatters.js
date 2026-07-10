import path from "node:path";

/**
 * @param {import('./types.js').AuditSummary} summary
 * @param {string} format
 * @param {string} cwd
 * @returns {string}
 */
export function formatSummary(summary, format, cwd = process.cwd()) {
  switch (format) {
    case "json":
      return `${JSON.stringify(toRelativeSummary(summary, cwd), null, 2)}\n`;
    case "markdown":
      return formatMarkdown(summary, cwd);
    case "pretty":
      return formatPretty(summary, cwd);
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

/**
 * @param {import('./types.js').AuditSummary} summary
 * @param {string} cwd
 * @returns {import('./types.js').AuditSummary}
 */
function toRelativeSummary(summary, cwd) {
  return {
    ...summary,
    diagnostics: summary.diagnostics.map((item) => ({
      ...item,
      filePath: path.relative(cwd, item.filePath) || item.filePath
    }))
  };
}

/**
 * @param {import('./types.js').AuditSummary} summary
 * @param {string} cwd
 * @returns {string}
 */
function formatPretty(summary, cwd) {
  const lines = [];

  if (summary.diagnostics.length === 0) {
    lines.push(`skill-check: checked ${summary.files} skill file(s), no diagnostics.`);
    return `${lines.join("\n")}\n`;
  }

  for (const item of summary.diagnostics) {
    const relativePath = path.relative(cwd, item.filePath) || item.filePath;
    lines.push(`${relativePath}:${item.line}:${item.column} ${item.severity.toUpperCase()} ${item.ruleId} ${item.message}`);
    if (item.suggestion) lines.push(`  -> ${item.suggestion}`);
  }

  lines.push("");
  lines.push(`skill-check: checked ${summary.files} skill file(s), ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info(s).`);
  return `${lines.join("\n")}\n`;
}

/**
 * @param {import('./types.js').AuditSummary} summary
 * @param {string} cwd
 * @returns {string}
 */
function formatMarkdown(summary, cwd) {
  const lines = [
    "# skill-check report",
    "",
    `Checked ${summary.files} skill file(s).`,
    "",
    `- Errors: ${summary.errors}`,
    `- Warnings: ${summary.warnings}`,
    `- Info: ${summary.infos}`,
    ""
  ];

  if (summary.diagnostics.length === 0) {
    lines.push("No diagnostics.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| Severity | Rule | Location | Message |");
  lines.push("| --- | --- | --- | --- |");

  for (const item of summary.diagnostics) {
    const relativePath = path.relative(cwd, item.filePath) || item.filePath;
    const message = escapeMarkdown(item.suggestion ? `${item.message} Suggestion: ${item.suggestion}` : item.message);
    lines.push(`| ${item.severity} | \`${item.ruleId}\` | \`${relativePath}:${item.line}:${item.column}\` | ${message} |`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeMarkdown(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
