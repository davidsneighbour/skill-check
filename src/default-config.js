/**
 * Default configuration for skill-check.
 */
export const DEFAULT_CONFIG = Object.freeze({
  include: ["**/SKILL.md"],
  exclude: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/coverage/**"
  ],
  failOn: "error",
  maxFileSizeBytes: 80_000,
  maxBodyLines: 800,
  rules: {
    "skill/file-name": "error",
    "skill/frontmatter-required": "error",
    "skill/name-required": "error",
    "skill/name-format": "error",
    "skill/directory-name-match": "warn",
    "skill/description-required": "error",
    "skill/description-specific": "warn",
    "skill/body-required": "error",
    "skill/body-size": "warn",
    "skill/referenced-files-exist": "error",
    "security/no-secrets": "error",
    "security/no-private-keys": "error",
    "security/no-policy-bypass": "error",
    "security/no-dangerous-shell": "warn",
    "security/network-access-disclosed": "warn",
    "security/no-hardcoded-home-paths": "warn",
    "security/no-sensitive-data-request": "warn",
    "security/no-broad-permissions": "warn",
    "safety/prompt-injection-boundary": "warn",
    "safety/user-consent-for-side-effects": "warn",
    "quality/dependencies-documented": "warn",
    "quality/trigger-precision": "warn",
    "quality/no-hidden-instructions": "warn"
  }
});

export const CONFIG_FILENAMES = Object.freeze([
  "skill-check.config.json",
  "skill-check.config.jsonc",
  ".skill-checkrc",
  ".skill-checkrc.json",
  ".skill-checkrc.jsonc"
]);
