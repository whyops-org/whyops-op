# Contributing to WhyOps

Thanks for contributing.

## What We Welcome

- Bug fixes
- UI and UX improvements
- SDK and integration work
- Docs updates
- Tests and reliability improvements
- Performance work with clear measurements

## Before You Start

1. Search existing issues and pull requests first.
2. If the change is large, open an issue or discussion before writing a lot of code.
3. Keep changes focused. One PR should solve one problem well.

## Local Setup

```bash
npm ci
npm run hooks:install
cp .env.example .env
npm run db:migrate
npm run dev
```

Services:

- `app` on `:3000`
- `whyops-proxy` on `:8080`
- `whyops-analyse` on `:8081`
- `whyops-auth` on `:8082`

## Development Standards

- Use Node.js ESM only.
- Keep files small and focused. Prefer staying under 200 lines per file.
- Reuse existing code before adding new abstractions.
- Validate external input with `zod`.
- Keep controllers thin and business logic in services.
- Keep DB logic in repositories/models.
- Use structured logs and never log secrets.
- Delete dead code instead of leaving it around.

## Frontend Expectations

- Do not introduce unnecessary scrolling or cramped layouts.
- Preserve the existing visual system unless the task is explicitly a redesign.
- Favor deliberate spacing, alignment, and readable empty states.
- Use real icons and assets where the product already expects them.

## Pull Request Checklist

- The change is scoped and easy to review.
- New behavior is tested or manually verified.
- Lint, typecheck, and relevant builds pass locally.
- README or docs are updated if behavior changed.
- Environment requirements are reflected in `.env.example` when needed.
- Migrations are additive and backwards compatible.

## Commits

- Use clear commit messages.
- Do not mix unrelated refactors into a feature or fix PR.
- If hooks changed generated files such as the web version, include them in the commit.

## Brand and Attribution

- You can contribute code under the repository license.
- If you publish a fork, do not present it as the official WhyOps project.
- Do not use the WhyOps name or logo for your forked product branding unless you have permission.
- See [TRADEMARKS.md](TRADEMARKS.md) for brand usage guidance.

## Submission of Contributions

Unless you explicitly state otherwise, any contribution you submit for inclusion in WhyOps is provided under the same license as this repository.

## Need Help?

Open an issue with:

- what you are trying to change
- current behavior
- expected behavior
- screenshots or traces if relevant
- reproduction steps
