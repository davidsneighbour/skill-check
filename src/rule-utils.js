import path from "node:path";

/**
 * @param {import('./types.js').SkillDocument} document
 * @param {string} needle
 * @returns {number}
 */
export function lineOf(document, needle) {
  const lines = document.raw.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  return index === -1 ? 1 : index + 1;
}

/**
 * @param {import('./types.js').SkillDocument} document
 * @param {RegExp} regex
 * @returns {number}
 */
export function lineOfRegex(document, regex) {
  const lines = document.raw.split(/\r?\n/);
  const index = lines.findIndex((line) => regex.test(line));
  return index === -1 ? 1 : index + 1;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {string} basePath
 * @param {string} target
 * @returns {string}
 */
export function resolveLocalReference(basePath, target) {
  return path.resolve(basePath, decodeURIComponent(target.split("#")[0] ?? ""));
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeUrl(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith("mailto:");
}

/**
 * @param {string} text
 * @param {RegExp[]} patterns
 * @returns {boolean}
 */
export function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}
