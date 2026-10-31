# RoutineGap — Codex agent instructions

You are working in the **actual public GitHub repository** `betterlifestyle04-commits/routinegap-youcam`, not the earlier empty/unborn checkout. Its default branch is `main`. The initial complete application was committed on 2026-10-31. If your existing Codex workspace says "no refs" or the `work` branch is unborn, **refresh/recreate the workspace from `origin/main`**; do not create a new project in an empty checkout.

## Setup (no package installation or external paid API required)

Requires Node.js **22+**. This small app intentionally has no production or dev package dependencies, so `npm ci` is not necessary and may be skipped.

```bash
git fetch origin main
git switch main
git pull --ff-only origin main
node --version
npm run check
npm test
npm start
```

Open `http://localhost:3000`. In Codex/cloud preview environments, expose local port **3000**. To develop with automatic restart use `npm run dev`. `npm start` works without credentials and displays a **clearly labeled illustrative demo**.

If a fresh workspace starts with `git branch --show-current` returning `work` and `git show-ref` showing no refs, **stop and reinitialize the Codex workspace using the current GitHub `main` branch**. Do not run `git init`, fabricate a README, or commit into the unborn branch; the upstream repository already contains a complete application.

## Project structure

- `package.json` — `start`, `dev`, `check`, `test`; Node 22 ESM, no external packages.
- `server.js` — HTTP server, static routes, opt-in YouCam proxy and demo access controls.
- `public/index.html`, `public/styles.css`, `public/app.js` — frontend and client interactions.
- `src/recommendations.js` + `public/recommendations.js` — deterministic shelf and budget-aware shopping logic. If changing the engine, update both versions consistently; ensure tests cover any changed output.
- `src/youcam.js` — real Perfect Corp YouCam Skin Analysis adapter: file metadata, signed upload, task initiation, status polling.
- `test/` — Node built-in test runner and endpoint tests.
- `render.yaml`, `.env.example` — deployment guidance. README documents user setup, official deadline and Devpost checklist.

## Implementation priorities

1. Preserve a **working, responsive and judge-friendly** frontend with functional inventory, budgets, sample workflow, decision trail and clear status messages.
2. Do not misrepresent illustrative skin-scan example data, imaginary product catalog, or recommendations as medical advice, real sales or live provider responses.
3. The competition requires a **real runtime call** to the Perfect Corp YouCam API. Maintain the actual adapter, make progress/error handling robust, and clearly distinguish `configured` from `verified live`. Real API success is currently unverified until the owner configures a private key and consents to a test.
4. Keep skin photos private; require explicit user consent, cap image size and validate type, protect signed upload hosts, and never log images, signed upload URLs or API keys.
5. Avoid changing deployment architecture to distributed/serverless instances without replacing the current in-memory rate limits/task map with durable shared storage. For now, a single-instance Node deployment is safest.

## Secrets and paid requests

`YOUCAM_API_KEY`, `DEMO_ACCESS_TOKEN`, `LIVE_SCANS_ENABLED`, `PUBLIC_ORIGIN` are **server-side only**. `.env.example` is safe and intentionally contains blank values. Never commit secrets, prepaid code, selfies or real scan results to the repo. `LIVE_SCANS_ENABLED=false` by default. The public demo must work without provider keys and must not silently return mock data as if from YouCam.

Do not spend the user's free API units on automated tests; use deterministic mocked fetch responses for tests and request owner approval before an actual paid scan. Do not assert the live integration is tested when only mocks have passed.

## Before each PR / change

```bash
npm run check
npm test
```

Optional local HTTP smoke check: start `npm start`, visit `http://localhost:3000`, and request `http://localhost:3000/api/status`. Without configured credentials it should return a status that **explicitly says live scans are disabled**. Never use a fake image or a fabricated success verdict as a "live API test."

Prefer small, reviewable commits and explain what is actually tested versus unverified. Do not claim a deployment or Devpost submission that has not been confirmed by its real provider.

## If Codex's source checkout still appears empty

The error **"repository source exposes no Git refs"** refers to an earlier state. Verify GitHub has `refs/heads/main` and `package.json`:

- https://github.com/betterlifestyle04-commits/routinegap-youcam/tree/main
- https://github.com/betterlifestyle04-commits/routinegap-youcam/blob/main/package.json

Then in Codex, reopen/reselect this repo, choose `main` as the base branch, and **create a new task/environment**. Existing tasks may retain the stale initial snapshot.
