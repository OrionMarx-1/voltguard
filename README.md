# VoltGuard · carpark thermal-alert prototype

VoltGuard is a carpark control-room prototype: thermal frames drive deterministic alerts, AI offers advisory explanations, and an operator records a decision. The default screen is **Bay monitor / 車位監控**. **Rule validation (NASA cells) / 規則驗證（NASA 電芯）** retains the measured-cell tools as a separate secondary workspace. The carpark demo uses labeled synthetic frames; no real vehicle or thermal camera is connected. This is not a certified safety controller or fire-prediction product.

## Run the full local system

Requires Node.js 24 or later (`node:sqlite`); no npm packages are needed for the application.

```powershell
Set-Location 'E:\重要内容\GenAI比赛\Inter-university 比赛\voltguard-site'
$node = 'C:\Users\Admin1\AppData\Local\Programs\nodejs-v24.13.0\node.exe'
& $node serve.mjs
```

Open **http://127.0.0.1:4173** in a browser. Do not double-click `dist/index.html`: browser restrictions on local-file modules and JSON requests prevent the complete application from working through `file://`.

The local homepage shows twelve B2 bays, six charging bays, thermal detail, alerts and operator decisions. The private ignored `.env` is loaded automatically at startup; explicit process environment variables take precedence. No key is required for rule-only demonstrations.

The public static site's carpark homepage says **Run the local service** and disables scenario controls; it does not fabricate temperature frames or AI results. The secondary NASA workspace still provides historical measurements, JSON import, sensor inspection, voice guidance, report export and printing. Public imports stay in browser-session memory. Local mode adds independent simulation SQLite tables, measured-record storage, event transitions, the authorized telemetry API and WS updates. No cloud database is connected.

## Demonstrate the carpark MVP

1. Open the homepage, enter an operator code, and leave **AI explanation** off for a rule-only comparison. An operator code is not an authenticated identity.
2. Start **Scenario A**, select **B2-08**: wheel-region residual heat cools from 68°C to 62°C while the warning remains. Choose a level and explicitly submit the decision; manual downgrade means observation, not a claim of safety.
3. Start **Scenario B**, select **B2-02**: underbody heat reaches warning at second 28 and danger at second 42. A danger alert cannot be downgraded. The separate **B2-11** bay always has no data.
4. To use real AI, configure `VOLTGUARD_AI_ENABLED=true`, `VOLTGUARD_AI_BASE_URL`, `VOLTGUARD_AI_MODEL` and `VOLTGUARD_AI_API_KEY` in `.env`, then restart the service and enable the scenario's AI checkbox. Keys stay server-side. New, escalated or reopened alerts trigger calls; merely opening the homepage or switching languages does not.
5. AI suggestions prefill controls and require explicit submission. Refusal, invalid output or the nine-second server deadline leaves the manual path available. **Reset** clears the current simulation session, its AI runs and decisions. No carpark simulation is exportable or enters NASA measured records.

The AI adapter accepts the configured OpenAI-compatible base URL and model; the current local configuration was evaluated with `qwen3-vl-plus`. Round 7's final thirty-call evaluation returned valid results within ten seconds in 13/15 formal attempts, with 6/15 matching both expected cause and recommendation. B matched in all six attempts; A's valid replies recommended maintain. The image-only group matched no expected cause. These are small synthetic-scene evaluation results, not vehicle accuracy or a latency guarantee. See [real-model checks and limitations](docs/BAY_AI_LIVE_CHECK.md).

Primary navigation remembers the most recently opened NASA subview during a page session. Existing direct links remain usable: `/?view=fleet`, `/?view=detail&cell=B0018`, `/?view=thermal`, `/?view=operations`; `/?view=carpark` also remains valid. Missing or unknown view parameters open the carpark homepage. Both groups support `&lang=en` / `&lang=zh`. NASA loading errors do not replace the default carpark view.

[Product requirements](docs/MVP_PRD.md), [technical design](docs/TECH_DESIGN.md), [eight-round implementation record](docs/CARPARK_IMPLEMENTATION_STATUS.md), [local API](API.md).

## Retained NASA rule-validation tools

**Isolated M1 demonstration (2026-10-04)**: Thermal view has explicit Normal / Warning / Danger simulation buttons and a “Use NASA records” return action. Deterministic 4×4 synthetic grids are visibly labeled as simulation in the heading, model and rule result. They are not vehicles or measurements. The shared engine uses two identical synthetic frames one second apart (zero synthetic rise); temperature alone triggers the 62°C / 85.4°C demonstrations. No voltage, current, capacity, real timestamps or OEM claims are invented. Demonstrations remain in memory, cannot be handed over/exported, never post to telemetry or AI, and never enter SQLite. Simulation does not persist across refresh; opening Thermal view again restores the last measured NASA selection. The normal measurement palette is unchanged: color is temperature, not a green/red safety guarantee. See [M1 execution notes and demo script](docs/M1_IMPLEMENTATION_STATUS.md).

Under **Rule validation (NASA cells)**, **Thermal view** retains the interactive **3D battery model**. Drag to rotate, scroll/pinch or use +/- to zoom, choose top/reset view, and click a measured region. Arrow keys inspect sensors; Home resets the camera. The fixed temperature scale, hottest-sample navigation, recorded replay and timestamp-proportional history band remain available. The model is not part of carpark thermal detail.

NASA has one surface-temperature channel per independent laboratory cell: only a small marker on an illustrative cylindrical cell is colored. Its physical sensor position is unknown; the grey shell is unmeasured. Imported or authorized gateway matrices render as illustrative 3D module regions, one color per supplied sensor, with missing regions grey. This is not an OEM CAD model and does not interpolate a thermal field. Genuine multi-sensor vehicle data and verified physical coordinates are still prerequisites for a physically accurate full-pack heatmap. The separate 2D map remains available, including automatic fallback on WebGL failure/context loss. No measurements are generated by the model. Stale/offline channels retain known warnings but never imply current safety.

Three.js 0.180.0 and OrbitControls are vendored locally with their MIT license in `dist/vendor/three`; the app needs no npm install or external CDN. Rendering is on demand, with capped display pixel ratio and instanced geometry for supplied matrices. The service worker caches the 3D dependencies for offline use.

**Operations / 現場工作台** is organized as a measured-record rail, an evidence review sheet and a handover column. It loads a genuine NASA record on first entry instead of opening as an empty form. Selecting a cell loads its actual latest cycle (B0018 has 132, not 168); report-to-3D navigation retains the cycle and measured sample. Historical thermal-rule crossings and capacity reviews are counted separately across the four latest bundled cycles, never called live fire incidents. Source/time/coverage, the measured temperature and capacity health lead the review; sensor details, frontline guidance and format/privacy/AI limitations can be expanded when needed. Existing export/printing, voice guidance and local event transitions are preserved. A load failure leaves the previous valid evidence intact. Public mode explicitly disables durable saving rather than pretending to have cloud storage.

**Evidence handover / 報告重載與處理記錄** now retains the selected NASA display-sample index when saving; it no longer silently substitutes the cycle's last sample. Exported reports can be reloaded: the rules are recalculated, untrusted conclusions/history are discarded, and NASA source references are checked against the actual bundled measurements. Mismatches preserve the previous valid report. Local event rows have a processing-history panel with actual creation/update/acknowledgment/closure times, JSON export, retry, keyboard dismissal and bilingual/mobile support. Only the latest 200 actions are returned when more exist, with an explicit truncation notice. Imported audit claims never become stored actions. This is a local development log without authenticated operator identities or cryptographic tamper protection, not a public cloud audit service.

- Four measured NASA cells, 636 discharge cycles; cycle/sample replay and capacity trends.
- Shared deterministic engine; thermal and capacity maintenance results remain separate.
- Missing / stale / partial telemetry is never silently labeled safe. An isolated snapshot cannot establish a temperature rise rate.
- Measured sensor matrix: 1–64 rows/columns; missing values stay missing; no fabricated pack layout or spatial interpolation.
- Bilingual, light-mode operations workspace, mobile controls and optional browser speech (voice availability depends on the device).
- Factual emergency-call guidance linked to the Hong Kong Fire Services Department; no AI-generated fire blanket or battery-disassembly instructions.
- Sanitized, source-labeled JSON report and printable bilingual report. “Save PDF” uses the browser print dialog; it is not an automatic email or cloud report service.
- Local SQLite event persistence, explicit acknowledgment/closure and transition audit table; historical maintenance records are not fire incidents.
- Receive-only WebSocket updates and reconnect; a lost connection makes channel state unavailable.
- Basic local gateway authentication, origin/host checks, CSRF for browser writes, request size limit, schema validation and hardware-alias hashing.
- Service-worker offline cache for the shell, modules and latest NASA records. API responses and gateway records are not cached by the service worker.

## Real data and decision boundaries

**Evidence assistant / 證據助理** adds bilingual official FSD source search and an optional local GPT-4o text/image explanation of selected evidence. Source search works on the public site without a key; it is a small curated keyword collection, not a generated answer or vector search. The cloud model is never called automatically. A local key, explicit per-record consent and human review are required. Measured sensor-index images are generated from the same validated values on the server; no imaginary 3D heat fields or unsafe operational actions are sent/displayed. Response guards, 30-second bounded memory cache, timeout and clear failure states preserve the existing rule result. **This separate NASA-assistant path has not had real-provider latency/quality evaluation; the carpark AI measurements are documented above.** See [API.md](API.md).

**Frontline view / 前線簡潔模式** removes the record rail, overview and event administration while retaining the measured review. Five large actions offer 3D inspection, general-guidance speech, report export, an explicitly labeled actual-emergency 999 call link, and return to the full workspace. It does not assume a fire or issue an automated call. This is browser/PWA layout refinement, not proof of staff usability or native offline AI.

The separate optional **NASA evidence assistant** uses `OPENAI_API_KEY`, not `VOLTGUARD_AI_API_KEY`; configuring carpark AI does not configure the NASA assistant. Use the private ignored `.env` and restart `serve.mjs`, which loads it automatically. `.env.example` contains empty keys only. A key-presence indicator does not establish a successful provider call. Public hosting remains static without either AI API.

Earlier NASA-focused competition material remains in [pitch/](pitch/). Its slides and backup video predate the carpark repositioning and real-model checks; they do not demonstrate this final carpark MVP. Sources and technical limits remain in slide notes. [Earlier work notes](docs/NEXT_WORK_STATUS.md) describe that phase; current scope and progress are in the MVP documents linked above. The portable [evidence-review skill](skills/voltguard-evidence-review/SKILL.md) is packaged, not installed in WorkBuddy and not proof of WorkBuddy collaboration.

Bundled data comes from NASA Ames PCoE B0005, B0006, B0007 and B0018. These are laboratory lithium-ion cell records, not vehicles or thermal-runaway incident recordings. Latest records trigger zero prototype thermal alerts and three maintenance reviews; do not invent an alarm to make a demonstration dramatic.

NASA source dates lack explicit timezone metadata and are displayed without adding a timezone. Summary temperature/rise-rate values refer to the entire discharge cycle; the operations tile shows the selected sample. The 5-second maximum rate is calculated from the original record, not the downsampled display curve.

The 60/80°C and 1/2°C/s rules are **prototype thresholds**, not requirements from FSD Circular 3/2025, universal battery limits or a validated prediction model. Capacity review at 75% and observation at 90% are also prototype workflow choices. Vehicle-model calibration, labeled incident data and independent safety review are required before field reliance.

Official sources:

- [NASA data repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/)
- [FSD emergency-call guidance](https://www.hkfsd.gov.hk/eng/fire_ambulance_services/fire_information.html)
- [FSD Circular 3/2025](https://www.hkfsd.gov.hk/eng/source/circular/2025_03_eng_20250905_192346.pdf)
- [PCPD data protection principles](https://www.pcpd.org.hk/english/data_privacy_law/6_data_protection_principles/principles.html)

## API and authorized vehicle gateway

See [API.md](API.md). The server binds only to loopback. For an authorized hardware gateway on this computer, set a secret before starting:

```powershell
$env:VOLTGUARD_INGEST_TOKEN = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
& $node serve.mjs
```

Provision that secret securely to the gateway without printing it, putting it into browser JavaScript, committing it, or embedding it in a URL. An OEM/CAN adapter must supply actual measured values and accurate timestamps. No CAN/OBD data decoder or OEM authentication has been invented. Do not expose this development server publicly: a production gateway additionally needs HTTPS, device identity, multi-user access controls, retention policies, rate limits and security review.

## Tests

```powershell
& $node --test (Get-ChildItem tests\*.test.mjs).FullName
& $node scripts/qa-navigation.mjs
& $node scripts/qa-carpark.mjs
& $node scripts/qa-carpark-decisions.mjs
& $node scripts/qa-carpark-ai.mjs
```

Tests cover the genuine NASA record, invalid inputs, privacy whitelist, uncertain evidence, prototype boundaries, persistence after restart, CSRF, gateway authentication, WebSocket push and event transitions. Boundary fixtures exist only in test code and isolated test databases, never in served data or the production event log.

Carpark tests cover scenario/history determinism, state transitions, independent storage, operator decisions, protected danger, AI scheduling and failure handling. Navigation checks cover the default carpark homepage, the two primary entries, preserved NASA subviews/deep links, slow/failed NASA loading, bilingual/mobile display, static mode, offline cache and worker updates. Ordinary tests and `qa-*` do not load private `.env` or call real models. The opt-in `live-bay-ai-check.mjs` and `live-bay-ui-check.mjs` do use the configured provider and incur API use; see their instructions in [BAY_AI_LIVE_CHECK.md](docs/BAY_AI_LIVE_CHECK.md).

Copilot tests additionally cover source matching, a PNG derived from an actual NASA measurement, payload minimization, output rejection, cache/timeout contracts, consent/CSRF and unconfigured behavior. Provider replies are explicitly labeled unit-test stubs, not an actual API test. `scripts/qa-copilot.mjs` checks both languages, mobile/frontline mode, public/local boundaries and real interface screenshots. It makes no provider calls.

`scripts/qa-browser.mjs` uses the installed Windows Codex Playwright runtime and Edge; it checks desktop/mobile views, both languages, genuine-data export, import, event transitions and printable PDF output. It does not require installing a browser. QA output lives in ignored `.sites-runtime/qa-v8`.

`scripts/qa-workbench.mjs` checks automatic real-record loading, truthful historical counts, latest-cycle selection, report/3D round trips, preservation of evidence on failed fetch, guidance disclosure, public/local storage boundaries, both languages and mobile/text enlargement. Static-hosting capabilities are isolated in the test; no synthetic measurements are served.

`scripts/qa-evidence.mjs` verifies selected-sample persistence, genuine-report reload/3D round trips, recalculation of untrusted file conclusions, rejection of mismatched source measurements, local timeline order/export, error retry and bilingual/mobile dialogs. Outputs are in ignored `.sites-runtime/qa-v9`; tests use an isolated database and genuine NASA samples, never the user's operational log.

`scripts/qa-thermal.mjs` checks default 3D rendering, rotation, zoom/reset, ray-based region selection, actual temperature/color updates, 2D fallback, both languages, mobile layout, cycle navigation and report handover. Its spatial-renderer fixture is explicitly test-only; it is not a physical NASA sensor layout and is not included in published data. Screenshots of the actual NASA view are in ignored `.sites-runtime/qa-v7`.

## Remaining external prerequisites

- Authorized OEM BMS / CAN / telematics access and actual driving/charging/parked test data.
- Multi-sensor hardware layout and validated clocks, sampling frequency and sensor health.
- Positive, labeled safety incidents and independent calibration: current NASA data cannot measure fire-detection sensitivity or lead time.
- Further real-model and bilingual-quality evaluation, especially A downgrade recommendations, image-only judgments and timeout reliability; round 7 did not meet all scene expectations. The NASA evidence assistant needs its own configuration and evaluation.
- User research with facility staff and fleet operators, signed-off emergency procedures and privacy/security review.

Implementation note: the existing buildless Site is preserved. A dependency-free Node service was added rather than replacing the working front end with the Python/React stack suggested in the initial master document. This keeps the runnable prototype small; the master document’s simulation, certification and deployment aspirations are not claims of completed work.
