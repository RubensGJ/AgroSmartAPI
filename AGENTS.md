# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js/Express API for grain quotation scraping and consultation. Main code is in `src/`.

- Whenever I make relevant changes to behavior, flow, organization, or implementation, I must update this `AGENTS.md` to reflect the new rule or decision.

- `src/app.js`: application bootstrap, routes, and health.
- `src/routes/`: HTTP route definitions.
- `src/services/`: current, historical, and analytical quotation logic.
- `src/scrapers/`: Puppeteer scrapers for Coamo, C.Vale, LAR, and experimental sources.
- `src/database/`: PostgreSQL/Neon access and repositories.
- `src/utils/`: normalization, filtering, date, CSV, and reporting helpers.
- `src/middlewares/`, `src/errors/`, `src/logs/`, `src/jobs/`: request handling, errors, logging, and scheduler logic.
- `scripts/`: operational scripts, currently Chrome installation for Puppeteer.
- `docs/`: technical documentation and generated reports.
- `openapi.yaml`: public API contract.

Behavior decisions:

- `GET /api/cotacoes/todos` must tolerate partial source failures. Return the versioned partial contract with `coamo`, `cvale`, and `larAgro` envelopes containing `ok`, `data`, `stale`, and `error`, instead of failing the whole response when only one source breaks.

There is no dedicated test directory yet. When added, keep tests under `tests/` or `testes/`.

## Build, Test, and Development Commands

- `npm install`: installs dependencies and runs `postinstall` to install Chrome for Puppeteer.
- `npm start`: starts the production server with `node src/app.js`.
- `npm run dev`: starts the API with Node watch mode for local development.
- `npm test`: currently fails intentionally with “no test specified”; do not treat it as a working test suite.
- `npm audit`: checks dependency vulnerabilities.

Use Node.js `>=18`.

## Coding Style & Naming Conventions

Use CommonJS (`require`, `module.exports`) and keep files focused by responsibility. Prefer small services/helpers over large route handlers.

Follow the existing JavaScript style:

- 2-space indentation.
- Semicolons.
- `camelCase` for functions and variables.
- `PascalCase` for classes such as `AppError`.
- Source names: `coamo`, `cvale`, `lar`.

Keep comments short. Avoid dead code and unused scripts.

## Testing Guidelines

No test framework is configured yet. For new tests, focus on:

- price parsing and text normalization;
- filtering and best-price comparison;
- repository persistence behavior;
- scraper error handling and retry behavior.

Name tests after the unit or behavior: `normalization.test.js`, `currentCotacaoService.test.js`.

## Available MCPs

Neon and Render MCPs are available for this repository. Use them when database, hosting, deployment, or environment context is needed.

## Commit & Pull Request Guidelines

Recent history uses short conventional-style commits:

- `feat: adiciona scraper da C.Vale...`
- `docs: levantamento tecnico Codex`
- `feat: refatora middleware...`

Prefer concise commits with clear scope. Pull requests should include:

- what changed;
- why it changed;
- affected endpoints or environment variables;
- verification steps;
- sample responses when API output changes.

## Security & Configuration Tips

Never commit `.env` or credentials. Use `.env.example` for documented variables. Sensitive runtime values include `DATABASE_URL`, API tokens, scheduler flags, and Puppeteer settings.

Be careful with `force=true`: it can trigger live scraping, browser startup, external site traffic, and database writes.
