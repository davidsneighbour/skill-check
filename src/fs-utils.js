import fs from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

/**
 * @param {string} directoryPath
 * @returns {Promise<boolean>}
 */
export async function directoryExists(directoryPath) {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isNotFoundError(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

/**
 * Small glob implementation for the repository scaffold.
 * Supports the default skill-file include pattern and simple segment exclusions.
 * @param {string} rootPath
 * @param {string[]} include
 * @param {string[]} exclude
 * @returns {Promise<string[]>}
 */
export async function findSkillFiles(rootPath, include, exclude) {
  const absoluteRoot = path.resolve(rootPath);
  const stat = await fs.stat(absoluteRoot);

  if (stat.isFile()) {
    return path.basename(absoluteRoot) === "SKILL.md" ? [absoluteRoot] : [];
  }

  const results = [];
  await walk(absoluteRoot, absoluteRoot, include, exclude, results);
  return results.sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} currentPath
 * @param {string} rootPath
 * @param {string[]} include
 * @param {string[]} exclude
 * @param {string[]} results
 * @returns {Promise<void>}
 */
async function walk(currentPath, rootPath, include, exclude, results) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = slash(path.relative(rootPath, absolutePath));

    if (isExcluded(relativePath, entry.isDirectory(), exclude)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walk(absolutePath, rootPath, include, exclude, results);
      continue;
    }

    if (matchesInclude(relativePath, include)) {
      results.push(absolutePath);
    }
  }
}

/**
 * @param {string} relativePath
 * @param {string[]} include
 * @returns {boolean}
 */
function matchesInclude(relativePath, include) {
  return include.some((pattern) => {
    if (pattern === "**/SKILL.md") return relativePath === "SKILL.md" || relativePath.endsWith("/SKILL.md");
    if (pattern.endsWith("/SKILL.md")) return relativePath.endsWith(pattern.replace(/^\*\*\//, ""));
    return relativePath === pattern;
  });
}

/**
 * @param {string} relativePath
 * @param {boolean} isDirectory
 * @param {string[]} exclude
 * @returns {boolean}
 */
function isExcluded(relativePath, isDirectory, exclude) {
  return exclude.some((pattern) => {
    if (pattern.startsWith("**/") && pattern.endsWith("/**")) {
      const segment = pattern.slice(3, -3);
      return relativePath === segment || relativePath.startsWith(`${segment}/`) || relativePath.includes(`/${segment}/`) || (isDirectory && relativePath.endsWith(`/${segment}`));
    }
    return relativePath === pattern;
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
export function slash(value) {
  return value.split(path.sep).join("/");
}
