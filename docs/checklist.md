# Assistant skill pre-release checklist

This checklist is intentionally broader than `skill-check`. Use the CLI for fast local feedback and use the extra tools in CI for deeper assurance.

## Format and metadata

- `SKILL.md` exists in each skill directory.
- YAML frontmatter is present and parseable.
- `name` is lowercase kebab-case and matches the directory name.
- `description` is specific enough for routing and not a procedure dump.
- The body defines scope, workflow, constraints, non-goals, and examples.
- All local links and referenced support files exist.

## Security

- No secrets, keys, tokens, cookies, passwords, or private keys are committed.
- External dependencies are documented with versions where relevant.
- Network access is documented: endpoint, purpose, data sent, and failure mode.
- Dangerous shell commands require review, dry-run support, and confirmation.
- No unbounded file-system access such as “all files” or “entire home directory”.
- Side-effecting actions require explicit user approval.
- Generated commands use named parameters and safe defaults.

## Prompt safety

- The skill states that untrusted input is data, not instruction.
- The skill never tells the assistant to ignore system, developer, user, platform, or policy instructions.
- Instructions are visible in Markdown, not hidden in comments or encoded blobs.
- The skill includes refusal or escalation behaviour for unsupported or risky requests.

## Supply-chain and dependencies

- Run `npm audit --audit-level=high` for Node packages.
- Run `npm audit signatures` when npm signatures are relevant.
- Run OSV-Scanner across the repository.
- Run Socket/Snyk where available for package behaviour and vulnerability review.
- Generate an SBOM with Syft and scan it with Grype.
- Run Gitleaks before publishing.

## Code and infrastructure

- Run ESLint/Biome for JavaScript and TypeScript.
- Run Ruff/Pyright/Bandit for Python helper scripts.
- Run Semgrep or CodeQL for cross-language static analysis.
- Run Checkov and/or Conftest/OPA for CI, Docker, and infrastructure policy checks.
- Run Trivy on the repository and container images.

## MCP-specific checks

- Validate MCP tool schemas if the skill ships or controls MCP tooling.
- Use MCP Inspector against local MCP servers.
- Confirm OAuth/client credentials are not bundled in the skill.
- Confirm tool descriptions do not overclaim permissions or hide side effects.
- Require consent for destructive MCP tools.

## Testing

- Add fixtures for valid and intentionally risky skills.
- Test that valid fixtures pass without errors.
- Test that risky fixtures produce expected diagnostics.
- Test CLI exit codes for error, warn, and off modes.
- Add prompt-based evaluation with promptfoo or an equivalent harness for high-risk skills.
