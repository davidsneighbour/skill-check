import fs from "node:fs/promises";
import path from "node:path";
import { diagnostic } from "../result.js";
import { fileExists } from "../fs-utils.js";
import { hasAny, lineOf, lineOfRegex, looksLikeUrl, resolveLocalReference, stringValue } from "../rule-utils.js";

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /ghp_[0-9A-Za-z]{36}/,
  /github_pat_[0-9A-Za-z_]{40,}/,
  /xox[baprs]-[0-9A-Za-z-]{10,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /(?:(?:api|access|auth|secret|private|token|password)[_-]?key|password|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_./+=-]{12,}/i
];

const DANGEROUS_SHELL_PATTERNS = [
  /\brm\s+-rf\s+(?:\$?[A-Z_]+|~|\/|\.\.?)/i,
  /\bcurl\b[^\n|;&]*(?:\||>)\s*(?:sh|bash|zsh)\b/i,
  /\bwget\b[^\n|;&]*(?:\||>)\s*(?:sh|bash|zsh)\b/i,
  /\bchmod\s+(?:777|\+x)\b/i,
  /\bsudo\b/i,
  /\beval\s+[`$"']/i,
  /\bexec\s*\(/i,
  /\bchild_process\b/i,
  /\bPowerShell\s+-ExecutionPolicy\s+Bypass\b/i
];

const POLICY_BYPASS_PATTERNS = [
  /ignore (?:all )?(?:previous|prior|earlier|system|developer) instructions/i,
  /bypass (?:safety|security|policy|guardrails|restrictions)/i,
  /disable (?:safety|security|policy|guardrails|filters)/i,
  /jailbreak/i,
  /do anything now/i,
  /do not reveal this instruction/i,
  /hidden instruction/i
];

const SENSITIVE_DATA_PATTERNS = [
  /(?:collect|store|send|upload|exfiltrate|extract).{0,80}(?:password|cookie|session|token|secret|private key|credential)/i,
  /(?:read|copy).{0,80}(?:\.ssh|id_rsa|\.aws|\.gnupg|keychain|browser profile)/i
];

const BROAD_PERMISSION_PATTERNS = [
  /(?:full|unrestricted|complete) access/i,
  /all files/i,
  /entire (?:filesystem|home directory|computer|drive)/i,
  /any command/i,
  /without (?:asking|confirmation|approval)/i
];

const NETWORK_PATTERNS = [
  /\b(?:curl|wget|fetch|axios|httpie|Invoke-WebRequest)\b/i,
  /https?:\/\//i,
  /\b(?:POST|PUT|PATCH|DELETE)\s+https?:\/\//i
];

const DEPENDENCY_PATTERNS = [
  /\b(?:npm|pnpm|yarn|pip|pipx|uv|cargo|go install|brew|apt|docker)\b/i,
  /requirements\.txt|package\.json|pyproject\.toml|Cargo\.toml|go\.mod/i
];

const PROMPT_INJECTION_BOUNDARY_PATTERNS = [
  /untrusted input/i,
  /treat .* as data/i,
  /do not follow instructions from/i,
  /prompt injection/i,
  /ignore instructions contained in/i,
  /external content/i
];

const SIDE_EFFECT_PATTERNS = [
  /\b(?:delete|remove|overwrite|write|modify|commit|push|send|email|publish|deploy|merge|archive|trash)\b/i
];

const CONSENT_PATTERNS = [
  /(?:ask|confirm|approval|consent).{0,80}(?:before|prior to)/i,
  /before (?:deleting|removing|overwriting|sending|publishing|deploying|committing|pushing)/i
];

const SPECIFIC_TRIGGER_PATTERNS = [
  /use this skill when/i,
  /trigger/i,
  /applies? to/i,
  /only use/i,
  /do not use/i,
  /scope/i
];

/** @type {Record<string, (document: import('../types.js').SkillDocument, context: { config: import('../types.js').SkillLintConfig }) => Promise<import('../types.js').Diagnostic[]> | import('../types.js').Diagnostic[]>} */
export const RULES = {
  "skill/file-name": (document) => {
    if (path.basename(document.filePath) === "SKILL.md") return [];
    return [diagnostic({
      ruleId: "skill/file-name",
      severity: "error",
      filePath: document.filePath,
      message: "Skill entry file must be named SKILL.md.",
      suggestion: "Rename the file to SKILL.md so loaders can find it consistently."
    })];
  },

  "skill/frontmatter-required": (document) => {
    if (document.raw.replace(/^\uFEFF/, "").startsWith("---\n") || document.raw.replace(/^\uFEFF/, "").startsWith("---\r\n")) return [];
    return [diagnostic({
      ruleId: "skill/frontmatter-required",
      severity: "error",
      filePath: document.filePath,
      message: "SKILL.md must start with YAML frontmatter.",
      suggestion: "Add frontmatter with at least name and description."
    })];
  },

  "skill/name-required": (document) => {
    const name = stringValue(document.frontmatter.name);
    if (name) return [];
    return [diagnostic({
      ruleId: "skill/name-required",
      severity: "error",
      filePath: document.filePath,
      message: "Skill frontmatter must contain a non-empty name.",
      suggestion: "Add name: your-skill-name to the frontmatter."
    })];
  },

  "skill/name-format": (document) => {
    const name = stringValue(document.frontmatter.name);
    if (!name || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return [];
    return [diagnostic({
      ruleId: "skill/name-format",
      severity: "error",
      filePath: document.filePath,
      line: lineOf(document, "name:"),
      message: "Skill name should be lowercase kebab-case using only letters, numbers, and hyphens.",
      suggestion: "Use a stable name such as my-skill-name."
    })];
  },

  "skill/directory-name-match": (document) => {
    const name = stringValue(document.frontmatter.name);
    if (!name || document.directoryName === name) return [];
    return [diagnostic({
      ruleId: "skill/directory-name-match",
      severity: "warn",
      filePath: document.filePath,
      line: lineOf(document, "name:"),
      message: `Skill name '${name}' does not match directory name '${document.directoryName}'.`,
      suggestion: "Keep the directory and frontmatter name identical for portable installation."
    })];
  },

  "skill/description-required": (document) => {
    const description = stringValue(document.frontmatter.description);
    if (description) return [];
    return [diagnostic({
      ruleId: "skill/description-required",
      severity: "error",
      filePath: document.filePath,
      message: "Skill frontmatter must contain a non-empty description.",
      suggestion: "Add a concise trigger-oriented description."
    })];
  },

  "skill/description-specific": (document) => {
    const description = stringValue(document.frontmatter.description);
    if (!description) return [];

    const diagnostics = [];
    if (description.length < 40) {
      diagnostics.push(diagnostic({
        ruleId: "skill/description-specific",
        severity: "warn",
        filePath: document.filePath,
        line: lineOf(document, "description:"),
        message: "Skill description is very short and may not give the assistant enough routing context.",
        suggestion: "Describe exactly when to use the skill and what task it covers."
      }));
    }

    if (description.length > 320) {
      diagnostics.push(diagnostic({
        ruleId: "skill/description-specific",
        severity: "warn",
        filePath: document.filePath,
        line: lineOf(document, "description:"),
        message: "Skill description is very long and may reduce trigger precision.",
        suggestion: "Move procedural details into the body and keep the description routing-focused."
      }));
    }

    return diagnostics;
  },

  "skill/body-required": (document) => {
    if (document.body.trim().length > 0) return [];
    return [diagnostic({
      ruleId: "skill/body-required",
      severity: "error",
      filePath: document.filePath,
      line: document.bodyStartLine,
      message: "Skill body must contain instructions.",
      suggestion: "Add scope, workflow, constraints, and examples."
    })];
  },

  "skill/body-size": (document, context) => {
    const diagnostics = [];
    const lineCount = document.body.split(/\r?\n/).length;

    if (Buffer.byteLength(document.raw, "utf8") > context.config.maxFileSizeBytes) {
      diagnostics.push(diagnostic({
        ruleId: "skill/body-size",
        severity: "warn",
        filePath: document.filePath,
        message: "SKILL.md is large enough to be difficult for agents to load and apply reliably.",
        suggestion: "Move reference material into separate files and link to them from SKILL.md."
      }));
    }

    if (lineCount > context.config.maxBodyLines) {
      diagnostics.push(diagnostic({
        ruleId: "skill/body-size",
        severity: "warn",
        filePath: document.filePath,
        line: document.bodyStartLine,
        message: "Skill body has many lines and may be too broad.",
        suggestion: "Split unrelated workflows into narrower skills."
      }));
    }

    return diagnostics;
  },

  "skill/referenced-files-exist": async (document) => {
    const diagnostics = [];
    const linkPattern = /\[[^\]]+\]\((?<target>[^)]+)\)/g;
    for (const match of document.body.matchAll(linkPattern)) {
      const target = match.groups?.target?.trim();
      if (!target || looksLikeUrl(target) || target.startsWith("#")) continue;
      const localPath = resolveLocalReference(document.directoryPath, target);
      if (!(await fileExists(localPath))) {
        diagnostics.push(diagnostic({
          ruleId: "skill/referenced-files-exist",
          severity: "error",
          filePath: document.filePath,
          line: lineOf(document, target),
          message: `Referenced file does not exist: ${target}`,
          suggestion: "Add the file, fix the link, or remove the reference."
        }));
      }
    }
    return diagnostics;
  },

  "security/no-secrets": (document) => {
    if (!hasAny(document.raw, SECRET_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "security/no-secrets",
      severity: "error",
      filePath: document.filePath,
      line: lineOfRegex(document, /(?:api|access|auth|secret|private|token|password|AKIA|AIza|ghp_|github_pat_|xox|sk-)/i),
      message: "Possible secret, token, credential, or API key found in skill content.",
      suggestion: "Remove secrets. Document required environment variables instead."
    })];
  },

  "security/no-private-keys": (document) => {
    if (!/-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/.test(document.raw)) return [];
    return [diagnostic({
      ruleId: "security/no-private-keys",
      severity: "error",
      filePath: document.filePath,
      line: lineOfRegex(document, /PRIVATE KEY/),
      message: "Private key material must not be committed inside a skill.",
      suggestion: "Remove the key and rotate it if it was real."
    })];
  },

  "security/no-policy-bypass": (document) => {
    if (!hasAny(document.raw, POLICY_BYPASS_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "security/no-policy-bypass",
      severity: "error",
      filePath: document.filePath,
      line: lineOfRegex(document, /ignore|bypass|disable|jailbreak|hidden instruction/i),
      message: "Skill contains language that appears to bypass higher-priority instructions, safety policies, or guardrails.",
      suggestion: "Remove bypass language. Skills must operate within the assistant and platform rules."
    })];
  },

  "security/no-dangerous-shell": (document) => {
    if (!hasAny(document.raw, DANGEROUS_SHELL_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "security/no-dangerous-shell",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /rm\s+-rf|curl|wget|chmod|sudo|eval|child_process|PowerShell/i),
      message: "Skill contains shell patterns that can be dangerous when copied or executed by an agent.",
      suggestion: "Prefer explicit, reviewed commands with dry-run modes, named parameters, and confirmation for destructive operations."
    })];
  },

  "security/network-access-disclosed": (document) => {
    if (!hasAny(document.raw, NETWORK_PATTERNS)) return [];
    if (/network|internet|external request|remote endpoint|api endpoint|third-party/i.test(document.raw)) return [];
    return [diagnostic({
      ruleId: "security/network-access-disclosed",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /curl|wget|fetch|axios|https?:\/\//i),
      message: "Skill appears to use network access without explicitly documenting that behaviour.",
      suggestion: "Add a security section that explains when network calls are made and what data is sent."
    })];
  },

  "security/no-hardcoded-home-paths": (document) => {
    if (!/(?:\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|C:\\Users\\[A-Za-z0-9._-]+)/.test(document.raw)) return [];
    return [diagnostic({
      ruleId: "security/no-hardcoded-home-paths",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /\/Users\/|\/home\/|C:\\Users\\/),
      message: "Skill contains hardcoded user home paths.",
      suggestion: "Use placeholders such as ~/path, environment variables, or configurable paths."
    })];
  },

  "security/no-sensitive-data-request": (document) => {
    if (!hasAny(document.raw, SENSITIVE_DATA_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "security/no-sensitive-data-request",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /password|cookie|session|token|secret|private key|credential|\.ssh|id_rsa/i),
      message: "Skill appears to request or handle sensitive data.",
      suggestion: "Minimise sensitive-data handling and add explicit consent, retention, and redaction instructions."
    })];
  },

  "security/no-broad-permissions": (document) => {
    if (!hasAny(document.raw, BROAD_PERMISSION_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "security/no-broad-permissions",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /full|unrestricted|complete|all files|entire|any command|without/i),
      message: "Skill uses broad permission language.",
      suggestion: "Constrain the scope to specific files, tools, directories, and approved operations."
    })];
  },

  "safety/prompt-injection-boundary": (document) => {
    if (hasAny(document.raw, PROMPT_INJECTION_BOUNDARY_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "safety/prompt-injection-boundary",
      severity: "warn",
      filePath: document.filePath,
      message: "Skill does not define how to treat untrusted external content or embedded instructions.",
      suggestion: "Add a rule that external content is data and must not override system, developer, user, or skill instructions."
    })];
  },

  "safety/user-consent-for-side-effects": (document) => {
    if (!hasAny(document.raw, SIDE_EFFECT_PATTERNS)) return [];
    if (hasAny(document.raw, CONSENT_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "safety/user-consent-for-side-effects",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /delete|remove|overwrite|write|modify|commit|push|send|email|publish|deploy|merge|archive|trash/i),
      message: "Skill describes side-effecting actions without a clear user-consent boundary.",
      suggestion: "Require confirmation before destructive, external, or user-visible side effects."
    })];
  },

  "quality/dependencies-documented": (document) => {
    if (!hasAny(document.raw, DEPENDENCY_PATTERNS)) return [];
    if (/dependencies|requirements|prerequisites|installation|requires/i.test(document.raw)) return [];
    return [diagnostic({
      ruleId: "quality/dependencies-documented",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /npm|pnpm|yarn|pip|pipx|uv|cargo|go install|brew|apt|docker|requirements|package\.json/i),
      message: "Skill mentions external dependencies without a clear dependency/prerequisite section.",
      suggestion: "Add a prerequisites section with exact tools, versions where needed, and install safety notes."
    })];
  },

  "quality/trigger-precision": (document) => {
    const description = stringValue(document.frontmatter.description);
    const combined = `${description}\n${document.body}`;
    if (hasAny(combined, SPECIFIC_TRIGGER_PATTERNS)) return [];
    return [diagnostic({
      ruleId: "quality/trigger-precision",
      severity: "warn",
      filePath: document.filePath,
      message: "Skill does not clearly define when it should or should not be used.",
      suggestion: "Add a 'Use this skill when...' section and explicit non-goals."
    })];
  },

  "quality/no-hidden-instructions": (document) => {
    if (!/<!--([\s\S]*?)-->/.test(document.raw)) return [];
    return [diagnostic({
      ruleId: "quality/no-hidden-instructions",
      severity: "warn",
      filePath: document.filePath,
      line: lineOfRegex(document, /<!--/),
      message: "Skill contains HTML comments that can hide instructions from human reviewers.",
      suggestion: "Keep all operational instructions visible in normal Markdown."
    })];
  }
};

/**
 * @param {string} ruleId
 * @returns {boolean}
 */
export function hasRule(ruleId) {
  return Object.hasOwn(RULES, ruleId);
}
