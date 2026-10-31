# RoutineGap — Your shelf first. Shop smarter.

A functional skincare shopping-intelligence web app built for the **YouCam API Skin AI & eCommerce VTO Hackathon 2026**. **Don't buy another serum before you check your shelf.**

## What works now

- Premium responsive dashboard and navigation
- User-managed skincare inventory (create/remove/reset), stored locally in browser only
- Explainable shopping recommendations: use what you own, avoid duplicate routine steps, fill only missing essentials
- Budget and fragrance-free preferences; transparent illustrative catalog, non-functional checkout (intentionally no fake store)
- Shopping cart, cost and budget accounting, readable decision trail
- **Consent-based report-to-shop bridge**: after a real or clearly marked example scan, a user can actively select a cosmetic metric as a *shopping preference*. The shopping rules still prioritize their own shelf, budget, and exclusions, and never automatically interpret a YouCam score as a diagnosis, a clinical risk, an ingredient allergy, or proof that a product will work. The Decision Trail documents that the focus was chosen by the user.
- Clearly labeled sample scan; **it never masquerades as a real YouCam result**
- Server-side **real Perfect Corp YouCam Skin Analysis v2.0 integration** using the documented File API (presigned upload), skin-analysis task submission and task-status polling
- Privacy-first consent gate and a protected live-demo access code; no saved selfies or medical claims
- No external runtime dependencies; built for Node.js 22 and portable deployment; unit + HTTP smoke tests
- In-app **photo readiness guide**, including an illustrated good-versus-bad example, exact SD image pixel/file-size requirements, framing and lighting checklist, and validated external editing links. The app checks resolution locally and again on the server **before** contacting YouCam; no AI upscaling or photo submission occurs merely because the user selects a file.

## New: photo readiness diagnostics and local capture self-check

The Skin Analysis workspace now includes a **Photo Readiness Dashboard** next to the actual upload action. It explains YouCam input constraints without inventing a face-quality score or implying that image-content quality has been assessed.

- **Automatic checks:** selected file type (JPG/PNG), source limit (1.5 KB–24 MB), decoded image minimum short dimension (480 px), maximum final long dimension (2,560 px), and maximum final request body (8 MB). Oversized but otherwise eligible originals are labeled **local preparation available**; too-small originals trigger retake/full-resolution guidance, not upscaling.
- **Honest manual self-checks:** four optional, browser-only checkboxes for centered frontal face, soft even lighting, unobstructed skin, and original unfiltered photo. They are explicitly **self-reported** and do not imply that computer vision, liveness detection, image grading, skin condition diagnosis or Perfect Corp acceptance has happened.
- **Next-action guidance:** distinguishes local preparation, insufficient image quality, consent, missing private demo passcode, provider authentication status, and an existing in-progress task. No photo upload or new provider request occurs until the user explicitly uses the existing live scan action.
- **Drag and drop:** a single valid original photo can be dropped onto the existing photo-selection area; the drop goes through exactly the same private validation as the file chooser.
- **Consent reset:** choosing a new image clears the old image-specific consent flag and previously ticked manual self-checks. A person must consent anew for the changed image. UI keyboard focus is retained after changing a self-check.
- The pre-existing **photo example illustration**, photo-capture guide and links to Photopea, Squoosh, and Perfect Corp specification documentation remain available. The existing non-generative browser resize tool and separate paid API request gates are unchanged.

Tests cover thresholds, prepared images, sample/real separation, provider/consent/passcode gates, impossible states, safety explanations, and UI event wiring. The dashboard performs **no extra network calls, face recognition, or image upload**. The user's photo remains in app memory until the explicitly consented existing scan or page reload.

## New: Concept Detail Studio — product detail storytelling across 25 examples

RoutineGap now offers immersive, responsive **full product-detail views** in Shopping Studio. Select **Explore full details** on any of the 25 fictional cards, use Global Search to open a concept directly, or explore alternatives within the detail dialog. A large CSS-only packaging illustration is deliberately a *concept*, not a photo of actual merchandise.

The detail view includes the source concept name, descriptive catalog copy, fictional USD example price, clearly labeled decision reasoning, existing real-shelf category overlap, currently selected example budget, optional catalog tags for stated focus and fragrance-free preference, and three same-step illustrative alternatives.

**Editorial data:** Four educational routine-category guides (cleanser, moisturizer, SPF, optional serum) and **11 explanatory descriptor definitions** for every catalog tag. They explain what each marketing label means *in the fictional concept library*, and explicitly distinguish the labels from verified ingredients, tolerability, certified SPF performance, actual merchant stock, medical outcomes or clinical compatibility.

**Full user journey:** From any detail view, save or unsave an idea, add/remove an eligible fictional cart selection, and add/remove comparison shortlist entries. The existing allowlisted storage remains unchanged in structure; the detail view never stores photos, scan findings, provider receipts or account credentials. Shelf-overlap warnings explicitly use *genuine user-owned entries only*; illustrative starter inventory never counts as real ownership.

The dialog has keyboard-accessible close, Escape, focus trap, backdrop dismissal, focus return and responsive layouts. Opening an example through Global Search enters Shopping Studio and opens the detail dialog. Navigating away closes the dialog. All actions still remain examples, with **no checkout, merchants, live pricing, ratings or additional YouCam calls**.

Regressions test all 25 concept stories, descriptor coverage, false ownership prevention, budget limits, tags and disclaimers, safe related-product ordering, immutability and integration hooks. The GitHub workflows must pass before release.

## New: Privacy & Data Center with scoped controls

**Privacy & Data** is a first-class ninth workspace, available in navigation, global search, and at `/#/privacy`. A visually structured dashboard inventories only six known RoutineGap browser storage groups, displays whether each actually exists in the browser, and provides deletion and export controls.

- Inventory groups: user shelf and purchase preferences (localStorage), saved fictional concept IDs (localStorage), up-to-three compared concept IDs (localStorage), daily routine checkmarks (localStorage), an optional validated real YouCam observation summary (sessionStorage, maximum 24h) and a pending provider task receipt (sessionStorage).
- Delete each group independently or select **Erase all RoutineGap browser data**. A confirmation explicitly precedes changes. Deletion removes only exact allowlisted application keys; it **never calls `localStorage.clear()` or `sessionStorage.clear()`**, so unrelated site/application records are not erased. Removal is verified; errors never masquerade as success. Reloading also clears in-memory selected photos and sample screens.
- Download real user-entered shelf JSON through the existing strict exporter; export a local Markdown decision brief; no photos, provider secrets, pending-scan receipts or private demo passcodes are included in the inventory backup.
- Truthful provenance: sample starter inventory does not count as genuinely owned products. A browser-only deletion **cannot** cancel an already submitted Perfect Corp/YouCam job, recall an uploaded face photo, remove provider-held data or delete files the user already downloaded. The UI says this prominently.
- External storage sync, accounts and provider-side deletion are **not** implemented, and the dashboard does not claim to perform them.
- Data summaries are local-only; no new third-party API calls, scan fees, analytics collection or checkout features are introduced.

Dedicated regression tests cover scoped deletion, blocked-storage error handling, preservation of unrelated keys, inventory provenance, session-vs-local separation, and UI navigation.

## New: keyboard command search, private global discovery, and shareable workspace routes

The platform now supports **Ctrl+K / Cmd+K** and the top-bar **Search** button. A designed accessible dialog finds all eight functional workspaces, all fictional catalog concepts, and—only when a real inventory is entered—actual browser-local shelf entries. It searches names, categories, tags and navigation aliases without asking a server for results. The first results are useful workspace quick links. Selecting a fictional concept opens the Shopping Studio with the exact idea visible; selecting a real owned item opens a filtered My Shelf view. Search results explicitly distinguish **user-entered products** from **fictional product concepts**.

- **Browser back and forward work** for the eight page views. Workspace URLs can be shared safely as `/#/overview`, `/#/scan`, `/#/shelf`, `/#/routine`, `/#/insights`, `/#/shop`, `/#/compare`, and `/#/trail` without backend routing or extra infrastructure.
- **Privacy boundary:** only a fixed, allowlisted page slug is put in the URL. Private shelf product names, search queries, scan findings, face photos and YouCam access references are **never** embedded in URL paths or fragments.
- **Keyboard UX:** Escape closes the dialog, up/down keys move through results, Enter opens the first match, Tab remains within the dialog, focus returns to the launching control on close, and clicking the backdrop closes it. Keyboard skip-to-main remains supported.
- Search and navigation are local and never consume YouCam credits, upload photos, produce a clinical interpretation or trigger a purchase.
- Global search is a present-browser feature, not account synchronization or indexing of other users' activity.

Deterministic tests cover route validation, all eight tab destinations, searches and aliases, purely fictional catalog labels, sample inventory exclusion, and the UI integration.

## New: Compare Lab — transparent side-by-side concept comparison

The navigation now includes **Compare Lab**, a designed workspace where users can build a three-item side-by-side comparison of fictional skincare concepts.

- Select up to three independently from the 25-item curated concept catalog. Use live product text search, category filters, or the **Compare** controls on Shopping Studio cards.
- Compare the *example* price, routine step, clearly labeled fictional description and tags, match with the user's *stated* cosmetic goal, declared fragrance-free filter, individual fit to the shopping budget, and overlap with the user's **actual** recorded shelf.
- The comparison prevents a critical UX error: if the default **illustrative starter shelf** is still active, its products are **not** counted as genuinely owned or used to claim personalized purchase-avoidance.
- An explicit duplicate-category warning appears when alternatives for the same routine step have been selected. The **combined fictional total** is informational only; it is not an automatic shopping basket, a cost saving, or advice to buy every selected product.
- Compare selections (max 3 **allowlisted concept IDs**) live in browser `localStorage`. They are **separate from** the six-item saved board, actual user inventory, daily checklist, shopping budget, demo cart, sensitive reports and any YouCam photo or scan task.
- Cards and table are keyboard navigable, tables are horizontally scrollable on narrow devices, and buttons expose pressed/selected state. The interface does not claim verified product ingredients, clinical suitability, SPF efficacy, independent ratings, merchant availability, real checkout or skin improvement.

The comparison model is deterministic and pure, so selecting, removing, searching and comparing **does not call YouCam**, trigger provider credits or transmit data to a server. Tests verify input allowlisting, cap, toggle behavior, sample-versus-real shelf attribution, product-category alternatives, explicit preference exclusions and immutability.

## New: My Insights — truthful local analytics and budget scenarios

**My Insights** is now a first-class workspace in the RoutineGap navigation, with a premium responsive visual layout, coverage ring, four metrics, category breakdowns, and an interactive budget simulator. A dashboard call-to-action links into it.

- **Actual shelf provenance**: coverage is determined only by product types explicitly saved by the user. The fictional starter shelf is excluded from *personal* metrics; a clean local shelf honestly shows zero ownership and no represented basic categories.
- **Meaningful, bounded data**: item counts and recorded purchase-price sums per cleanser, moisturizer, daily SPF and optional serum; 0–3 basic-category coverage; existing fictional catalog matches considered redundant; the number of saved example concepts and the actual selected demo cart's amount. Recorded prices do **not** establish verified transactions or true market value.
- **What-if budget lab**: move a slider or choose presets to see a deterministic, essentials-first selection from the fictional catalog. It shows a proposed example total, unused demo budget and any remaining missing categories. **It never changes** the user's actual shopping budget, cart, saved concepts, routine checks or inventory. No provider calls, account, telemetry or premium API usage.
- **Explicit trust boundaries**: this is a current browser snapshot, **not** a behavioral trend, clinically determined routine, proven savings, merchant quote, efficacy estimate or historical analytics system. YouCam cosmetic scores are not used to fabricate product outcomes.
- **Accessibility**: navigation is keyboard accessible; mobile layouts collapse gracefully; the coverage ring provides a descriptive ARIA label and numerical progress; the simulator exposes an accessible range input and live result region. There is also a restrained print stylesheet.

Automated tests verify real versus illustrative attribution, exact categories and costs, missing essentials, budget bounds, cart separation, immutable what-if calculations, and UI wiring.

## New: personal shelf workspace, safe backups, and guided onboarding

The Overview dashboard now contains a **truthful getting-started workspace** that explains the path from a user-entered shelf to routine coverage and optional shopping exploration. Its status is derived from actual browser state: the fictional starter shelf is always identified as **illustrative**, not mistakenly counted as user-owned inventory or a completed live scan.

**My Shelf** is now a working inventory editor, not just a static list: search by name, routine step or tag; add a real product; correct the product name, step, price or tags; remove entries; undo the latest shelf mutation; or clear/reset the shelf with explicit confirmation. A product is never marked owned just because it appears in the sample catalog.

### Local-only inventory export and import

- **Export shelf (.json)** creates a versioned RoutineGap backup containing only the validated user-entered shelf plus three shopping preferences (budget, selected cosmetic goal and fragrance-free filter). Fictional starter inventory cannot be exported as genuine ownership.
- **Import backup** accepts **only** the supported JSON format and version, up to **64 KB** and **60 items**. It rejects unknown fields, malformed product entries, duplicate IDs and invalid values before mutating any browser state. A confirmation explains that an import **replaces** the local shelf and those preferences.
- Everything is parsed/generated in-browser; **no backup is uploaded to RoutineGap, YouCam, or external storage**. The backup intentionally **excludes selfies, scan observations, API credentials, private demo passcodes, pending-task receipts, saved concept IDs, and routine checkmarks**. Backups containing your product names remain personal files and should be kept private.
- Importing/resetting/replacing a shelf clears stale daily checklist checkmarks and removes no-longer-eligible ideas from the *demo cart*; it does not alter pending real scan tasks or the independent saved concept board. The last shelf replacement can be undone during the current page session.
- Responsive shelf layouts, a sticky horizontal mobile navigation, keyboard skip-to-content link, and live active-page accessibility metadata make moving through the workspace easier on small screens.

The strict schema, provenance behavior, data exclusions, and UI hooks are covered by deterministic tests. This feature needs no accounts, backend database, paid API calls, or third-party integrations.

## Expanded concept discovery and saved comparison board

**Shopping Studio** now offers 25 fictional skincare concepts spanning cleansing, moisturizers, daytime SPF and optional serums (previously 9). The same deterministic dataset is shared by Node-side rules and the frontend. Each concept has a category, example price, simple descriptive copy and visible tags — **no invented merchant, stock, medical benefit, verified SPF performance, reviews, or real transactions**. A concept named SPF 50 is merely an invented product label, not a certification or sunscreen performance claim.

A responsive, keyboard-accessible discovery workspace now includes:
- Instant search through concept names, tags, category and descriptions; category and decision-status filters; actionability/name/price sorting.
- A per-concept **Why this label?** explanation and clear **use your shelf** distinction for covered steps.
- A **Saved concept board** with up to six ideas, independently stored as only allowlisted concept IDs in browser `localStorage`. Saving an idea **does not** add it to cart.
- Price comparison alongside the actual selected **demo** cart, budget meter with visible over-budget state, and clear-cart/clear-filters controls.
- A deliberate zero-results state with a way to reset filters.
- Mobile-responsive grid and rail layouts, focus styling and reduced-motion support.

Tests cover filtering, sorting, invalid input, shortlist cap/deduplication, dataset consistency and budget-safe essential recommendations. As before, **none of this is a product efficacy engine, merchant inventory, checkout, or medical recommendation**, and no paid YouCam API calls are triggered by browsing or saving.

## New: your daily routine planner

**Routine planner** is a genuine, navigable morning/evening product workspace. It connects **My Shelf** to a simple checklist: cleanser, moisturizer and daytime SPF in the morning; cleanser and moisturizer in the evening. It displays the **actual names of products the user entered**, missing steps, and today's own checkmarks. Serums, active treatments and skin scores are **not automatically translated into a schedule**. This is an organizational aid, not medical advice or a claim of product effectiveness.

- No account, scan, API call, backend database, image upload, external analytics, or paid YouCam units are needed.
- A small allowlisted daily checklist is stored in **localStorage** only after a user clicks, with a local calendar date. It contains task keys only: **no selfie, provider scores, credentials, or product names**. The prior day's checks are not counted as today's activity. A **Clear today's checks** control is provided.
- The default illustrative starter shelf yields a **preview with disabled checkboxes**, not fake real-user activity. Importantly, adding the first real product now **replaces** the sample starter products so fictional inventory is never silently treated as user-owned. Editing/removing a starter item preserves the sample provenance until explicitly replaced or cleared.
- This planner is optional and lightweight: not a reminder system, validated adherence measurement or personalized clinical skincare regimen.

There is a direct entry from the Overview dashboard and first-class sidebar navigation, with mobile layouts, semantic labels and keyboard-operated controls. Dedicated pure model tests cover morning/evening schedule mapping, missing data, forging, local date boundaries, and absence of sensitive information in checkmarks. A GitHub Actions Node 22 workflow runs syntax and the full mock-backed test suite on pull requests.

## Judge-friendly, 60-second sample walkthrough

The Overview dashboard includes an **opt-in, free guided demo**. Click **Start illustrative walkthrough** to load **clearly labeled synthetic example skin values** without sending a face photo, calling YouCam or using the private demo passcode.

1. **Skin Analysis:** inspect the illustrative example and click **Choose as shopping focus** for one supported cosmetic metric.
2. **My Shelf:** review the explicitly labeled sample inventory; you can add real user-owned products or reset to the sample yourself.
3. **Shopping Studio:** review duplicate prevention, budget limits, optional concepts, and selections. The Overview summary now displays the **actual user's selected cart**, not an automatic suggestion pretending to be a purchased cart.
4. **Decision Trail:** inspect provenance and download a privately generated, source-labeled Markdown decision brief.

This path is for demonstrating product UX and heuristic explainability. It does **not** verify a completed paid YouCam analysis. That remains a separate, consented provider-backed test before Devpost submission.

## Optional tab-only real report recovery

After a real YouCam analysis completes, the Skin Analysis page offers an explicit **Save report in this tab** button. It stores a **sanitized allowlist of cosmetic observation fields only** in browser `sessionStorage`, for no more than 24 hours. Reloading that browser tab restores the explicitly saved live report without another paid analysis. Users can select **Forget saved report** at any time. No storage happens automatically. Starting a new paid scan clears the older saved report, and the independent in-progress scan receipt remains separately recoverable.

The saved report never includes the original face photo, file name, provider response, API credentials, demo passcode, or signed scan receipt. It does not upload or save anything in a server database. Session storage may outlive a refresh but is not an encrypted vault; do not save if sharing a device. The export is a separate explicit user action.

## Export a decision brief (private, local)

From **Decision Trail**, select **Download decision brief (.md)** to save a readable, privacy-conscious Markdown report directly in your browser. It records whether the source was a *real YouCam observation*, a clearly labeled *illustrative sample*, or *no scan*, as well as your explicitly chosen cosmetic preference, stored product shelf, optional concept recommendations, duplicate-avoidance rationale, selected demo cart and its **actual total** against your budget. Manual cart selections that exceed budget are marked **OVER BUDGET**, not falsely shown as compliant. It does not send report data to a server and **never includes the source selfie, API key, demo passcode, or signed scan receipt**. Be careful sharing reports about real people; it is cosmetic context and not medical advice.

## Photo requirements and useful tools

Our YouCam integration uses **standard-definition (SD)** Skin Analysis V2.0. A photo must be a JPEG/PNG with **short side >=480 px** and **long side <=2,560 px**. RoutineGap caps uploads at **8 MB** (stricter than the provider's 10 MB). Ideal demo examples are **720 × 960 px** or **960 × 1,280 px**, straight-on and evenly lit, with the forehead and skin visible, no glasses or heavy makeup. A **236 × 354 px** thumbnail is unsuitable.

- For a photo that is **too small or blurry**, retrieve the full-resolution original from your phone or photo library, or retake it with the camera. Increasing the pixel count of a tiny image cannot restore missing skin features, and AI upscaling may invent features.
- For a **good-quality photo that is too large**, downsize while preserving the aspect ratio and the entire face. Check both pixel dimensions afterward.
- **New: local photo preparation in the web app.** If an original JPG/PNG is too large (over 2,560 px on the longest side or over 8 MB), the skin-scan page offers **Prepare photo on this device**. It performs a proportional canvas resize and encodes an ordinary JPEG in the browser, requiring no external upload, no face editing, and no API credits. For stability the input is capped at 24 MB and 32 megapixels, and the resulting picture must still have a short side of at least 480 px and an upload size of at most 8 MB. The user still must separately consent and press **Analyze with YouCam** to send it to Perfect Corp. This feature **never upscales** tiny images: find the original or retake them instead.
- [Photopea](https://www.photopea.com/) — **Image → Image Size** to inspect and reduce dimensions; see their [official tutorial](https://www.photopea.com/learn/image-size).
- [Squoosh](https://squoosh.app/) — browser-local image resize/compression for oversized originals. Do not use beautification or generative retouching for analysis.

The Skin Analysis page includes a locally hosted [accessible illustration](public/scan-photo-examples.svg) and practical guidance. Its private local resize tool is implemented in [public/photo-tools.js](public/photo-tools.js) and tested separately. Browser canvas export may discard source metadata and convert the prepared file to JPEG; users should use their original if it is already within limits. Illustration images are *not* real scan inputs and results are never faked. Source: [Perfect Corp official Skin Analysis file specifications](https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/file-specs-and-errors).

### Current verified deployment

- Public demo: https://routinegap-youcam.onrender.com/
- API key: **authenticated** by Perfect Corp's free balance endpoint on October 31, 2026, after a fresh credential was configured in Render.
- Full skin analysis: **not yet verified on a consented, eligible image**; this remains required for the final hackathon validation. Do not describe sample data as a real scan.
- Keep the protected demo passcode private and give judges legitimate controlled access through Devpost testing instructions. Do not put credentials in screenshots, video captions, or GitHub.

## Work on this project in Codex

The source is committed on the public **`main`** branch. If Codex previously showed an empty, unborn `work` checkout or "no Git refs", that was from the repository's initial empty state. **Create a new Codex task based on `main` or recreate/refresh the environment**; do not initialize a second repository.

For a fresh Codex environment, use **Node.js 22**, run `npm run check && npm test`, and start with `npm start` (port **3000**). No `npm install`, database, API key, or `.env` is required to preview the sample mode. The real YouCam scan remains unavailable until the owner configures the server-side credentials.

See [AGENTS.md](AGENTS.md) for the full setup recipe, repository structure, security rules and recovery steps.

## End-to-end simulated provider acceptance tests

The Node test suite exercises the actual HTTP server endpoints against **mock Perfect Corp and S3 responses**: free API-key preflight, protected passcode and photo consent, file metadata, signed upload, skin task creation, signed task receipt, running-to-success polling, vendor score parsing and rejection of tampered receipts. It uses a synthetic, header-only image fixture; **no real person is scanned, no provider is contacted and no credits are spent by this test**.

The live status adapter also turns known official vendor failure codes (no face, multiple people, bad lighting, off-angle face, insufficient dimensions, unsupported file) into fixed, actionable user guidance. Unknown or missing task states are errors, **not** endless indefinite polling. It deliberately does not expose raw provider error messages, which could contain untrusted text.

**Remaining limitation:** Mock-backed full-flow tests provide much stronger compatibility evidence but do **not** verify successful real-world processing. Before submission, complete a consented photo scan with real YouCam and confirm a returned report.

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
- `POST /api/scan/status`: JSON body `{ "receipt": "<signed receipt>" }`, protected by `X-Demo-Access`. Polling does not create another provider task and consumes no analysis units. The receipt is signed server-side, valid up to 24 hours, and can be checked after a Render restart without a process-local task map; it contains neither photo content nor the API key. The task ID is never placed in a URL.
- `POST /api/scan` responds with the recovery `receipt` rather than a raw task ID. The client stores this temporarily in sessionStorage for **the current browser tab only**. If the page reloads, enter the demo passcode and click **Resume existing scan**; don't upload again. If a task times out, expires, or the browser tab closes, the receipt may not be available; the project does not claim to cancel upstream processing. Browser session reports are not retained on a server database.
- `GET /api/status`: exposes configuration readiness **and a separate upstream authentication preflight result** (`providerConnection: authenticated | checking | failed | disabled`). On each server boot, when live scans are configured, the server calls Perfect Corp's documented `GET /s2s/v1.0/client/credit` endpoint **once, for free**, to verify its API key without submitting a skin-analysis task. This does **not** prove that an actual face scan works. No secrets or provider balance amounts appear in public status.
- File metadata: `POST https://yce-api-01.makeupar.com/s2s/v2.0/file`, then signed S3 PUT. The app validates the AWS S3 destination, honors the provider's signed `Content-Type`/`Content-Length` headers, and refuses redirects to prevent photo forwarding to unapproved hosts. Unexpected instructions stop **before** transferring any image data; no provider API key is sent to S3.
- Start scan: `POST /s2s/v2.0/task/skin-analysis` with `src_file_id`, SD `dst_actions`, `format: json`.
- Poll: `GET /s2s/v2.0/task/skin-analysis/{task_id}`.

This version uses in-process rate limiting (2 requests per IP per hour and 20 per process per day), a private demo passcode, and signed stateless task receipts; on distributed/serverless deployments **use a shared Redis rate limiter**, since per-process rate limits are not shared. Signed receipts allow secure task lookup after restarts, but provider result retention is finite. A single-instance Node deployment is safer for this hackathon iteration. We do not log or persist user selfies. YouCam itself processes images and retains them according to its own terms; this app cannot promise immediate deletion from the provider. Be sure your Privacy disclosures and account configuration are appropriate before inviting real users.

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
