# VoltGuard

VoltGuard is an EV charging-bay thermal warning prototype: deterministic rules flag simulated heat, optional AI explains the evidence, and a human records the decision.

**Hack4SDGs 2026 · Green Transport & Smart Mobility · HKBU Team 1023 / LadyBanana · 18 October 2026 submission.**

## Run locally

Requires **Node.js 24+** with `node:sqlite`. The application has no npm dependencies and needs **no npm install**.

From the cloned repository:

```sh
node --version
node serve.mjs
```

Open [the English demo](http://127.0.0.1:4173/?lang=en). Keep the terminal open; stop with **Ctrl+C**. Use HTTP rather than opening `dist/index.html` directly. The service binds to loopback and stores local SQLite files in ignored `.sites-runtime/`; it is a local demonstration service, not a production deployment.

**No AI keys are needed.** Rule alerts, Scenes A/B/C and manual decisions still work; the AI panel stays unavailable. See the [one-page judge run sheet](docs/submission/JUDGE_RUN.md) and [six English screenshots](docs/submission/screenshots/README.md).

## Three scenes to try

Enter an operator code (an unverified label, not an authenticated identity). Leave AI off for a rule-only demonstration. Each scene starts a fresh simulation session.

| Scene | Select | What to inspect |
| --- | --- | --- |
| A | B2-03 | Front-wheel residual heat, initially about 68°C; warning while parked and not charging. Choose a level and explicitly submit a decision. A manual downgrade records observation, not safety. |
| B | B2-02 | Underbody heat reaches warning at second 28 and danger at second 42 (80°C). Danger cannot be downgraded. B2-06 always has no data. |
| C | B2-04 | Charging with ambiguous wheel/underbody boundary heat. Select Maintain, Request close-up thermal and Dispatch patrol; submit. After eight simulation seconds, inspect the close-up and simulated patrol report ("hub is warm..."). |

AI suggestions require human submission. **999 is record-only** in the decision workflow: recording it does not dial or notify emergency services; any separate call link requires a person to act. Reset clears the current carpark simulation, its AI runs and decisions.

## Optional AI

Copy `.env.example` to a private `.env`, then configure:

```dotenv
VOLTGUARD_AI_ENABLED=true
VOLTGUARD_AI_BASE_URL=
VOLTGUARD_AI_MODEL=
VOLTGUARD_AI_API_KEY=
```

Fill the base URL, model and key with your own authorized OpenAI-compatible provider configuration. The evaluated model was **qwen3-vl-plus**. The adapter appends `/chat/completions` to the base URL. Restart the service, enable AI explanation and start a scene. The server loads `.env` automatically; existing process environment variables take precedence. Never commit credentials or place them in browser code. Missing configuration, refusal, invalid output or the nine-second server deadline leaves manual decisions available.

The separate NASA evidence assistant uses `OPENAI_API_KEY`; it is not configured by the carpark key. Real-provider checks are opt-in, incur API use and must not be confused with ordinary tests. The submission AI screenshot uses a visibly labelled **test stub, not a real model**.

## Evidence and honest limits

- **Every carpark frame is labelled simulation.** This is not a camera, real CCTV, measured vehicle telemetry or a live emergency system. Close-up and patrol responses are simulated. Carpark frames, AI suggestions and decisions are stored separately, cannot be exported and never enter NASA measured tables.
- Temperature/rise-rate thresholds (60/80°C and 1/2°C/s) are prototype choices, not universal vehicle limits or fire-service certification. There is **no fire certification** and no demonstrated vehicle fire-prediction accuracy. Danger cannot be downgraded.
- On **10 October 2026**, the formal synthetic-scene AI group returned **13/15 valid within 10 seconds**, with **6/15 matching both cause and recommendation**. This is not vehicle accuracy or a latency guarantee. The **12 October 2026 recheck completed with `ok=false`**; it did not meet all expectations. See [the dated evaluation record](docs/BAY_AI_LIVE_CHECK.md) for denominators, counterexamples and limitations. No new model evaluation was run for this submission pack.
- **No three-person user test has been completed.** User research, authorized vehicle sensors, vehicle-specific calibration and independent safety review remain prerequisites for field use. Operator codes are not verified identities; local logs are not a tamper-proof audit service.

## Secondary NASA workspace

The carpark is the default homepage. Historical laboratory tools remain separate at [Fleet](http://127.0.0.1:4173/?view=fleet&lang=en), [Cell detail](http://127.0.0.1:4173/?view=detail&lang=en), [Thermal](http://127.0.0.1:4173/?view=thermal&lang=en) and [Operations](http://127.0.0.1:4173/?view=operations&lang=en) (`/?view=fleet|detail|thermal|operations`).

Bundled measurements come from **NASA Ames PCoE cells B0005, B0006, B0007 and B0018**: four independent laboratory cells and 636 discharge cycles, not vehicles or thermal-runaway incident recordings. NASA provides one surface-temperature channel per cell; its physical position is unknown. The 3D shell is illustrative and does not invent a measured thermal field. Synthetic demonstrations remain isolated from measured records and exports.

Attribution: [NASA PCoE dataset repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/). Three.js and OrbitControls are vendored with their MIT notice in [dist/vendor/three](dist/vendor/three/). Existing third-party notices are retained.

## Verification and project notes

Run all tests with Node.js 24+ (portable command, no shell glob expansion required):

```sh
node --input-type=module -e "import {readdirSync} from 'node:fs'; import {spawnSync} from 'node:child_process'; const files=readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f); process.exit(spawnSync(process.execPath,['--test',...files],{stdio:'inherit'}).status ?? 1);"
```

Ordinary tests and `qa-*` scripts neither load private `.env` nor call real models. Existing browser QA scripts use the development machine's Playwright/Edge paths; running the app does not require them. The opt-in `live-bay-*` checks do load private configuration and call a real provider.

[Local API](API.md) · [Product requirements](docs/MVP_PRD.md) · [Technical design](docs/TECH_DESIGN.md) · [Implementation record](docs/CARPARK_IMPLEMENTATION_STATUS.md).

The [pitch folder](pitch/README.md) is the **3 October NASA-era packet** and must not be used as the 18 October submission. The English pitch deck is prepared separately; this repository's submission pack supplies screenshots and judge run notes.
