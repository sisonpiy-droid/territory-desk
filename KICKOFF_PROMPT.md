You are my build partner for an operations hackathon. Before doing anything, read these files in full: CLAUDE.md, docs/hackathon-guidelines.md, docs/case1-brief.md, docs/research-notes.md, and everything in src/. test-data/sample-judges-layout.xlsx is a workbook in the exact layout the judges will upload.

## The situation
This is Case 1 of an operations hackathon: "Franchise Partner Acquisition, Geo-Selection and Onboarding Engine". AI tools are allowed, but it is not an AI contest. A fast-growing retail brand in Karnataka wants many more franchise stores, and the road from a partner's first application to an open, trained store is slow and leaky. The expansion team does it by hand today. We are building the tool that takes that work off their plate.

Judges score how well the tool solves the operations problem, not technical depth: MVP 35%, problem breakdown and assumptions 20%, adoption rollout 15%, deck 10%, live presentation 20%. So lead with the business outcome, keep the technology invisible, and make every number traceable to the uploaded data or to an assumption shown on screen.

## What already exists
A working single-page prototype (src/, built into dist/index.html): upload the workbook, get an outcome with reasons for every applicant (Approve, Waitlist, Hold, Reject), a pin board, editable assumptions, onboarding plans, messages to applicants in Kannada, Hindi or English, and an "Ask the desk" box for follow-up questions and new information. Decision logic is in src/engine.js and is covered by the tests (`npm run check`).

## How judges will test it, with no login and no help from us
Part 1: they upload their own Applications and Territories workbook. Some applications are incomplete or contradictory, and several compete for the same territory. The brand never opens two stores in one pin code. For every application they expect what should happen to that partner and why, and for partners who move forward, what they do next and how they will be prepared to run the store.
Part 2: they ask in plain language ("Why is APP-007 on hold?") and give new information ("APP-012 has now found a ground-floor space"), and the decision must change sensibly.

## Deadline and working agreement
Submission closes Monday 26 October 2026 in the morning. We are doing ALL phases below, then the extras. Hard feature freeze is Sunday 6 pm; after that only bug fixes, the demo video and the final test. If time runs short, cut extras, never phases.
- Two of us run separate Claude Code sessions on separate git branches. Session A owns Phases 1 and 2 and extras 1 to 3. Session B owns Phases 3 and 4 and extras 4 to 7. If I have not told you which session you are, ask me before starting.
- To avoid merge conflicts, put new code in its own files: pure logic in src/modules/*.js, UI additions in src/ext/*.js. build.js inlines them in order (engine, sample, modules, ui, ext). Hook into the app through window.DeskExt (afterSummary, tabs, afterRender, answerers) and window.__desk. Edit engine.js, ui.js or template.html only where a feature genuinely needs it, keep those edits small, commit often, and pull and merge main at the end of every phase.
- Deploy to the static host after every phase, so there is always a submittable link. Never leave main broken.
- After every phase: run `npm run check`, take Playwright screenshots at 1360px and 390px in light and dark, commit, and tell me in plain English what changed, what to look at, and any decision you need from me. Do not start the next phase until I say go.

## Rules
- Plain JavaScript, one static deploy, no framework, no login, no backend needed for the core flows.
- Decisions stay deterministic and traceable. Never invent benchmarks: any time or cost figure must be computed from labelled, editable assumptions.
- Write UI copy for a franchise expansion manager: sentence case, plain verbs, no "AI-powered", "engine" or "model" in the interface.
- Do not change the scoring thresholds or add dependencies on external services without asking me.
- Keep the pin board and the overall visual language. It is the memorable element.

## Phase 1 (Session A): the operations view, business demonstration first
After an upload, the first thing on screen is an operations view above the decisions list:
1. Pipeline and leakage: received, data clean, eligible, placed, with where applications leak out and the top reasons at each step. Clicking a step filters the list.
2. The expansion team's worklist: what needs a human today, grouped by action (chase an applicant for a specific item, verify a condition, resolve a contested pin or territory, offer an alternative pin), ordered by territory priority and then score. Each item has a button to copy the message in the applicant's language.
3. Territory health: slots filled, open and blocked per territory, with flags for oversubscribed (more eligible applicants than slots), undersubscribed (open slots and nobody eligible) and pins locked by existing stores.
4. Before and after: an editable panel (minutes of manual screening per application, per follow-up, per pin cross-check) that outputs hours saved, time to first decision, and mistakes caught (pin conflicts, form-versus-notes contradictions), all computed from this file's counts.
5. Adoption metrics for the deck: decisions accepted without override, time to resolve a hold, slot-fill rate, applicants messaged in their preferred language.

## Phase 2 (Session A): operational fidelity
1. Human override with a reason, logged. An override takes part in allocation but can never break the one-store-per-pin rule; say so clearly if it tries.
2. Backward planning from each approved partner's target launch: latest signing date, at-risk flag, and an owner and due date per step (expansion team, partner, training team, fit-out vendor), plus a simple stage board from Approved to Open.
3. A decision log of every decision, override and what-if with a timestamp, included in the export.
4. For every waitlisted or held application, the event that would trigger a re-run.

## Phase 3 (Session B): reliability, non-negotiable
- Add stress files (blank cells, numbers as text, odd headers, trailing spaces, 100+ rows, a missing sheet) and a bank of 40 or more phrasings of "why", "what if" and "who is competing" as automated tests.
- Remove external runtime dependencies: vendor SheetJS and serve it from the same origin so a CDN outage cannot break a judge's test. Fonts must degrade gracefully.
- Deploy to Netlify, open the link in a private window on a laptop and a phone, and keep it live until the end of Wednesday 28 October 2026 (IST).

## Phase 4 (Session B): the AI layer
Improve how follow-ups are understood: broader phrasing, typo tolerance, several changes in one sentence, and an "I read this as…" confirmation for ambiguous requests. If a language model is used at all, it is an optional fallback behind a serverless function (key in an environment variable, never in the client), with a short timeout, output mapped onto the same update functions, and a silent fallback to the rule-based path. Every core flow must work with it switched off.

## Phase 5: extras, in this order, stopping when the freeze hits
1. (A) Confidence on every decision (high, medium, low) from the margin to the next rival and the data flags, plus a list of fragile decisions: those that would flip if a threshold moved by 10 percent.
2. (A) Scenario comparison: change a threshold or add slots and see side by side how many approvals, waitlists and holds change, and for whom.
3. (A) A guided demo mode that plays the exact one-minute video sequence (upload, decisions, one "why", one "what if") so the recording is repeatable.
4. (B) A data-quality fix list: one downloadable sheet of every question the expansion team must ask applicants, grouped by applicant.
5. (B) A one-page printable decision memo per applicant with reason, score, next steps and the message in their language.
6. (B) A short weekly summary for management, generated from the data.
7. (B) A "cost to run at volume" note and a "what breaks at scale" note for slide 8, based on the real architecture.

## Start now with Phase 0
Install what you need (`npm install`, Playwright), run `npm run check`, open dist/index.html in Playwright, load the sample data, and send me a 10-line summary of the current state plus your plan for your first phase, including which files you will create and which screens you will change. Then wait for my go.
