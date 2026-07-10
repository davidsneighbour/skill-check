import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG, CONFIG_FILENAMES } from "./default-config.js";
import { fileExists } from "./fs-utils.js";

/**
 * @param {string | undefined} explicitPath
 * @param {string} cwd
 * @returns {Promise<import('./types.js').SkillLintConfig>}
 */
export async function loadConfig(explicitPath, cwd = process.cwd()) {
  const configPath = explicitPath ? path.resolve(cwd, explicitPath) : await findConfigFile(cwd);

  if (!configPath) {
    return cloneConfig(DEFAULT_CONFIG);
  }

  let raw;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read config file ${configPath}: ${formatError(error)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stripJsonComments(raw));
  } catch (error) {
    throw new Error(`Could not parse config file ${configPath}: ${formatError(error)}`);
  }

  return mergeConfig(DEFAULT_CONFIG, parsed);
}

/**
 * @param {string} cwd
 * @returns {Promise<string | undefined>}
 */
async function findConfigFile(cwd) {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, filename);
    if (await fileExists(candidate)) return candidate;
  }

  return undefined;
}

/**
 * @param {import('./types.js').SkillLintConfig} base
 * @param {unknown} override
 * @returns {import('./types.js').SkillLintConfig}
 */
function mergeConfig(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    throw new Error("Config root must be an object.");
  }

  const record = /** @type {Record<string, unknown>} */ (override);
  return {
    include: readStringArray(record.include, base.include, "include"),
    exclude: readStringArray(record.exclude, base.exclude, "exclude"),
    failOn: readFailOn(record.failOn, base.failOn),
    maxFileSizeBytes: readNumber(record.maxFileSizeBytes, base.maxFileSizeBytes, "maxFileSizeBytes"),
    maxBodyLines: readNumber(record.maxBodyLines, base.maxBodyLines, "maxBodyLines"),
    rules: {
      ...base.rules,
      ...readRules(record.rules)
    }
  };
}

/**
 * @param {unknown} value
 * @param {string[]} fallback
 * @param {string} fieldName
 * @returns {string[]}
 */
function readStringArray(value, fallback, fieldName) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  return [...value];
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {string} fieldName
 * @returns {number}
 */
function readNumber(value, fallback, fieldName) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {"error" | "warn" | "off"} fallback
 * @returns {"error" | "warn" | "off"}
 */
function readFailOn(value, fallback) {
  if (value === undefined) return fallback;
  if (value === "error" || value === "warn" || value === "off") return value;
  throw new Error("failOn must be one of: error, warn, off.");
}

/**
 * @param {unknown} value
 * @returns {Record<string, "off" | "info" | "warn" | "error">}
 */
function readRules(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("rules must be an object.");
  }

  const output = {};
  for (const [ruleId, severity] of Object.entries(value)) {
    if (severity !== "off" && severity !== "info" && severity !== "warn" && severity !== "error") {
      throw new Error(`Rule ${ruleId} must be one of: off, info, warn, error.`);
    }
    output[ruleId] = severity;
  }
  return output;
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function stripJsonComments(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {import('./types.js').SkillLintConfig} config
 * @returns {import('./types.js').SkillLintConfig}
 */
function cloneConfig(config) {
  return {
    include: [...config.include],
    exclude: [...config.exclude],
    failOn: config.failOn,
    maxFileSizeBytes: config.maxFileSizeBytes,
    maxBodyLines: config.maxBodyLines,
    rules: { ...config.rules }
  };
}
