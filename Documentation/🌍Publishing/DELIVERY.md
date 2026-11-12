# Delivery — EDITORS.Wirelist

## Delivered 2026-11-11 – 2026-11-12

From this repository's own commits (the commit message is the record):

- vendor: apk-contracts web bundle refreshed from contracts/generated/web (report.ts: LogLine + ProblemRecord, System/Problems family) (`bc0750a`)
- vendor/apk-softapp: re-vendored — every problem card is reported through the SDK (ROAD-3695 step 2) (`e2386ff`)
- vendor: apk-contracts web bundle refreshed from contracts/generated/web (five report codes, ROAD-3695; unit-gate, ROAD-3684) (`ddab6ce`)
- re-vendor apk-contracts web bundle: contracts 2.4.0 retires APK.audio/Tests/{suite} (ROAD-3729) (`9485534`)

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-05, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.

## Unreleased
- **The wirelist as a query over an IFC model** (cabling-4, IFC4X3 is the core data model, owner 2026-11-06). **Open** takes a wirelist `.json` or an `.ifc`; **Open Bench** reads `GET /api/bim/bench.ifc` (DATABASE.server.BIM's stored twin of bench.json). `js/wirelistIfc.js` `wirelistFromIfc(text)` makes one row per run from the file's `IfcRelConnectsPorts`: an `IfcCableSegment` (end ports A, B nested in order) is ONE row — cable tag as the wire #, `Qto_CableSegmentBaseQuantities.Length` in mm, `APK_Connection` colour / status / part, the cable type's name — and a bare link (assumed, wireless) is one row by its connection id; each end is the nesting element's Tag (the bench ref, never an IP) and the port's name, with its connector (`APK_Terminal.Connector`, else `Pset_DistributionPortTypeCable`); a bench fan-out port answers for its terminal; the system is the `IfcDistributionSystem` grouping the cable, else both devices. IFC2X3 `RealizingElement` cables, `IfcRelConnectsPortToElement` and metre units are read too. The table's columns are `WIRELIST_COLUMNS` (adds Len (mm), both connectors and System), so Export CSV carries them.
- `js/ifc/step.mjs` is the contracts STEP codec (`contracts/src/ifc/step.ts`) as plain JS, made by `node tests/fixtures/make_step_codec.mjs` (contracts' own esbuild); the test fails when it is stale.
- Fixture: `tests/fixtures/seed-bench.ifc.gz` = the seed bench with two cables patched through `Bench.put_connection` (the real route code; one typed by a library cable part), and `seed-bench.expected.json` worked out without step.ts — devices, ports, cable facts from the bench JSON, connectors and systems from IfcOpenShell. Remake: `python -I tests/fixtures/make_bench_fixture.py` from the monorepo (IfcOpenShell for the full expectation). `npm test`: 18 pass.
- Open goes through `APKSoftapp.openModel` once `vendor/apk-softapp` is re-vendored with it; until then the app's own picker takes `.ifc` and `.json`.
