#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditSkills, getExitCode } from "./audit.js";
import { loadConfig } from "./config.js";
import { formatSummary } from "./formatters.js";
import { DEFAULT_CONFIG } from "./default-config.js";

const VERSION = "0.1.0";
const CLI_PATH = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === CLI_PATH) {
  main().catch((error) => {
    console.error(`skill-check failed: ${formatError(error)}`);
    process.exitCode = 2;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(helpText());
    return;
  }

  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (args.init) {
    await writeDefaultConfig(args.configPath ?? "skill-check.config.jsonc");
    return;
  }

  const config = await loadConfig(args.configPath, process.cwd());
  if (args.failOn) config.failOn = args.failOn;

  const summary = await auditSkills({ paths: args.paths, config, cwd: process.cwd() });
  const output = formatSummary(summary, args.format, process.cwd());

  if (args.outputPath) {
    await fs.mkdir(path.dirname(path.resolve(args.outputPath)), { recursive: true });
    await fs.writeFile(args.outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }

  process.exitCode = getExitCode(summary, config, args.maxWarnings);
}

/**
 * @param {string[]} argv
 * @returns {{ paths: string[], configPath?: string, format: "pretty" | "json" | "markdown", outputPath?: string, maxWarnings?: number, failOn?: "error" | "warn" | "off", init: boolean, help: boolean, version: boolean }}
 */
export function parseArgs(argv) {
  const result = {
    paths: [],
    format: "pretty",
    init: false,
    help: false,
    version: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      case "--init":
        result.init = true;
        break;
      case "--config":
      case "-c":
        result.configPath = readOptionValue(argv, index, arg);
        index += 1;
        break;
      case "--format": {
        const value = readOptionValue(argv, index, arg);
        if (value !== "pretty" && value !== "json" && value !== "markdown") {
          throw new Error("--format must be one of: pretty, json, markdown.");
        }
        result.format = value;
        index += 1;
        break;
      }
      case "--output":
      case "-o":
        result.outputPath = readOptionValue(argv, index, arg);
        index += 1;
        break;
      case "--max-warnings": {
        const value = Number(readOptionValue(argv, index, arg));
        if (!Number.isInteger(value) || value < 0) {
          throw new Error("--max-warnings must be a non-negative integer.");
        }
        result.maxWarnings = value;
        index += 1;
        break;
      }
      case "--fail-on": {
        const value = readOptionValue(argv, index, arg);
        if (value !== "error" && value !== "warn" && value !== "off") {
          throw new Error("--fail-on must be one of: error, warn, off.");
        }
        result.failOn = value;
        index += 1;
        break;
      }
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        result.paths.push(arg);
    }
  }

  return result;
}

/**
 * @param {string[]} argv
 * @param {number} index
 * @param {string} optionName
 * @returns {string}
 */
function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

/**
 * @param {string} configPath
 * @returns {Promise<void>}
 */
async function writeDefaultConfig(configPath) {
  const resolved = path.resolve(configPath);
  const body = `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`;

  try {
    await fs.writeFile(resolved, body, { flag: "wx" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Refusing to overwrite existing config: ${resolved}`);
    }
    throw error;
  }

  process.stdout.write(`Created ${path.relative(process.cwd(), resolved) || resolved}\n`);
}

/**
 * @returns {string}
 */
function helpText() {
  return `skill-check ${VERSION}

Local pre-release linting and security checks for assistant skill packages.

Usage:
  skill-check [paths...] [options]

Options:
  --config, -c <path>        Read configuration from a JSON/JSONC file.
  --format <format>         Output format: pretty, json, markdown. Default: pretty.
  --output, -o <path>       Write the report to a file instead of stdout.
  --fail-on <level>         Exit non-zero on error, warn, or off. Default: config value.
  --max-warnings <number>   Exit non-zero when warnings exceed this count.
  --init                    Create a default skill-check.config.jsonc file.
  --version, -v             Print the version.
  --help, -h                Show this help.

Examples:
  skill-check ./skills
  skill-check ./skills --format markdown --output reports/skill-check.md
  skill-check --init
`;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

export { CLI_PATH };
