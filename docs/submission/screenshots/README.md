# Submission screenshots

Captured on 15 October 2026 from the English local UI at `http://127.0.0.1:4173/?lang=en`, using Edge/Playwright at 1800 CSS pixels wide. These are full-page browser PNGs with visible simulation labels; no UI content was edited or composited. Files 01–04 and 06 use `node serve.mjs` with AI explicitly disabled. File 05 uses the existing `scripts/serve-carpark-stub.mjs` preview on the same port and the same application/server factory, with an in-memory database and no provider calls. No private credentials appear in these images.

- [01-overview-six-bays.png](01-overview-six-bays.png) — Simulation baseline: all six B2 bays in one row, with B2-06 visibly No data; AI unavailable, no real model call.
- [02-scenario-a-wheel.png](02-scenario-a-wheel.png) — Simulation Scene A: B2-03 selected, front-wheel hotspot and Warning while parked and not charging; AI off, no real model call.
- [03-scenario-b-danger.png](03-scenario-b-danger.png) — Simulation Scene B: B2-02 selected, underbody at 80.0°C, Danger and the cannot-downgrade message; AI off, no real model call.
- [04-scenario-c-closeup-patrol.png](04-scenario-c-closeup-patrol.png) — Simulation Scene C: B2-04 after recording request_closeup + dispatch_patrol and waiting eight simulation seconds; close-up canvas and "Patrol report: hub is warm; underbody is not elevated." visible; AI off, no real model call.
- [05-ai-on-suggestion.png](05-ai-on-suggestion.png) — Simulation Scene A with AI enabled and an advisory suggestion: **test stub, not a real model**, visibly labelled TEST STUB; no provider call or real-model latency claim.
- [06-ai-off-manual.png](06-ai-off-manual.png) — Simulation Scene A with AI off: a submitted Maintain + Dispatch patrol decision and its expanded saved evidence demonstrate the complete manual path; no real model call.

For slides, retain the simulation label and, for file 05, the TEST STUB notice. The images show a prototype workflow, not vehicle accuracy, a live camera, fire certification or a user study.
