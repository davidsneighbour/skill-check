/**
 * @typedef {object} Diagnostic
 * @property {string} ruleId
 * @property {"error" | "warn" | "info"} severity
 * @property {string} message
 * @property {string} filePath
 * @property {number} line
 * @property {number} column
 * @property {string | undefined} suggestion
 */

/**
 * @typedef {object} SkillDocument
 * @property {string} filePath
 * @property {string} directoryPath
 * @property {string} directoryName
 * @property {string} raw
 * @property {string} body
 * @property {Record<string, unknown>} frontmatter
 * @property {number} bodyStartLine
 */

/**
 * @typedef {object} SkillLintConfig
 * @property {string[]} include
 * @property {string[]} exclude
 * @property {"error" | "warn" | "off"} failOn
 * @property {number} maxFileSizeBytes
 * @property {number} maxBodyLines
 * @property {Record<string, "off" | "info" | "warn" | "error">} rules
 */

/**
 * @typedef {object} AuditSummary
 * @property {number} files
 * @property {number} errors
 * @property {number} warnings
 * @property {number} infos
 * @property {import('./types.js').Diagnostic[]} diagnostics
 */

export const TYPES_MODULE = true;
