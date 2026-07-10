import fs from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} filePath
 * @returns {Promise<import('./types.js').SkillDocument>}
 */
export async function readSkillDocument(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = parseSkillMarkdown(raw);
  const directoryPath = path.dirname(filePath);

  return {
    filePath,
    directoryPath,
    directoryName: path.basename(directoryPath),
    raw,
    body: parsed.body,
    frontmatter: parsed.frontmatter,
    bodyStartLine: parsed.bodyStartLine
  };
}

/**
 * @param {string} raw
 * @returns {{ frontmatter: Record<string, unknown>, body: string, bodyStartLine: number }}
 */
export function parseSkillMarkdown(raw) {
  const normalised = raw.replace(/^\uFEFF/, "");
  const lines = normalised.split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, body: normalised, bodyStartLine: 1 };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex === -1) {
    return { frontmatter: {}, body: normalised, bodyStartLine: 1 };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const bodyLines = lines.slice(endIndex + 1);

  return {
    frontmatter: parseSimpleYaml(frontmatterLines),
    body: bodyLines.join("\n"),
    bodyStartLine: endIndex + 2
  };
}

/**
 * Intentionally small YAML reader for skill metadata. It supports common scalar
 * keys and one-line arrays. Complex YAML should be validated by the official
 * skill tooling as part of CI.
 * @param {string[]} lines
 * @returns {Record<string, unknown>}
 */
function parseSimpleYaml(lines) {
  const frontmatter = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^(?<key>[A-Za-z0-9_-]+):\s*(?<value>.*)$/.exec(trimmed);
    if (!match?.groups) continue;

    const key = match.groups.key;
    const value = match.groups.value.trim();
    frontmatter[key] = parseYamlScalar(value);
  }

  return frontmatter;
}

/**
 * @param {string} value
 * @returns {unknown}
 */
function parseYamlScalar(value) {
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
  }
  return unquote(value);
}

/**
 * @param {string} value
 * @returns {string}
 */
function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
