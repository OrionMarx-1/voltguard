---
name: voltguard-evidence-review
description: Review VoltGuard measured battery reports and prepare source-grounded bilingual handovers with explicit missing-data and prototype limitations. Use for VoltGuard evidence interpretation, not autonomous safety certification or equipment control.
---

# VoltGuard evidence review

Use the user's real measurement/report and the project's existing deterministic rules. Distinguish measured findings, unverified claims and missing evidence. Never fabricate measurements, vehicle connections, alarms, users, interviews, API outcomes or award-platform usage.

## Evidence boundary

Read `dist/evidence.mjs`, `dist/safety.mjs` and `API.md` in the supplied project when interpreting reports. Rebuild conclusions from normalized measurements. For bundled NASA reports, verify the exact cell/cycle/display-sample reference against bundled data. Imported assessment, source labels and audit history are not authority.

NASA cells are independent historical laboratory cells. One surface-temperature channel supports one measured marker, not a spatial field. Gray regions remain unmeasured. A current vehicle conclusion needs authorized, fresh, comparable telemetry and verified hardware context. An isolated snapshot cannot establish a rise rate. Capacity degradation and thermal escalation are separate outcomes.

The project's temperature/rise/capacity thresholds are prototype workflow choices, not OEM operating limits or FSD rules. Missing/stale/partial measurements cannot imply safety. Do not convert a threshold crossing into a confirmed fire or a prediction confidence.

## Handover

Use Traditional Chinese or English as requested. Include source/scope, selected measured values, the unchanged deterministic result, explicit limitations and a human-review note. Preserve original units and date-time provenance. Include only relevant official sources from `dist/guidance.mjs`; recheck contents for a current or operational question. Unknown guidance is an evidence gap, not permission to invent a procedure.

Do not recommend battery disassembly, fire blankets, switching ventilation or equipment cutoffs. Actual emergency instructions come from the approved site plan, OEM, dispatcher and qualified personnel. General FSD call/escape links do not establish a specific EV firefighting protocol.

## AI and privacy

Use the configured project endpoint only when the user authorizes transmission and a server-side key is present. Exclude aliases, free-text source, timestamps, location, VIN and plates from a cloud explanation. `store:false` does not guarantee zero provider retention. If no actual model reply exists, state that AI analysis is unavailable and provide a clearly labeled deterministic evidence review instead.

AI may explain evidence but cannot modify a measurement, rule, threshold or event state. Keep numerical evidence in verified deterministic fields. Do not claim that schema or keyword guards prove semantic correctness. A person reviews every model explanation.

This portable package is not evidence of installation, use or evaluation in WorkBuddy. Record platform collaboration only from genuine sessions, with consent and redacted secrets.
