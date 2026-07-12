# project-scaffolding Specification

## Purpose
TBD - created by archiving change ab-1001-project-scaffolding. Update Purpose after archive.
## Requirements
### Requirement: Pinned, reproducible dependency installation
The workspace SHALL install cleanly with every dependency pinned to an exact version. No `^`, `~`, or `@latest` ranges are permitted anywhere in any `package.json`, and `save-exact=true` MUST be enforced via `.npmrc` so future installs stay pinned. Installed dependencies MUST report zero high or critical advisories.

#### Scenario: Fresh install succeeds with exact pins (AC1)
- **WHEN** a developer runs `pnpm install` on a clean checkout
- **THEN** installation succeeds and every version in every `package.json` is exact (no `^`/`~`/`@latest`)

#### Scenario: save-exact keeps future adds pinned (AC1)
- **WHEN** any package is added with `pnpm add`
- **THEN** it is written to `package.json` as an exact version because `.npmrc` sets `save-exact=true`

#### Scenario: No high or critical vulnerabilities (AC8)
- **WHEN** `pnpm audit --audit-level=high` is run
- **THEN** it reports 0 high and 0 critical advisories

### Requirement: Clean strict-TypeScript build across all packages
`pnpm build` SHALL compile every workspace package with zero errors and zero warnings. TypeScript strict mode MUST be enabled repo-wide via `tsconfig.base.json`, and a deliberate type error MUST fail the build (proving strict mode is active, not merely configured).

#### Scenario: Build is clean (AC2)
- **WHEN** `pnpm build` is run across the monorepo
- **THEN** it completes with 0 errors and 0 warnings for all packages

#### Scenario: Strict mode rejects a type error (AC10)
- **WHEN** a deliberate type error is introduced into any package's source
- **THEN** `pnpm build` fails with a TypeScript error

### Requirement: Lint and format gates are clean at zero tolerance
`pnpm lint --max-warnings 0` SHALL report no errors or warnings across the monorepo, and `pnpm format:check` SHALL report no formatting deviations. ESLint format rules that conflict with Prettier MUST be disabled via `eslint-config-prettier`.

#### Scenario: Lint is clean at max-warnings 0 (AC3)
- **WHEN** `pnpm lint --max-warnings 0` is run
- **THEN** it exits successfully with no errors and no warnings

#### Scenario: Formatting is consistent (AC4)
- **WHEN** `pnpm format:check` is run
- **THEN** it reports every file already conforms to Prettier

### Requirement: Test harness runs green with coverage reporting
`pnpm test` SHALL run the Vitest suite green, with at least one passing test per package, and MUST produce coverage output wired for the ≥80% gate.

#### Scenario: Tests pass and coverage is produced (AC5)
- **WHEN** `pnpm test` is run
- **THEN** all tests pass and a coverage report is generated

### Requirement: Unused-code detection is clean
`pnpm knip` SHALL report no unused files, exports, or dependencies across the workspace.

#### Scenario: Knip finds nothing unused (AC6)
- **WHEN** `pnpm knip` is run
- **THEN** it reports zero unused files, zero unused exports, and zero unused dependencies

### Requirement: Git hooks enforce commit quality
Husky-managed git hooks SHALL enforce commit and content standards locally. A commit message that violates Conventional Commits MUST be rejected by commitlint, a planted secret MUST be blocked by gitleaks, and staged files MUST be linted and formatted by lint-staged in the pre-commit hook.

#### Scenario: Non-conventional commit message is rejected (AC7)
- **WHEN** a commit is attempted with a message that is not a valid Conventional Commit
- **THEN** commitlint rejects the commit

#### Scenario: Planted secret is blocked (AC7)
- **WHEN** a commit is attempted that contains a detectable secret or credential
- **THEN** gitleaks blocks the commit

#### Scenario: Staged files are linted on commit (AC7)
- **WHEN** files are staged and a commit is attempted
- **THEN** lint-staged runs ESLint and Prettier on only the staged files before the commit proceeds

### Requirement: Shared package is importable from both apps
The `@app/shared` package SHALL be resolvable from both `backend` and `frontend` via the pnpm workspace protocol, verified by a placeholder import in each.

#### Scenario: Backend imports @app/shared (AC9)
- **WHEN** `backend` imports a symbol from `@app/shared`
- **THEN** the import resolves and `backend` builds successfully

#### Scenario: Frontend imports @app/shared (AC9)
- **WHEN** `frontend` imports a symbol from `@app/shared`
- **THEN** the import resolves and `frontend` builds successfully

### Requirement: Local Postgres provides dev and test databases
`docker compose up` SHALL start PostgreSQL 16 exposing a separate development database and a separate test database, each reachable via a `DATABASE_URL`.

#### Scenario: Postgres 16 starts with both databases reachable (AC11)
- **WHEN** `docker compose up` is run
- **THEN** PostgreSQL 16 is running and both the dev and test databases are reachable via their `DATABASE_URL`s

### Requirement: Bare Prisma client generates
Prisma SHALL be installed with a `schema.prisma` containing only datasource and generator blocks (no models). `prisma generate` MUST succeed against this bare schema so client generation works from day one.

#### Scenario: prisma generate succeeds against the bare schema (AC12)
- **WHEN** `prisma generate` is run against the bare `schema.prisma`
- **THEN** it succeeds and produces a Prisma client with no models defined

### Requirement: Continuous integration runs the full gate on every PR
A GitHub Actions workflow SHALL run install → build → lint → format:check → test → gitleaks on every pull request and MUST pass on a well-formed change.

#### Scenario: CI pipeline runs and passes on a PR (AC13)
- **WHEN** a pull request is opened
- **THEN** the workflow runs install, build, lint, format:check, test, and gitleaks in order and passes

### Requirement: Automated dependency updates are configured
A Dependabot configuration SHALL be present covering the `npm` and `github-actions` ecosystems.

#### Scenario: Dependabot config covers both ecosystems (AC14)
- **WHEN** `.github/dependabot.yml` is inspected
- **THEN** it declares update configuration for both the `npm` and `github-actions` ecosystems

