# Research: auditing assistant skills before release

## Executive summary

The current public ecosystem does not appear to expose a stable local command that reproduces the exact “Security Risk Assessments” section shown during `npx skills add`. Prior research found that report to be presented as remote assessment data, including labels such as “Gen”, “Socket”, and “Snyk”, and that failures in fetching the assessment were treated as non-blocking. Treat that install-time section as a registry or installer-side signal, not as the only release gate.

The practical local approach is therefore a layered audit pipeline:

1. Validate skill format and metadata.
2. Lint `SKILL.md` for skill-specific “smells”.
3. Scan for secrets, dangerous commands, hidden instructions, policy-bypass language, broad permissions, and prompt-injection weaknesses.
4. Run dependency and supply-chain checks for any code shipped with the skill.
5. Run behavioural tests and prompt-based evaluations for high-risk workflows.
6. Generate release evidence in CI before publishing.

This repository scaffolds the first layer as `skill-check`: a local CLI for fast, repeatable skill checks. It is not a substitute for official installer/registry assessments, Socket, Snyk, Semgrep, CodeQL, Trivy, Gitleaks, or manual review.

## Relevant ecosystem signals

### `SKILL.md` has become an operational artifact

Recent research treats `SKILL.md` as more than documentation. It is routing metadata, behavioural instruction, and in many ecosystems the main surface that determines whether a skill is found, selected, trusted, and loaded.

Useful research references:

- “From Anatomy to Smells: An Empirical Study of SKILL.md in Agent Skills” observed skill authoring patterns and introduced the idea of detectable skill smells. Source: https://arxiv.org/abs/2607.01456
- “Under the Hood of SKILL.md: Semantic Supply-chain Attacks on AI Agent Skill Registry” studied semantic supply-chain attacks against skill registry discovery, selection, and governance. Source: https://arxiv.org/abs/2605.11418
- “Malicious Or Not: Adding Repository Context to Agent Skill Classification” argues that repository context reduces false positives compared with scanning only the skill description. Source: https://arxiv.org/abs/2603.16572
- “Skilldex: A Package Manager and Registry for Agent Skill Packages with Hierarchical Scope-Based Distribution” describes compiler-style format conformance scoring for skill packages. Source: https://arxiv.org/abs/2604.16911

### The exact installer risk section is not enough

The “Security Risk Assessments” section shown by `npx skills add` is useful as an install-time warning, but there are three practical limitations for release engineering:

- It is not currently documented as a standalone public local command.
- It depends on remote assessment sources and can fail independently of local skill quality.
- It is a point-in-time signal. It does not replace deterministic checks in the repository.

The release process should therefore produce its own auditable evidence locally and in CI.

## Threat model for assistant skills

Common risks to cover before releasing a skill:

- Prompt injection in external content, repository files, web pages, emails, tickets, PDFs, or logs.
- Skill text that asks the assistant to ignore higher-priority instructions or bypass safety rules.
- Overbroad tool or file-system scope.
- Destructive actions without user consent.
- Exfiltration of credentials, source code, private documents, calendar/email data, or tokens.
- Dangerous shell commands copied into instructions or helper scripts.
- Unclear network access or hidden third-party endpoints.
- Supply-chain risk from npm, Python, Docker, GitHub Actions, or MCP dependencies.
- Misleading skill descriptions that over-trigger or route unrelated tasks into the skill.
- Hidden operational instructions in comments, encoded text, generated files, or obscure references.
- Broken local file references that cause assistants to improvise missing context.

## Proposed local lint and audit layers

### Layer 1: skill format and authoring lint

Implemented by this package:

- `skill/file-name`
- `skill/frontmatter-required`
- `skill/name-required`
- `skill/name-format`
- `skill/directory-name-match`
- `skill/description-required`
- `skill/description-specific`
- `skill/body-required`
- `skill/body-size`
- `skill/referenced-files-exist`
- `quality/trigger-precision`
- `quality/dependencies-documented`
- `quality/no-hidden-instructions`

### Layer 2: skill security lint

Implemented by this package:

- `security/no-secrets`
- `security/no-private-keys`
- `security/no-policy-bypass`
- `security/no-dangerous-shell`
- `security/network-access-disclosed`
- `security/no-hardcoded-home-paths`
- `security/no-sensitive-data-request`
- `security/no-broad-permissions`
- `safety/prompt-injection-boundary`
- `safety/user-consent-for-side-effects`

### Layer 3: general repository security

Recommended external tools:

```bash
npm audit --audit-level=high
npm audit signatures
gitleaks dir .
osv-scanner .
trivy fs .
syft dir:. -o cyclonedx-json > sbom.cyclonedx.json
grype sbom:sbom.cyclonedx.json
semgrep scan --config semgrep/assistant-skill.yml
```

### Layer 4: language-specific checks

Use only the checks that fit the repository:

```bash
npx eslint .
npx biome check .
ruff check .
pyright
bandit -r .
```

### Layer 5: infrastructure and CI policy

Recommended tools:

```bash
checkov -d .
conftest test .
zizmor .github/workflows
```

Important CI rules:

- Pin GitHub Actions by commit hash where practical.
- Use `persist-credentials: false` on `actions/checkout`.
- Keep publishing tokens out of pull-request workflows.
- Generate a machine-readable `skill-check --format json` report as an artifact.

### Layer 6: MCP-specific checks

If a skill installs, configures, or depends on MCP servers, add MCP-specific checks:

- Validate tool schemas.
- Run MCP Inspector against local servers.
- Review tool descriptions for hidden side effects.
- Check OAuth callback and token handling.
- Confirm destructive tools require consent.
- Confirm servers run with least privilege.

### Layer 7: behavioural and prompt testing

Recommended tools and methods:

- `node --test`, Vitest, Jest, pytest, or equivalent for code helpers.
- Promptfoo or a custom fixture runner for instruction-following tests.
- Red-team fixtures containing malicious file content, prompt injection, misleading task text, and untrusted web/email content.
- Golden-output fixtures for normal tasks.
- Regression tests for previously observed agent mistakes.

## Suggested release gate

A practical pre-release command sequence for a Node-based skill repository:

```bash
npm ci
npx skill-check ./skills --format markdown --output reports/skill-check.md
npx skill-check ./skills --format json --output reports/skill-check.json
npm audit --audit-level=high
npm audit signatures
gitleaks dir .
osv-scanner .
trivy fs .
semgrep scan --config semgrep/assistant-skill.yml
npm test
```

For repositories with Python or Docker components, extend this with `ruff`, `pyright`, `bandit`, `syft`, `grype`, and image scanning.

## Known gaps

- The exact `npx skills add` risk report is not currently reproducible locally through a known public command.
- Natural-language skill checking cannot prove benign behaviour. It catches patterns, smells, and missing guardrails.
- Regex-based secret scanning should be backed by Gitleaks or an equivalent specialised tool.
- Prompt-injection resilience requires behavioural testing, not only static linting.
- Repository context matters. A suspicious sentence in `SKILL.md` may be benign in context, while a clean `SKILL.md` can still hide risky helper code.
- Registry ranking, semantic selection, and governance evasion are difficult to test locally without reproducing the registry/agent selection mechanism.

## Naming taxonomy for checks

Use these terms consistently in scripts and docs:

- `check`: all non-mutating quality gates.
- `lint`: static analysis, style, conventions, and authoring smells.
- `validate`: exact contract, schema, or policy conformance.
- `format`: canonical formatting.
- `test`: behavioural correctness.
- `audit`: security, dependency, performance, or risk inspection.

`lint-staged` is a runner, not a category.
