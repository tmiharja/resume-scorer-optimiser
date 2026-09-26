# resume-scorer-optimiser

A free web app that scores a PDF resume and suggests improvements for the Singapore/SEA market. It's hosted on Vercel and powered by Claude.

- [`PLAN.md`](PLAN.md): implementation plan, agent contracts, cost estimate, phase status
- [`architecture.md`](architecture.md): solution architecture
- [`ui-layout.md`](ui-layout.md) and [`mockups/`](mockups/): UI layout, decisions and wireframes

> Status: Phase 3 (agent pipeline). The full setup and deploy guide arrives in Phase 6.

## Local development

Requires Node.js 22.12+.

```bash
npm install
cp .env.example .env.local   # everything is optional locally
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (flat config, Next.js rules, Prettier-compatible) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run format` / `format:check` | Prettier (with Tailwind class sorting) |
| `npm test` | Vitest unit tests (`tests/unit`) |
| `npm run test:e2e` | Playwright e2e (`tests/e2e`) against a production build with `LLM_MOCK=1`; set `CHROMIUM_PATH` to use a local Chromium |
| `npm run fixtures` | Regenerate the synthetic eval fixtures in `evals/fixtures/` (uses Chromium for one pair) |
| `npm run eval` | Eval suite on the **real API** (needs `ANTHROPIC_API_KEY`, ~US$0.50 a run): pass/fail table + total cost. `-- --only=jd-match` for a subset; `EVAL_MOCK=1` for a free plumbing check |
| `npm run check` | lint + typecheck + format check + unit tests |
