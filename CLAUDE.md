# Cabinet Planner

Local web app that designs Y's rolling OSB workshop tool cabinets in a 3D shop layout and
nests the cut plan onto the stock on hand. Browser-only; state lives in `localStorage`.

## The skill is the manual — keep it current

`skill/` is the living operating manual for this app (symlinked to
`~/.claude/skills/cabinet-planner`). **Read `skill/SKILL.md` before working here.**
Any change to behaviour, formulas, data model, construction rules, UI or tooling **must
update the skill in the same commit**. Anything learned the hard way goes into
`skill/references/traps.md`. A doc that lags the code is worse than none, because it
will be trusted.

## Commands

Node is only available via nvm — prefix shells with
`export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"`.

- `./start` — starts the dev server (nvm PATH included) and opens the browser
- `npm run dev` — dev server on http://127.0.0.1:5188 (strict port, IPv4)
- `npm test` — engine + store unit tests (vitest)
- `npm run build` — typecheck + production build
- `npm run shot` — Playwright screenshots of both tabs into `shots/` (needs dev server)

## Working rules

- Commit each feature as it's finished, one atomic commit, message says what and why.
- Engine (`src/engine/`) stays pure and tested; UI never computes geometry itself.
- Spec: `docs/specs/2026-09-26-cabinet-planner-design.md`; plan: `docs/plans/`.
