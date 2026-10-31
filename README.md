# RoutineGap — Your shelf first. Shop smarter.

A functional skincare shopping-intelligence web app built for the **YouCam API Skin AI & eCommerce VTO Hackathon 2026**. **Don't buy another serum before you check your shelf.**

## What works now

- Premium responsive dashboard and navigation
- User-managed skincare inventory (create/remove/reset), stored locally in browser only
- Explainable shopping recommendations: use what you own, avoid duplicate routine steps, fill only missing essentials
- Budget and fragrance-free preferences; transparent illustrative catalog, non-functional checkout (intentionally no fake store)
- Shopping cart, cost and budget accounting, readable decision trail
- Clearly labeled sample scan; **it never masquerades as a real YouCam result**
- Server-side **real Perfect Corp YouCam Skin Analysis v2.0 integration** using the documented File API (presigned upload), skin-analysis task submission and task-status polling
- Privacy-first consent gate and a protected live-demo access code; no saved selfies or medical claims
- No external runtime dependencies; built for Node.js 22 and portable deployment; unit + HTTP smoke tests
- In-app **photo readiness guide**, including an illustrated good-versus-bad example, exact SD image pixel/file-size requirements, framing and lighting checklist, and validated external editing links. The app checks resolution locally and again on the server **before** contacting YouCam; no AI upscaling or photo submission occurs merely because the user selects a file.

## Photo requirements and useful tools

Our YouCam integration uses **standard-definition (SD)** Skin Analysis V2.0. A photo must be a JPEG/PNG with **short side >=480 px** and **long side <=2,560 px**. RoutineGap caps uploads at **8 MB** (stricter than the provider's 10 MB). Ideal demo examples are **720 × 960 px** or **960 × 1,280 px**, straight-on and evenly lit, with the forehead and skin visible, no glasses or heavy makeup. A **236 × 354 px** thumbnail is unsuitable.

- For a photo that is **too small or blurry**, retrieve the full-resolution original from your phone or photo library, or retake it with the camera. Increasing the pixel count of a tiny image cannot restore missing skin features, and AI upscaling may invent features.
- For a **good-quality photo that is too large**, downsize while preserving the aspect ratio and the entire face. Check both pixel dimensions afterward.
- [Photopea](https://www.photopea.com/) — **Image → Image Size** to inspect and reduce dimensions; see their [official tutorial](https://www.photopea.com/learn/image-size).
- [Squoosh](https://squoosh.app/) — browser-local image resize/compression for oversized originals. Do not use beautification or generative retouching for analysis.

The Skin Analysis page includes a locally hosted [accessible illustration](public/scan-photo-examples.svg) and practical guidance. Illustration images are *not* real scan inputs and results are never faked. Source: [Perfect Corp official Skin Analysis file specifications](https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/file-specs-and-errors).

### Current verified deployment

- Public demo: https://routinegap-youcam.onrender.com/
- API key: **authenticated** by Perfect Corp's free balance endpoint on October 31, 2026, after a fresh credential was configured in Render.
- Full skin analysis: **not yet verified on a consented, eligible image**; this remains required for the final hackathon validation. Do not describe sample data as a real scan.
- Keep the protected demo passcode private and give judges legitimate controlled access through Devpost testing instructions. Do not put credentials in screenshots, video captions, or GitHub.

## Work on this project in Codex

The source is committed on the public **`main`** branch. If Codex previously showed an empty, unborn `work` checkout or "no Git refs", that was from the repository's initial empty state. **Create a new Codex task based on `main` or recreate/refresh the environment**; do not initialize a second repository.

For a fresh Codex environment, use **Node.js 22**, run `npm run check && npm test`, and start with `npm start` (port **3000**). No `npm install`, database, API key, or `.env` is required to preview the sample mode. The real YouCam scan remains unavailable until the owner configures the server-side credentials.

See [AGENTS.md](AGENTS.md) for the full setup recipe, repository structure, security rules and recovery steps.

## Local setup

```bash
node --version  # Node 22+
cp .env.example .env
# Environment variables in .env are NOT automatically loaded unless Node is launched with --env-file=.env
npm test
node --env-file=.env server.js
```

Without a key, run `npm start` to explore the functioning demo at http://localhost:3000. **Live YouCam API calls are disabled, not simulated.**

## Activate live YouCam analysis

1. Go to [Perfect Corp YouCam API](https://yce.perfectcorp.com/ai-api); register and verify email.
2. Redeem the **1,000 free units** from your private October 27 Devpost email under **Account → Redeem Code**. Never commit the redeem code or API credentials.
3. Create an API key in your [YouCam console](https://yce.makeupar.com/api-console/en/api-keys/).
4. Put secrets in your hosting service's server-only Environment Variables, or a local untracked `.env` file:

```env
YOUCAM_API_KEY=<your private YouCam key>
DEMO_ACCESS_TOKEN=<long unpredictable secret you choose>
LIVE_SCANS_ENABLED=true
PORT=3000
PUBLIC_ORIGIN=https://your-production-domain.example
```

5. Restart the service. Navigate to Skin analysis, upload a high-quality front-facing JPEG/PNG, check consent, enter **your private demo passcode**, and run. The passcode protects your 1,000-unit budget. It is **not** the YouCam API key; never enter the provider key in the browser.
6. Verify the result is labeled **REAL YOUCAM RESULT** and that it includes actual vendor values. Film a genuine full scan for Devpost.

### API details

- `POST /api/scan`: content-type `image/jpeg|image/png`, raw binary image body (max 8MB), `X-Image-Filename`, `X-Skin-Consent: yes`, `X-Demo-Access` header.
- `GET /api/scan/status?task_id=...`: `X-Demo-Access` header.
- `GET /api/status`: exposes configuration readiness **and a separate upstream authentication preflight result** (`providerConnection: authenticated | checking | failed | disabled`). On each server boot, when live scans are configured, the server calls Perfect Corp's documented `GET /s2s/v1.0/client/credit` endpoint **once, for free**, to verify its API key without submitting a skin-analysis task. This does **not** prove that an actual face scan works. No secrets or provider balance amounts appear in public status.
- File metadata: `POST https://yce-api-01.makeupar.com/s2s/v2.0/file`, then signed S3 PUT.
- Start scan: `POST /s2s/v2.0/task/skin-analysis` with `src_file_id`, SD `dst_actions`, `format: json`.
- Poll: `GET /s2s/v2.0/task/skin-analysis/{task_id}`.

This version uses in-process rate limiting (2 requests per IP per hour and 20 per process per day) and a passcode; on distributed/serverless deployments **use a shared Redis rate limiter and durable task store**, since memory is not shared across instances. A single-instance Node deployment is safer for this hackathon iteration. We do not log or persist user selfies. YouCam itself processes images and retains them according to its own terms; this app cannot promise immediate deletion from the provider. Be sure your Privacy disclosures and account configuration are appropriate before inviting real users.

**Vendor score caution:** YouCam documents `ui_score` as a cosmetically adjusted display score, not a statistically calibrated probability or diagnosis. We do **not** use such scores as a medical risk classifier or promise skincare outcomes. The sample catalog is illustrative, no actual products are for sale, and no efficacy/compatibility is clinically verified.

## Architecture

- `server.js`: static server, consent, per-IP spending guardrail, authenticated live YouCam proxy.
- `src/youcam.js`: allowlisted signed-upload, provider calls, status normalization.
- `src/recommendations.js`: pure shelf-aware shopping rules; no fabricated medical logic.
- `public/`: responsive frontend and polished CSS.
- `test/`: deterministic recommendations, provider adapter contract mocks and HTTP smoke tests.

## Hackathon submission checklist

- [x] Functional web app, deterministic recommendation system and test suite
- [x] Real YouCam API implementation in code; authentication checked against the actual provider (end-to-end scan still unverified)
- [x] Provision a server-side YouCam API key; free live provider authentication preflight succeeded (unit redemption must be checked in your own console)
- [ ] Run and verify a real provider-backed analysis using a consented selfie
- [x] Deploy public HTTPS frontend and backend at https://routinegap-youcam.onrender.com/ (provide private judge access code in appropriate testing instructions)
- [x] Public GitHub repository with MIT license: https://github.com/betterlifestyle04-commits/routinegap-youcam
- [ ] Add project screenshots
- [ ] Record a **1–3-minute real-functionality** video, explain YouCam API, upload to Public YouTube/Vimeo/Youku
- [ ] Finalize Devpost before **Monday Nov 2, 2026, 17:45 Europe/Oslo**
- [ ] For **Rising Star Award**, add proof of current enrollment with qualifying student email if eligible

Official: https://youcam-api-skin-ai-ecommerce.devpost.com/rules
API: https://docs.perfectcorp.com/reference/ai_skin_analysis

## License
MIT; see `LICENSE`.
