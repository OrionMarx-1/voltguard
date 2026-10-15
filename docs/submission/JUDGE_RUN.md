# VoltGuard: judge run sheet

**Hack4SDGs 2026 · Green Transport & Smart Mobility · HKBU Team 1023 / LadyBanana**

VoltGuard demonstrates thermal warnings, optional AI explanations and human decisions for six simulated EV charging bays.

## 1. Clone and start

Clone the public repository linked in the root README, then open its directory. Install **Node.js 24+** (`node:sqlite` required); **no npm install** is needed.

```sh
node --version
node serve.mjs
```

Open **http://127.0.0.1:4173/?lang=en**. Keep the terminal running. No AI key is required: rule alerts and manual decisions remain available while AI stays unavailable. Enter an operator code; it is an unverified label.

## 2. Demonstrate the three scenes

1. **A → B2-03:** inspect the front-wheel hotspot and Warning. The parked vehicle is not charging. Choose Maintain and submit a manual decision.
2. **B → B2-02:** wait until simulation second 42 for the underbody hotspot and Danger (80°C). Downgrade is disabled. B2-06 remains No data.
3. **C → B2-04:** choose Maintain, Request close-up thermal and Dispatch patrol; submit. After eight simulation seconds, inspect the close-up canvas and patrol sentence reporting that the hub is warm. The main warning remains for human review.

Each scene starts a fresh session. **Reset** clears the current simulation, AI runs and decisions. The 999 action records a decision only; it does not call emergency services.

## 3. Interpret the evidence

All carpark frames are labelled **simulation**: no camera, live CCTV or actual vehicle measurement is connected. Close-up and patrol responses are simulated. Carpark evidence cannot be exported and is never mixed into NASA measured tables. Thresholds are prototype choices; this is not fire-certified or validated vehicle fire prediction. Danger cannot be downgraded. No three-person user test has been completed.

Optional AI: copy `.env.example` to private `.env`; set `VOLTGUARD_AI_ENABLED=true`, `VOLTGUARD_AI_BASE_URL`, `VOLTGUARD_AI_MODEL` and `VOLTGUARD_AI_API_KEY`. The evaluated model was `qwen3-vl-plus`. Restart, enable AI and start a scene. Never commit keys. Suggestions require explicit human submission; unavailable AI leaves the manual path open. The saved AI screenshot is a **test stub, not a real model**.

The **10 October 2026** formal group achieved **13/15 valid within 10 seconds** and **6/15 matching both cause and recommendation**. The **12 October 2026** recheck completed with **`ok=false`**. These are synthetic-scene evaluations, not vehicle accuracy. See [evaluation details](../BAY_AI_LIVE_CHECK.md).

NASA laboratory tools are secondary: `/?view=fleet`, `/?view=detail`, `/?view=thermal`, `/?view=operations`. The [3 October pitch packet](../../pitch/README.md) is historical and must not be used for the 18 October submission.

## 4. Stop

Press **Ctrl+C** in the server terminal. Local runtime files stay in ignored `.sites-runtime/`. See [screenshots and captions](screenshots/README.md) for an offline visual backup.
