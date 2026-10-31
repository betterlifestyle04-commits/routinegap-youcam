# RoutineGap — 2026 YouCam hackathon submission guide

**Submission deadline:** November 2, 2026 at 11:45 a.m. EST = 17:45 CET (Oslo). Winners announced around November 24.

## Pitch

Skincare shoppers often buy another product before checking what they already own. RoutineGap puts users' existing shelves first. It combines an actual Perfect Corp YouCam Skin Analysis API workflow with a user-managed inventory, explainable routine-gap analysis, budget limits, and a shopping studio that actively discourages redundant purchases. It labels YouCam cosmetic observations, user preferences, and app-driven heuristics separately. It is not a medical diagnosis, an efficacy claim, or a live store checkout.

## Demo storyline (target 2 minutes 30 seconds)

| Time | Show the real app | Message |
| --- | --- | --- |
| 0:00–0:20 | Overview | Buy less, choose with more intention |
| 0:20–0:45 | My Shelf; add or remove an owned product | Existing products matter before the next purchase |
| 0:45–1:20 | Live selfie consent + actual YouCam scan **if configured and verified** | Perfect Corp Skin Analysis provides cosmetic signals, not diagnoses |
| 1:20–1:55 | Shopping studio goal, budget, filters, duplicate/skip labels | Deterministic rules explain what to keep, buy or skip |
| 1:55–2:20 | Decision trail | Vendor output versus user goals versus heuristics |
| 2:20–2:30 | Public GitHub, API docs | Open-source implementation, honest limits |

**Never present illustrative sample data as live YouCam API results.** If the live key is still unavailable, upload a shorter demo of real shelf/shop functionality, but recognize that the official eligibility pass/fail requires a genuinely functioning YouCam API integration. It is essential to run a live scan before submitting.

## Submission tasks

- [x] Functional code and explainable client-side shopping engine
- [x] Real provider workflow coded for file upload, skin-analysis task creation and polling
- [x] Tests for recommendation behavior and the provider integration boundary
- [ ] Upload package into a new **public GitHub repository**; include the MIT license and README
- [ ] Redeem 1,000 free API units in your YouCam API account
- [ ] Set YouCam API key and a private demo passcode as server environment variables (NOT in client code)
- [ ] Deploy Node server to Render or another host supporting Node HTTP servers; test at the public URL
- [ ] Perform at least one genuine consented YouCam scan and verify vendor responses
- [ ] Capture screenshots of overview, inventory, scan result and shopping studio
- [ ] Record and publicly upload a 1–3-minute demo video showing the actual functioning website and YouCam integration
- [ ] Enter text description, public repo, screenshots and video URL in Devpost
- [ ] For the student-only **Rising Star Award**, provide a valid institutional student email and confirm eligibility
- [ ] Finalize submission before November 2, 2026 at 17:45 Oslo

## GitHub repository creation

On GitHub, click **New repository**, choose `routinegap-youcam` and set it **Public**. Do not initialize with a separate README if you plan to upload this whole project. Extract the ZIP and upload the files to the repository root, including `.github/workflows/validate.yml`, `LICENSE`, `public/`, `src/` and `test/`. Never upload `.env`. Alternatively, use `git init && git add . && git commit -m "Build RoutineGap MVP" && git branch -M main && git remote add origin https://github.com/YOUR_USERNAME/routinegap-youcam.git && git push -u origin main` after creating the repository.

## Hosting

Render can read `render.yaml` from your public GitHub project. Set `YOUCAM_API_KEY`, `DEMO_ACCESS_TOKEN`, `LIVE_SCANS_ENABLED=true` and `PUBLIC_ORIGIN` in the deployment's environment settings. Choose a single-instance Node deployment so the demo's in-memory scan budgets and task state stay consistent. For multi-instance production use, add a shared rate limiter/task store. There is no safe unrestricted public paid YouCam endpoint in this starter.

**Do not put your YouCam API key or the free-credit redeem code in Devpost source files.** Provide the *separate demo passcode* privately in the judges' testing instructions, if necessary.

Official rules: https://youcam-api-skin-ai-ecommerce.devpost.com/rules
YouCam Skin API reference: https://docs.perfectcorp.com/reference/ai_skin_analysis
