# skill-check

Local pre-release linting and security checks for assistant skill packages.

The package exposes a CLI named `skill-check`. It checks `SKILL.md` files for format issues, risky language, missing guardrails, broken local references, broad permissions, possible secrets, dangerous shell patterns, and other common release blockers.

## Why this exists

Installer-side “Security Risk Assessments” are useful, but they are not a complete local release gate. This tool gives you deterministic checks that can run before publishing, in pull requests, and in CI.

See [`RESEARCH.md`](./RESEARCH.md) for the research notes and [`docs/checklist.md`](./docs/checklist.md) for the full release checklist.

## Usage

```bash
npx skill-check ./skills
```

Generate reports:

```bash
npx skill-check ./skills --format markdown --output reports/skill-check.md
npx skill-check ./skills --format json --output reports/skill-check.json
```

Create a config file:

```bash
npx skill-check --init
```

Run from this repository:

```bash
npm test
npm run check
node src/cli.js examples/valid-skill
node src/cli.js examples/risky-skill --fail-on off
```

## Configuration

`skill-check` reads one of these files from the current working directory:

- `skill-check.config.json`
- `skill-check.config.jsonc`
- `.skill-checkrc`
- `.skill-checkrc.json`
- `.skill-checkrc.jsonc`

Example:

```jsonc
{
  "$schema": "./schemas/skill-check.schema.json",
  "include": ["**/SKILL.md"],
  "exclude": ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  "failOn": "error",
  "rules": {
    "security/no-dangerous-shell": "warn",
    "safety/prompt-injection-boundary": "warn",
    "quality/trigger-precision": "warn"
  }
}
```

## CLI

```bash
skill-check [paths...] [options]
```

Options:

- `--config, -c <path>`: read configuration from a JSON/JSONC file.
- `--format <format>`: `pretty`, `json`, or `markdown`.
- `--output, -o <path>`: write the report to a file.
- `--fail-on <level>`: `error`, `warn`, or `off`.
- `--max-warnings <number>`: fail when warnings exceed this count.
- `--init`: create a default config file.
- `--version, -v`: print the version.
- `--help, -h`: show help.

## Implemented rules

### Skill structure

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

### Security and safety

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

### Quality

- `quality/dependencies-documented`
- `quality/trigger-precision`
- `quality/no-hidden-instructions`

## CI example

```yaml
name: Skill lint

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  skill-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
        with:
          persist-credentials: false
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: 24
      - run: npm ci
      - run: npx skill-check ./skills --format markdown --output reports/skill-check.md
```

## Recommended companion checks

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

## Design notes

This scaffold deliberately uses only Node.js built-ins at runtime. That keeps the first local check lightweight and reduces supply-chain risk for the linter itself. For deeper checks, wire specialised tools into CI as described in `RESEARCH.md`.
