# VoltGuard local API

Default origin: `http://127.0.0.1:4173`. Loopback only, no CORS sharing. The static public Site does not expose these APIs.

The default browser route is the carpark monitor. NASA measurement tools remain on `/?view=fleet`, `/?view=detail`, `/?view=thermal` and `/?view=operations`; they are not a homepage tab. Their existing API contracts are retained below; carpark simulation uses separate routes and tables.

## Carpark simulation API

All carpark responses carry simulation provenance through `sourceType: "simulation"` on the result/session/records and `exportable: false` on result/session/decision/AI-run records. These are deterministic demo frames, not camera or vehicle measurements. No `POST /api/frames` gateway is implemented. NASA `telemetry`, `events` and `audit` tables do not receive carpark frames, AI runs or decisions.

| Method / route | Response / input |
|---|---|
| `GET /api/carpark` | `schemaVersion: voltguard-carpark-state-1`, `layout`, current `session`, twelve bay summaries |
| `GET /api/bays/:id` | Bay configuration, summary, latest full frame, rule assessment, hotspot, up to sixty history samples, active alert, session, AI status / runs and append-only decisions; unknown bay returns 404 `BAY_NOT_FOUND` |
| `GET /api/alerts` | Current session and pending / handled alerts, sorted by pending status, danger then age |
| `POST /api/demo/scenario` | `{ "name": "A", "ai": false }` or B; starts a new session, clearing the previous current session's frames, alerts, runs and decisions; requires a boolean `ai` |
| `POST /api/demo/reset` | Exact empty JSON object `{}`; clears the current demo and begins normal baseline playback |
| `POST /api/alerts/:id/decisions` | Explicit operator decision; returns 201 with `decision`, updated `alert`, current `session`, simulation and non-exportable flags |

Browser writes require JSON, a trusted loopback host/origin and `X-Voltguard-Csrf` from `GET /api/health`. Invalid scenario/reset payloads return 422. Decision conflicts/invalid fields return 409 with a fixed code; unknown/stale alert returns 409 `ALERT_NOT_ACTIVE`. Carpark APIs are local-only. Session creation and AI configuration indicators do not prove provider quality.

`session` includes `id`, `startedAt`, `scenario` (A, B or null), `aiRequested`, `aiEnabled`, `aiConfigured`, `aiMode` (`provider`, `test_stub`, `unconfigured`), `sourceType`, `timeCompressed`, `exportable`. `aiEnabled` requires both the selected checkbox and a configured provider. `/api/health.aiConfigured` refers to the **NASA evidence assistant**; use `/api/carpark.session.aiConfigured` for carpark AI.

Bay summaries have `id`, status (`normal`, `warning`, `danger`, `no_data`), a separate `noData` flag, peak / rise values, occupancy / charging, sequence and alert reference. A newly connected normal-temperature bay initially has no comparable rate, so its data-quality detail indicates connecting; it is not certified normal. No-data overlays retain known warning/danger severity. Frames are `voltguard-frame-1`, 24 rows × 32 columns, with missing pixels kept as null. Full matrices and model reasons are fetched through detail, not WS. Rule thresholds are prototype values (60°C / 1°C/s warning, 80°C / 2°C/s danger), not validated whole-vehicle limits.

### Decisions

```json
{
  "level": "maintain",
  "extras": [],
  "aiStance": "none",
  "aiRunId": null,
  "operator": "P1",
  "viewedMs": 1200
}
```

- `level`: `downgrade`, `maintain`, `escalate`, or null when extras alone are selected. At least one level/action is required.
- `extras`: unique subset of `dispatch_patrol`, `notify_manager`, `call_999`. `call_999` is treated as escalation; it records a choice and does not call anyone.
- `operator`: trimmed, nonempty, up to twenty Unicode characters, no control characters. `operatorVerified=false`; no authenticated identity is claimed.
- `viewedMs`: nonnegative safe integer, the browser's viewing duration; not a physiological measurement or signed timestamp.
- `aiStance`: `none`, `confirmed`, `rejected`. `none` requires `aiRunId=null`; the others require the latest valid run from the current session and alert at the current severity. Confirmation requires the selected effective level to match the recommendation. Danger cannot be downgraded through any path; confirming battery-zone or undetermined-cause downgrade is also rejected.

Decisions append only and capture the server's latest full frame separately from the linked AI input frame (`aiRunId`, detail `aiRun`). Manual decisions work while AI is disabled, unconfigured, waiting or unavailable. Extra-only choices leave the alert pending. Maintain / escalation marks processing; manual downgrade marks observation without lowering the stored rule severity. A downgraded warning reopens on a +3°C increase, >=1°C/s rise or danger escalation; processed alerts close only after ten seconds of continuously normal, current evidence. Pending alerts do not auto-close when cooling. Prototype durations and deltas need field calibration.

### Carpark AI and independent storage

`serve.mjs` automatically loads the ignored private `.env`, with explicit process variables taking precedence. `VOLTGUARD_AI_ENABLED=true` plus `VOLTGUARD_AI_BASE_URL`, `VOLTGUARD_AI_MODEL`, `VOLTGUARD_AI_API_KEY` enables the configured OpenAI-compatible Chat Completions endpoint. Credentials never enter public status, WS or browser code. They are distinct from `OPENAI_API_KEY` for the NASA assistant.

Calls occur only on alert creation, escalation or reopening. One effective request per alert, two globally; preparation, queuing, network, JSON parsing and format fallback share a nine-second budget. Language switching does not call the model. New events invalidate prior runs; reset aborts old-session work and discards late replies. There is no answer cache, replay or local fabricated fallback.

The provider receives one fixed-palette 256×192 PNG with region outlines, program-computed hotspot labels, current/exact ten/thirty-second peaks, current rise, count over 60°C, rule/alert severity and charging context. Bay identifiers, timestamps, operator codes and the simulation scenario label are not sent. Output is exactly `cause`, `recommendation`, `rationale_zh`, `rationale_en`, `next_steps`, validated independently even with strict schema. Both reasons forbid digits and selected unsafe reassurance/firefighting language; protected causes / danger forbid downgrade. These lexical checks do not prove diagnostic accuracy or bilingual semantic equivalence.

`cause` allows `battery_zone_anomaly`, `brake_residual_heat`, `recently_parked`, `engine_or_exhaust`, `sun_or_ambient`, `undetermined`; `recommendation` allows `escalate`, `maintain`, `downgrade`. Traditional Chinese rationale is nonempty and at most eighty characters; English rationale at most three hundred. `next_steps` is a nonempty unique subset of `observe`, `dispatch_patrol`, `notify_manager`, `call_999`; the last requires `escalate`.

Detail `ai` status is `waiting`, `available`, `unavailable` or `stale`; a missing analysis has an explicit unavailable code. Actual run records include IDs/session, input frame and sequence, request severity, created time, model, measured `latencyMs`, `ok`, error code, output, hotspot and simulation flags. Public history excludes internally rejected raw output. Failures preserve rules and manual choices. Typical codes: `AI_NOT_CONFIGURED`, `AI_DISABLED`, `AI_NO_ALERT`, `AI_TIMEOUT`, `AI_REFUSAL`, `AI_PROVIDER_ERROR`, `AI_PROVIDER_RATE_LIMIT`, `AI_JSON`, `AI_INCOMPLETE`, `AI_OUTPUT_*`, `AI_STALE`, `AI_STORAGE`. A fixed code does not expose provider error text or keys.

`demo_sessions`, `bay_alerts`, `bay_ai_runs` and `bay_decisions` are independent SQLite tables. Reset deletes the current session and cascades its child records; the separate local evaluation files are not demo-session records and remain under ignored `.sites-runtime/`. There is no carpark export API.

### WS updates and evaluation

`WS /ws` retains measured-data messages and adds `{ "type": "bays" | "alert" | "ai" | "decision", "report": ... }`. `bays` is a once-per-second session + twelve-summary batch; `alert` carries event + alert, `ai` carries run status/error metadata, `decision` carries session/bay/alert/decision IDs. No matrix, model rationale or secret is broadcast. Browsers fetch only the selected bay's new detail. NASA record refresh ignores carpark messages.

Real checks are explicitly opt-in: `scripts/live-bay-ai-check.mjs` defaults to thirty real calls, comparing production evidence with image-only input, and saves time/validation/expected-cause/expected-recommendation metrics under `.sites-runtime/live-bay-ai/`. Image-only checks never enter the production flow. Results have synthetic provenance and do not establish vehicle diagnosis or a latency guarantee. See [round 7 measurements and remaining gaps](docs/BAY_AI_LIVE_CHECK.md). Ordinary tests and `qa-*` do not load private `.env` or call real providers.

## NASA / authorized telemetry contract

Required fields:

| Field | Meaning |
|---|---|
| `assetId` | Hardware alias, 1–48 ASCII letters/digits/underscores/hyphens; not VIN or plate |
| `mode` | `historical` or `live`; browser file imports use `historical` |
| `source` | Short measurement-source label; no personal information |
| `timestamp` | ISO 8601 timestamp including seconds and timezone |
| `temperaturesC` | Rectangular matrix with 1–64 rows/columns; numbers in −60…1000°C or `null` for missing sensors; at least one measured sensor |

Optional: `voltageV` (0…2000), `currentA` (−10000…10000), `socPercent` (0…100), `capacityAh` plus positive `initialCapacityAh`, `operatingState` (`driving`, `parked`, `charging`, `unknown`). Ranges are input guardrails, not vehicle operating limits. Other fields, including VIN, driver, location and license plate, are stripped.

Imported multi-record files use `{ "records": [telemetryObject, ...] }`. A file must use one alias, source and matrix layout, and strictly increasing timestamps. Files are capped at 1 MB and 1,000 records. A rise rate is calculated only from comparable consecutive points, at most 30 seconds apart. A single point or missing sensors cannot justify a fully normal assessment. File provenance is user-supplied and unverified, even if its source label says NASA.

NASA bundled-cycle reports use a separate trusted adapter because NASA dates are timezone-unspecified and the full-cycle 5-second rate is a source-derived summary. That adapter is not a live ingestion endpoint.

## Routes

| Method / route | Purpose |
|---|---|
| `GET /api/health` | Storage/configuration status and per-process browser CSRF token |
| `POST /api/telemetry/evaluate` | Validate one snapshot and produce a stateless rule-based report; no persistence |
| `POST /api/telemetry/ingest` | Authorized live gateway write; requires `Authorization: Bearer <secret>` |
| `GET /api/fleet` | Last live measurement per alias/source, with freshness checked at read time |
| `POST /api/records/nasa` | Save a bundled measured cycle and selected sample: `{ "cell": "B0005", "cycle": 168, "sampleIndex": 0 }` |
| `POST /api/records/import` | Save historical telemetry object, or `{ "record": telemetryObject, "previous": precedingObject }` |
| `GET /api/events` | Latest 100 events and their supporting report |
| `GET /api/events/:id/history` | Local event metadata, supporting report and the latest 200 recorded processing actions |
| `PATCH /api/events/:id` | `{ "action": "acknowledge" }` or `{ "action": "close" }` |
| `WS /ws` | Receive-only `connected`, `telemetry`, `events`, `heartbeat` and the carpark messages documented above |

Browser writes to record/event routes require `X-Voltguard-Csrf` from `/api/health`. API request body limit is 256 KB. Requests are JSON; non-finite values, ragged matrices, missing provenance, malformed dates, stale/future live timestamps and reordered live samples are rejected. Live timestamps must be at most 15 seconds old or 5 seconds ahead of the service clock. Hardware clock synchronization is a prerequisite, not something the server assumes it has verified.

The live gateway is disabled unless `VOLTGUARD_INGEST_TOKEN` is at least 24 characters. Neither the token nor the server-side AI key is sent to the browser. `VOLTGUARD_PORT` selects a different port. The optional local evidence assistant reads `OPENAI_API_KEY` at server startup. It stays unavailable until a key is configured; presence of a key does not verify provider access. The public static Site has no AI endpoint.

## Optional Copilot and official-source retrieval

`GET /api/copilot/rag?q=999&lang=en` returns curated keyword matches from two verified FSD pages, including source URL, scope, publisher and check date. Query length: at most 240 characters. Unknown topics return an empty list, not an invented answer. This route is read-only, does not call an LLM and is not vector retrieval. The public browser uses the same collection locally. Recheck official guidance before operational use.

`POST /api/copilot/diagnose` takes `{ "report": exportedMeasuredReport, "language": "en", "consent": true }`. Requires the per-process `X-VoltGuard-CSRF` token and the existing loopback/origin restrictions. Without explicit consent it returns 422. Without a key it returns 503 `AI_NOT_CONFIGURED`, never a fallback disguised as AI.

NASA references and selected measurements are reverified against bundled data. Historical imports are normalized and reassessed, ignoring supplied conclusions. A live review must resolve to a stored authorized measurement; its quality is refreshed before the AI/cache lookup. No report is stored by this route and no event transition occurs.

The server sends **only** the normalized matrix, computed evidence values, mode/scope, provenance category, rule labels and curated source summaries to OpenAI. It excludes hardware aliases, raw source strings, timestamps and locations. The sensor-index PNG is generated server-side from those same measurements, with no interpolation, inferred geometry or arbitrary user uploads. A one-channel NASA image carries no additional spatial diagnostic information.

Provider request: HTTPS Responses API, `gpt-4o`, `store:false`, text + measured PNG, strict JSON schema, 900 output tokens. Each process allows one in-flight request and at least five seconds between uncached attempts. A bounded 32-entry memory cache retains validated results for 30 seconds. Timeout: 12 seconds server / 16 seconds browser. Limits are development controls, not production quotas. API payload logs and AI replies are not written to SQLite or browser storage. Provider retention rules still apply; `store:false` is not a zero-retention guarantee.

Success: `schemaVersion: voltguard-copilot-1`, `model`, `generatedAt`, measured `latencyMs`, `cached`, `ruleStatus`, `explanation` (plain explanation + allowed evidence/source references + limitation codes), `evidence`, mandatory `limitations`, source guidance and `humanReviewRequired:true`. A cached response retains its original generation time and reports cache age/current lookup time. Limits include historical/unverified data, unknown physical layout, incomplete sensors and missing rate where applicable. This is not a diagnostic confidence or safety probability.

The output guard rejects new numerical claims, unsupported references, omitted mandatory limitations and selected unsafe reassurance/firefighting language. This lexical guard is **not proof of semantic accuracy**. Actual model quality, bilingual safety and latency still need real-key evaluation and expert review. The UI labels every result for human review. Model refusal, incomplete output, invalid JSON/schema, provider error, timeout or rejected response returns an explicit error and preserves Tier 1.

Documented provider references: [GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Images](https://developers.openai.com/api/docs/guides/images-vision), [data controls](https://developers.openai.com/api/docs/guides/your-data). Checked 3 October 2026. This NASA-assistant path has not been evaluated with a real key; the separately configured carpark AI was evaluated in round 7.

## Event semantics

Events use `open → acknowledged → closed`. Closing before acknowledgment is rejected. Thermal warning/danger events are separate from capacity reviews. Historical record saves are deduplicated by hashed alias, mode, source and measurement time. A healthy saved record is stored as telemetry but creates no fictitious event.

NASA `sampleIndex` is a zero-based index into the bundled, downsampled display-sample array, not an index into the original MATLAB stream. It defaults to 0 for older API clients. The service derives temperature, voltage, current, elapsed time and full-cycle assessment from that actual sample/cycle. The report includes a `sourceRef` identifying dataset, cell, cycle and display sample. Saving another point from an already saved cycle does not overwrite it: the duplicate response returns the original saved report, and the UI loads that report explicitly. A different sample can still be exported separately.

Live alerts coalesce by alias/source/kind while open or acknowledged. An acknowledged live thermal event cannot be closed until a newer, current, complete measurement with a valid normal rate assessment is available. Old or missing readings cannot resolve an incident. Events do not automatically activate equipment or call emergency services.

SQLite files are under `.sites-runtime/voltguard.sqlite` and excluded from Git/public artifacts. Event transitions are also recorded in an internal append-only `audit` table. This is a local development log, not a cryptographically tamper-proof audit service. Alias hashing is pseudonymization, not proof of anonymization; source labels still require operational discipline.

New events record creation, coalesced supporting-measurement updates, acknowledgment and closure as actual processing actions. Repeated acknowledgment returns 409 and does not create another audit row. Older databases retain their existing entries; missing creation actions are not backfilled. The history route returns `historyTotal` and `historyTruncated`; it returns at most the most recent 200 actions in chronological order, not a silently truncated full audit. Browser processing-time labels use UTC+8; JSON exports keep original UTC timestamps. No operator identity is authenticated or invented. The public static Site exposes no history API or database.

## Report reload and verification

The browser accepts `voltguard-report-1` JSON through the same measured-file input. User-source reports are normalized and reassessed from their `record` and optional `previousMeasurement`; claimed assessments, policies, provenance, AI output and audit fields are not trusted. Live reports are not reactivated as a live connection by file import.

For a NASA report, `sourceRef` must identify one of the four bundled cells and a valid cycle/sample. The browser loads that bundled cycle, compares every canonical measurement field exactly (including the original timezone-unspecified source date), and rebuilds the report. A local hashed laboratory alias is accepted only if it matches that referenced cell. A mismatched measurement is rejected and the previous valid report is retained. Older NASA reports without a source index must be re-exported from the bundled record. This verifies correspondence with bundled evidence; it is not a cryptographic signature, proof of OEM provenance or field-safety certification. `voltguard-event-history-1` downloads are separate local-log evidence, not an import format and never a way to inject actions into the database.

## Responses

Success returns sanitized reports with `provenance`, `record`, `assessment`, versioned prototype `policy` and limitations. Reports from imported consecutive records retain the preceding sanitized measurement so the rate is auditable. Typical errors: 401 missing gateway authorization, 403 invalid origin/CSRF, 404 missing route/event, 409 invalid event transition, 422 invalid telemetry. No error returns a simulated replacement record.

## Obtain real vehicle data

An authorized vehicle gateway must decode its actual OEM/BMS signals into this contract and provide a genuine physical sensor layout. Send measured files only; do not rename NASA historical samples as current vehicle data. This repository does not provide an OEM-specific decoder, vehicle credential, road-safety approval or automatic control interface.
