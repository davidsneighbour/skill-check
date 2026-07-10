/** @typedef {"error" | "warn" | "info"} Severity */

/**
 * @param {object} input
 * @param {string} input.ruleId
 * @param {Severity} input.severity
 * @param {string} input.message
 * @param {string} input.filePath
 * @param {number} [input.line]
 * @param {number} [input.column]
 * @param {string} [input.suggestion]
 * @returns {import('./types.js').Diagnostic}
 */
export function diagnostic(input) {
  return {
    ruleId: input.ruleId,
    severity: input.severity,
    message: input.message,
    filePath: input.filePath,
    line: input.line ?? 1,
    column: input.column ?? 1,
    suggestion: input.suggestion
  };
}
