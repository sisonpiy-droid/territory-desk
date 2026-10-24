# Territory Desk

Single-page operations tool for Case 1 of an operations hackathon: franchise partner acquisition, geo-selection and onboarding for a retail brand in Karnataka. Team: Piyush and Garima. Judges score how well it solves the operations problem, not technical depth.

## Scoring
MVP 35% (video + live link), problem breakdown and assumptions 20%, adoption rollout 15%, deck 10%, live presentation 20%.

## How judges test (no login, no help)
1. Upload their Applications and Territories sheets. Some applications are incomplete or contradictory; several compete for one territory. The brand never opens two stores in one pin code. Per application: what happens to the partner and why; for approvals, next steps and how they are prepared to run the store.
2. Follow-ups in plain language ("Why is APP-007 on hold?") and new information ("APP-012 has now found a ground-floor space"); the decision must change sensibly.

Sheet 3 (existing stores) is fixed and embedded in src/engine.js as STORES. Allowed cities, pin prefixes and tiers are in CITIES.

## Deadline
Submission closes Monday 26 Oct 2026, morning. Feature freeze Sunday 6 pm. The live link must stay up until end of Wed 28 Oct 2026 (IST).

## Where things are
- docs/hackathon-guidelines.md, docs/case1-brief.md: the judges' own words. docs/research-notes.md: sources behind our thresholds.
- test-data/sample-judges-layout.xlsx: workbook in the exact layout judges will upload (title row, header, grey example row, data from row 4).

## Hard rules
- No login, no paywall, no rate limit anywhere in the core flows. Link must stay live until end of Wed 28 Oct 2026 (IST).
- Decisions are deterministic and traceable. No language model in the critical path.
- Every number on screen comes from the uploaded data or from a labelled, editable assumption. Never invent benchmarks.
- Plain JavaScript, no framework, one static deploy (dist/index.html).
- Ask before changing scoring thresholds or adding external services.

## Commands
- `npm install` once (jsdom and xlsx are dev dependencies for the tests)
- `npm run build`: inlines src/ into dist/index.html
- `npm test`: engine answer key, workbook load, and a headless page smoke test
- `npm run check`: build then test (run before every commit)

## Code map
- src/engine.js: parsing (parseApplications, parseTerritories), evaluateApp (flags, score), run (allocation with one store per pin, territory slots, counterfactuals), explain, onboardingPlan, letter (Kannada, Hindi, English). Assumptions live in DEFAULT_CFG.
- src/ui.js: state S, rendering, the Ask box (parseFields, answer), what-if updates, workbook import and export.
- src/sample.js: 20 sample applicants and 9 territories with planted traps.
- src/template.html: styles and shell. Design tokens on :root with light and dark values.
- src/modules/ops.js + src/ext/ops-view.js: operations view above the list (pipeline and leakage, worklist, territory health, before and after with editable minutes, adoption metrics). Pipeline clicks filter the list via S.filterIds. Overrides (Phase 2) should live in S.overrides so the adoption metric counts them.
- Overrides: a.override = { to, reason, at } on the applicant record (so undo covers it); engine core() honours it in allocation and refuses any approval that would break one store per pin, territory membership or slots (r.override.refused).
- src/modules/plan.js: backward plan per approved partner (latest signing date, owner and due date per step, at-risk), stages Approved to Open. src/modules/triggers.js: what would make a held or waitlisted decision change.
- src/ext/followthrough.js: override form in each record and in Ask ("Approve APP-001 anyway because ..."), Onboarding tab (stage board), Decision log tab, extra export sheets. Hooks added to ui.js: DeskExt.afterDetail, afterRecompute (with S.cause), exportSheets.
- src/modules/whatif.js + src/ext/confidence.js: confidence per decision (margin to next rival, data flags, fragility), fragile decisions (flip when one threshold moves 10%), side-by-side scenarios (Scenarios tab). Hook added to ui.js: DeskExt.rowBadges.
- src/ext/demo.js: "Play demo" button or link#demo plays the one-minute video sequence on the sample data (about 58 s), same every time.
- test/run.js: expected outcomes for the sample and key scenarios. test/file.js: the judges-layout workbook. test/ops.js: operations view numbers. test/phase2.js: overrides, plans, triggers. test/extras.js: confidence, fragility, scenarios. test/shots.js: Playwright screenshots (1360/390, light/dark). test/ui-smoke.js: page loads, follow-ups answer, no script errors.

## Adding features without merge conflicts
Two people work in parallel. Put pure logic in src/modules/*.js (loaded before ui.js) and UI in src/ext/*.js (loaded after). build.js inlines them in order: engine, sample, modules, ui, ext. Hook in through window.DeskExt: afterSummary (functions returning HTML shown above the tabs), tabs ({id, label, render}), afterRender, answerers (functions tried first by the Ask box; return HTML or null). window.__desk exposes S, E, ask, rerender, recompute, getApp, esc, pill, pushUndo, getRun.

## Decision outcomes
Approve (eligible and wins its pin and a slot), Waitlist (eligible but lost the pin or the territory is full), Hold (fixable gap or contradiction; the exact fix is shown), Reject (no territory in the city, or investment far below the floor).

## Style
UI copy is for a franchise expansion manager: sentence case, plain verbs, no "AI-powered", "engine" or "model" in the interface. Keep the pin board and the existing visual language.

## Hosting
Code is on GitHub (sisonpiy-droid/territory-desk). Vercel builds every push (vercel.json: `node build.js`, output `dist`, no install step). Only main goes to the production link judges use; branch pushes get preview links. Merge to main only when `npm run check` passes.

## Status for Session B (updated 24 Oct 2026 by Session A)
Session A has merged Phases 1 and 2 and extras 1 to 3 into main. Before starting, run `git pull origin main` and `npm install`, then `npm run check`.
- engine.js and ui.js were edited (overrides in allocation; hooks afterDetail, afterRecompute, exportSheets, rowBadges). Add to them only through new hooks where you can.
- Tests now include test/ops.js, test/phase2.js and test/extras.js; keep them passing.
- Phase 3 asked for Netlify: we host on Vercel instead (see Hosting). Vendored SheetJS should be served from dist/ so Vercel serves it from the same origin.
- The demo (link#demo) uses DeskExt answerers and the Ask box; if Phase 4 changes how follow-ups are parsed, run the demo once to confirm "Why is APP-007 on hold?" and "APP-012 has now found a ground-floor space" still behave.
