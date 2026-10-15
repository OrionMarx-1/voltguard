# Public repository preparation check

Checked on **15 October 2026**, before the first public push. No product behavior, scene physics, thresholds, prompts or UI copy were changed for this submission pack.

## Sensitive information

- Gitleaks **8.30.1** scanned the complete pre-existing history (`--all --full-history`): **71 commits**, no findings. Release commits are scanned again before publication.
- A separate exact-value audit compared configured private credentials against all **1,041 reachable historical blobs** (17,653,546 bytes) and the working source tree. No credential occurred in history or publishable source. The sole working-tree credential location was the intentionally private, ignored `.env`; its value was neither printed nor copied into a report.
- Gitleaks also scanned the working directory with `.git/` and `.sites-runtime/` excluded. Its only finding was that same private `.env`. Runtime tools, databases and raw reports are local-only; none are added to Git.
- Historical object paths contained no private `.env`, `.sites-runtime/` artifacts or live-bay raw JSON reports. Sanitized evaluation documentation and test fixtures remain in source.
- `.gitignore` excludes `.env`, `.env.*` and `.sites-runtime/`, with only `.env.example` explicitly permitted. The committed example contains empty values only.

## Size, attribution and identity

No historical reachable file was 50 MiB or larger; there were no GitHub file-size exceptions. The six new PNGs are each below 1 MiB. The NASA data attribution and the vendored Three.js MIT notices are retained. Existing Git author identity was not changed. No history rewrite or force push was used.

## Verification

The full Node test suite passed before committing the run documents. Existing browser checks `qa-navigation.mjs`, `qa-carpark.mjs`, `qa-carpark-decisions.mjs` and `qa-carpark-ai.mjs` all returned `"ok":true`, with no page errors and no real-provider calls. Screenshot capture asserts the required bay, severity, hotspot, simulation labels, danger lock, saved manual decision and simulated follow-up content. The complete test suite is rerun after adding the screenshot checks.

Raw scanner output stays in ignored local runtime storage because reports can contain sensitive material. This check records the result without publishing credentials, rejected provider output or raw live-model reports.
