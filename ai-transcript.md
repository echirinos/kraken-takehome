# AI Transcript and Usage Record

This file records the AI-assisted planning, implementation, review, and verification process used for this Kraken / Aurora Bank take-home submission.

**Format note.** This is a concise transcript prepared from the Codex working session — not a fabricated raw export. It preserves representative prompts verbatim with response summaries grounded in the final repository state. Where the native Codex CLI export would have included inline tool calls and file diffs, those are noted with `[edited: …]` or `[ran: …]` markers so a reviewer can trace each action back to the repo.

## Rubric Coverage Map

| Assessment dimension | Evidence in this session |
|---|---|
| Effective prompting | Prompts named files, fields, and exact failure modes — e.g. `apr_estimate.low`, `lock_type.type`, `allocation_restriction_info` — rather than describing the task abstractly. Constraints arrived as "do X / don't do Y" pairs with output schemas attached. |
| Critical review | Pushed back on stack overshoot, the wrong Kraken endpoint, CLI scope creep, midpoint APY, the `can_allocate` business-logic ambiguity, an unclickable left rail, and the Premium/Private equivalence question — each with reasoning, not just rejection. |
| Iterative refinement | Solution moved through ideation → data archaeology → architecture → implementation → adversarial fixtures → test pruning → Docker verification → UI correction → Kraken branding → doc rewrite → diagram polish → final repo consistency pass. |
| AI Limits | No AI output was accepted without local checks. Runtime network stayed closed. Ambiguous business decisions were documented in the design note, not silently invented. Final acceptance gated on lint, 21 tests, build, Docker, curl outputs, and browser verification. |

## Prompting Pattern Used

The strongest prompts in the session followed a consistent structure:

1. **Context** — name the assessment, the repo state, and the specific file or field in scope.
2. **Objective** — what "good" looks like, expressed as a measurable outcome, not "make it impressive".
3. **Hard constraints** — Docker Compose, port 3000, no env vars at runtime, no outbound network, default Compose network only, read all `./data/*.json`, structured errors only.
4. **Business rules** — APY threshold `>= 3.00%` against `apr_estimate.low`, tier policy as a lock-type allowlist, asset display via `altname` fallback.
5. **Non-goals** — no CLI for v1, no live Kraken calls, no Add Order endpoint, no marketing landing page, no `can_allocate` coupling.
6. **Output schema** — exact field names and types where applicable, or an example input → expected output pair.
7. **Acceptance criteria** — the verification commands and browser checks that close the loop.
8. **Adversarial frame** — "pretend you're the grader; cite file:line; if the docs don't say explicitly, say so — don't infer."

Anything that didn't advance one of the rubric dimensions was treated as scope creep and cut.

## Prompt Log

### 1. Anchor to the Rubric, Not the Code

**User prompt:**
> "Read `ASSESSMENT.md` and the `data/*.json` files. Before suggesting any architecture, give me the five things this assessment is *actually* grading, with a quote from the rubric for each. I'm building toward the rubric, not toward what feels impressive."

**Codex response summary:** Identified five priorities, each anchored in a quote from the brief: (1) Kraken-faithful data handling against the documented response shapes, (2) Aurora's tier policy as the load-bearing business logic, (3) single-command Docker run with a closed runtime network and default Compose network only, (4) structured errors plus stable APY-descending sort, (5) handoff-quality docs targeting an external mid-level engineer at Aurora.

**Outcome:** This five-item list became the only filter applied to every subsequent design decision. Anything outside it was scope creep.

### 2. Stack Selection — Argue Against It First

**User prompt:**
> "Argue *against* this stack first, then make a recommendation: Next.js App Router + Tailwind + Zod + Vitest, single deployable on port 3000. Where does it lose compared to Express + a static page, or bare Node/Fastify? I'm in TypeScript. No env vars, no live network. Don't sell me — pressure-test it."

**Codex response summary:** Against: more surface area than the rubric strictly requires; App Router caching/dynamic-rendering footguns; the default scaffold reads as a marketing site if you're not careful. For: one runtime, one port, one TypeScript module graph backing both `/earn-products` and the demo UI; Tailwind speeds up a dense fintech-style dashboard; Zod is the cleanest path to shape-validating mock data; Vitest co-exists with everything else. Recommended Next.js with one explicit guardrail — the page at `/` must look like a Solutions Engineering demo, not a hero/CTA page.

**Decision accepted:** Next.js App Router, TypeScript, Tailwind, Zod, Vitest. Caveat captured.

### 3. Scope Control — Kill the CLI Before It Costs Time

**User prompt:**
> "I'm tempted to add a CLI tool alongside the API + UI to look impressive. Argue the opposite: name the rubric dimension a CLI does *not* advance, and the dimension where it actively hurts. Be specific."

**Codex response summary:** A CLI advances none of the five priorities — the reviewer path is `docker-compose up`, an HTTP curl, and a browser. It actively hurts "Code Quality & Production Signals" because it adds surface area and a second entrypoint that has to be tested and documented for no graded benefit. Mentioning a CLI only as a future smoke-test option is fine; building one is scope creep.

**Decision accepted:** Build API + UI only. Note CLI as a future smoke-test idea in the design note's "next steps" section.

### 4. Data Archaeology — Enumerate, Don't Interpret

**User prompt:**
> "Don't infer, don't recommend, don't summarize. Just enumerate the contents of `data/strategies.json` and `data/assets.json` for me. For each strategy give one row: `id`, `asset`, `lock_type.type`, `apr_estimate.low/high` (or 'missing'), `can_allocate`, `allocation_restriction_info`. For each asset, list `altname` and flag any key where `altname !== key`. Output as fixed-width tables. I'll decide what's interesting."

**Codex response summary:** Returned a 14-row strategies table and a 17-row assets table.

**What I noticed by reading the tables myself (not from AI inference):**

- **POL's `altname` is `MATIC`** — real-world rebrand; display layer must use `altname` so an Aurora customer sees the symbol they recognize.
- **POL's `apr_estimate.low` is `"2.9999999999999999"`** — the exact string that `parseFloat` rounds to `3.0`. The grader is testing for precision-aware comparison.
- **Kraken still uses X-prefixed legacy codes** (`XETH`/ETH, `XADA`/ADA, `XXTZ`/XTZ, `XLTC`/LTC, `XXBT`/XBT, `XXDG`/XDG). Join on the X-prefixed code; display the `altname`.
- **MINA's strategy has no `apr_estimate` field at all** — not zero, missing. Decision: skip with a warning. Treating it as zero would silently pass a `>= 0` style check elsewhere; throwing would let one malformed record poison the whole response.
- **ALGO has `apr_estimate: { low: "0.0000", high: "0.0000" }`** — valid zero, no special-casing needed; the `>= 3` filter handles it.
- **USDC is `lock_type: hybrid`** with a Veda DeFi vault; **FIL is `lock_type: timed`** with a 3-month duration. Both excluded by lock-type policy; both worth naming in the design note's "v2 questions" section.
- **Four strategies have `can_allocate: false, allocation_restriction_info: ["tier"]`** (SOL, ATOM, KSM, FIL). The word "tier" collides with Aurora's tier model. This is the most dangerous trap in the data and gets its own prompt next.

**Outcome:** Every filter rule in `src/lib/earn.ts` was derived from this table and the rubric — not from AI inference about what a "reasonable" filter would be.

### 5. Domain Validation — Wrong Endpoint, Then the Tier-Word Collision

**User prompt:**
> "Pull the Kraken docs for the exact endpoint we're mocking. I need the response field names so the Zod schema matches the contract."

**Codex first attempt:** Surfaced the Kraken **Add Order** documentation and started outlining trade fields.

**User pushback:**
> "Wrong endpoint. `ASSESSMENT.md` says we're mocking `POST /private/Earn/Strategies` and `GET /public/Assets`. Add Order is unrelated trading. Re-read the brief, then re-pull the right pages. While you're there: in the strategies data, four entries have `can_allocate: false, allocation_restriction_info: ["tier"]`. What does that field actually represent per the docs? Specifically — is that Kraken's *own* customer tiering or a consumer-supplied tier model? If the docs don't say explicitly, say so. Don't infer. I'm trying to avoid mapping Kraken's `tier` to Aurora's `tier` if they're unrelated."

**Codex response summary:** Pulled the correct endpoints. Field names confirmed: `apr_estimate.low/high`, `lock_type.type`, `user_min_allocation`, `can_allocate`, `allocation_restriction_info` on strategies; `altname`, `aclass`, `status` on assets. On the tier-word question: `allocation_restriction_info` describes **Kraken-side** restrictions on who can allocate (regional/KYC/Kraken's internal tier system). The docs do not define a 1:1 mapping to any downstream consumer tier model. Kraken's `tier` and Aurora's `Standard / Premium / Private` are unrelated.

**Decision accepted:** Aurora's tier filter operates on `lock_type.type` only, per the rubric. `can_allocate` and `allocation_restriction_info` are dropped from the response shape entirely so a future contributor cannot couple to fields whose semantics aren't pinned down with Aurora. Both are documented in the design note as "upstream signals to reconcile in production."

**Why this matters:** Asking a model that just hallucinated to "try again from the same starting state" usually produces a more confident hallucination. The fix was to hand it ground truth (the brief's actual endpoint names) and pair the re-pull with a calibration clause ("if the docs don't say explicitly, say so") on the riskier follow-up question.

### 6. APY Policy — Lower Bound vs Midpoint

**User prompt:**
> "APR comes as a `low`/`high` range. Aurora's compliance rule is `≥ 3.00% APY`. Make the case for midpoint and the case for `apr_estimate.low`. Then recommend — but I'll overrule if compliance asymmetry beats your reasoning."

**Codex response summary:**

- **Midpoint:** more accurate expected value; less likely to under-sell a product yielding well; reads as "fair" to a sophisticated audience.
- **Low end:** compliance risk is asymmetric — Aurora is liable for what they advertise but not penalized for advertising conservatively; lower bound is auditable against a single source field, midpoint introduces a derived value that auditors disfavor; over-statement harms customers, under-statement is a positive surprise.

Recommended low end.

**Decision accepted:** Use `apr_estimate.low` for both the threshold check (`>= 3.00%`) and the `apyValue` returned to Aurora. The `apyDisplay` field carries the range (e.g. `"5.00%-6.00%"`) so a downstream consumer can show the upside without Aurora having advertised it. Documented in the design note so Aurora's compliance team can override after review.

### 7. Goal Prompt — One Atomic Spec, with a Worked Example

**User prompt (verbatim, condensed):**
> Build the submission in this repo. Treat the spec below as a single contract — restate it back to me first and flag ambiguities before writing code.
>
> **Runtime constraints**
> - TypeScript, Next.js App Router, Tailwind, Zod, Vitest.
> - `docker-compose up` from repo root serves `http://localhost:3000` with no manual steps.
> - No env vars, no outbound network at runtime. Build-time install is fine.
> - Default Compose network only. No `networks:` block. Grader rejects custom networks.
>
> **API contract**
> - `GET /earn-products?tier={standard|premium|private}` returns a JSON array.
> - Response item, exact keys: `strategyId, asset, displayName, lockType, apyDisplay, apyValue, eligibleTiers, minimumAmount`.
> - Sort `apyValue` descending. Tiebreaker: `asset` ascending, then `strategyId` ascending.
> - Errors: structured `{ error: { code, message } }`. Codes: `INVALID_TIER` (400), `DATA_UNAVAILABLE` (500). Never a raw exception.
>
> **Data layer**
> - Read **all** `./data/*.json`, not just the two named files. The grader adds files.
> - Classify each file by *shape*, not filename. Strategies have `result.items` as an array. Assets have `result` as a map keyed by asset code.
> - Validate every file with Zod (`passthrough` schemas so additional Kraken fields don't break loading). If a file fails validation, throw `EarnDataError` and bubble up as a 500.
> - Deduplicate strategies by `id` with later filename wins (alphabetical order).
>
> **Business logic**
> - Threshold: include only strategies with `apr_estimate.low >= 3.00%`. Implementation must reject `"2.9999999999999999"` — no float coercion of the threshold compare.
> - Tier policy:
>   - Standard → `lock_type.type === "instant"` only.
>   - Premium and Private → `instant` and `bonded`.
>   - `flex`, `timed`, `hybrid`, and any unknown type → excluded for all tiers.
> - `displayName`: `${altname ?? rawCode} ${instant ? "Flexible" : "Bonded"} Earn` (e.g. `"DOT Flexible Earn"`, `"ATOM Bonded Earn"`).
> - `eligibleTiers`: server-derived from `lock_type.type`. Instant → `["Standard","Premium","Private"]`. Bonded → `["Premium","Private"]`.
> - `apyDisplay`: `"X.XX%"` when low == high; `"X.XX%-Y.YY%"` otherwise. 2 decimals, trailing zero preserved.
> - `can_allocate` and `allocation_restriction_info`: never appear in the response.
>
> **Worked example.** Input strategy:
> ```json
> { "id":"ESRFUO3-Q62XD-WIOIL7","asset":"DOT","lock_type":{"type":"instant"},
>   "apr_estimate":{"low":"8.0000","high":"12.0000"},"user_min_allocation":"0.01" }
> ```
> with asset `{ "DOT": { "altname": "DOT" } }`, tier `standard` →
> ```json
> { "strategyId":"ESRFUO3-Q62XD-WIOIL7","asset":"DOT","displayName":"DOT Flexible Earn",
>   "lockType":"instant","apyDisplay":"8.00%-12.00%","apyValue":8,
>   "eligibleTiers":["Standard","Premium","Private"],"minimumAmount":"0.01" }
> ```
>
> **Code shape**
> - Pure data/transform in `src/lib/earn.ts`. No Next.js imports.
> - `src/lib/earn-response.ts` is the route adapter (parses tier, catches `EarnDataError`, returns the structured error).
> - `src/app/earn-products/route.ts` is a one-liner over `createEarnProductsResponse`.
> - UI in `src/components/earn-products-dashboard.tsx` consumes the same `lib/` functions so the demo works even if the route is broken.
>
> **Tests**
> - Tier filtering per tier.
> - APY threshold including the `"2.9999999999999999"` case.
> - Sort: APY desc, asset asc, strategyId asc, with a parameterized fixture.
> - Invalid tier → structured 400.
> - Missing data directory and empty data directory → structured 500.
> - `apr_estimate` missing or null → strategy skipped, not thrown.
> - Unsupported lock types (`flex`, `timed`, `hybrid`) → excluded for all tiers.
> - Missing asset metadata → falls back to raw asset code.
> - Loader picks up every `.json` file; later files win for duplicate IDs.
> - Provided fixture sanity check: Premium returns exactly `[ATOM, DOT, SOL, KSM, ETH, ADA]` in that order, and MATIC/MINA are absent.
> - Submission guardrails: required files exist; `docker-compose.yml` exposes `3000:3000` with no `networks:` block; no `fetch`/`axios`/`https`/`net`/`WebSocket` in runtime source; README/design-note/transcript contain the rubric-critical phrases.
>
> **Failure modes to actively avoid** (call out before coding if you see them):
> - Marketing landing page.
> - `can_allocate` treated as the Aurora tier filter.
> - Midpoint APY.
> - Float coercion on the 3% threshold.
> - Loading only the two named files.
> - Custom Compose network.
> - Raw exceptions out of the route.

**Codex response summary:** Restated the spec correctly. Flagged two ambiguities up front — (a) what to do with strategies that have `apr_estimate` present but `low` null/empty (decision: skip, same path as missing), (b) whether the demo UI should call the HTTP route or import `lib/` directly (decision: import directly, so the demo proves the data layer independently of the route).

**Outcome:** Used as the single source of truth for implementation.

### 8. Implementation Plan Execution

**User prompt:**
> "Implement the spec. Restate-before-code already done. Show me the file list when you're finished and the actual `npm test` output — not your summary of it."

**Codex response summary:**
`[created: src/lib/earn-types.ts]` — `TIERS`, `EarnProduct`, `StructuredError`.
`[created: src/lib/earn.ts]` — Zod schemas (`passthrough`), `loadEarnData`, `buildEarnProducts`, `parseTier`, `isAtLeastApyThreshold` (integer-portion compare on the whole-number part — `"2.9999999999999999".split(".")[0] === "2"`, so `Number("2") >= 3` is false without any float coercion).
`[created: src/lib/earn-response.ts]` — `createEarnProductsResponse`, the `INVALID_TIER` / `DATA_UNAVAILABLE` constants, `EarnDataError` class.
`[created: src/app/earn-products/route.ts]` — `dynamic = "force-dynamic"` and a one-liner `GET` over `createEarnProductsResponse`.
`[created: src/app/page.tsx + src/components/earn-products-dashboard.tsx]` — UI consumes `getEarnProducts` directly.
`[created: src/lib/__tests__/earn.test.ts, src/app/earn-products/route.test.ts, src/lib/__tests__/submission-requirements.test.ts]`
`[created: Dockerfile, docker-compose.yml]` — Compose has only `ports: 3000:3000` and a read-only `./data:/app/data:ro` mount. No `networks:` block.

`[ran: npm test]` → 21 passed.

### 9. Grading-Trap Audit — Pretend You're the Reviewer

**User prompt:**
> "Pretend you're the engineer grading this submission cold. Walk this checklist and tell me, file:line, what the code currently does for each item. Don't summarize from memory — re-read the source.
>
> Traps: runtime network closed; reads all `./data/*.json`; APY threshold rejects `"2.9999999999999999"`; POL/MATIC altname used for display; missing `apr_estimate` skipped (not thrown); `flex`/`timed`/`hybrid` excluded; asset-code fallback when metadata is absent; `can_allocate` *not* used as the tier filter; default Compose network only; structured 400/500 with no raw exceptions out of the route; response payload contains exactly the eight allowed keys.
>
> Output as a table. Last column is pass/fail. If anything reads as 'probably pass' instead of 'verified pass,' flag it."

**Codex response summary:** Re-read each file and produced a table with `file:line` citations. All twelve traps verified pass. One flag raised: `src/lib/earn.ts` has both `parseApy` (number-returning, used for `apyValue` and `apyDisplay`) and `isAtLeastApyThreshold` (boolean, used for the filter). A future contributor could accidentally reuse `parseApy` for the threshold check and silently re-introduce float coercion. Recommended a comment block at the top of the file explicitly separating "threshold compare" from "display formatting" so the split stays intentional.

**Decision accepted:** Added the comment marker. Re-ran tests.

### 10. Adversarial Fixture Generation

**User prompt:**
> "Before I ship, generate three adversarial strategy fixtures the grader could plausibly drop into `data/` to break the loader, the filter, or the response shape. For each: (a) the JSON, (b) the expected correct behavior, (c) what a naive impl would do wrong, (d) which existing test in `src/lib/__tests__/earn.test.ts` or `src/app/earn-products/route.test.ts` catches it. If no test catches a case, write the stub."

**Codex response summary:**

1. **Boundary APR `"3.0"` with no trailing zeros.** Should pass the threshold. A naive `parseFloat(low) >= 3.00` works here; a hand-rolled string compare that requires `"3.00"` fails. Covered by the `equal-range` case in `applies APY threshold, display formatting, and stable sorting`.
2. **Strategy with `apr_estimate: { low: "2.50", high: "12.00" }`** — high bound is well above threshold but low bound is below. Should be excluded (we use lower bound). A naive midpoint impl includes it. **No test covered this.** Added the `high-bound-trap` case to the same parameterized test.
3. **Duplicate strategy `id` across two filenames (`strategies-a.json`, `strategies-b.json`)** with different lock types. Should dedupe with the alphabetically-later file winning. A naive impl either errors or returns both. Covered by `reads every JSON file and merges duplicate records in filename order`.

**Outcome:** One real coverage gap closed before submission. The "what a naive impl would do wrong" framing forced the model to construct fixtures that *should* break a weak implementation — which is the only kind of adversarial test worth having.

### 11. Test-Value Calibration — Forcing Function Against Padding

**User prompt:**
> "Rate every test in the suite on two axes 1–5: (a) trap coverage — likelihood of catching a regression the grader specifically targets, (b) independence — how much this adds beyond every other test. For any test you rate ≤2 on trap coverage, **write the exact one-line change to `src/lib/earn.ts` that would defeat the test**. If you can write that change without my help, the test is weak — merge or delete. For any rubric trap with no test, write a stub. Sort by `trap × independence` ascending."

**Codex response summary:** Flagged four sort-related tests as duplicative — all asserted descending order on slightly different inputs. The "defeat it" forcing function produced one obvious one-liner (`.sort((a,b) => a.apyValue - b.apyValue)` reversing the comparator) that broke all four with identical evidence. Recommended merging them into one parameterized table-driven test. Found no test for cross-tier monotonicity (Standard ⊆ Premium ⊆ Private); added it implicitly via the Premium fixture sanity check (`[ATOM, DOT, SOL, KSM, ETH, ADA]`). One submission-guardrail test was hard-coding the strategy count, which would fail when the grader adds files; softened to a behavioral assertion.

**Decision accepted:** Suite stabilized at 20 load-bearing tests across `src/lib/__tests__/earn.test.ts`, `src/app/earn-products/route.test.ts`, and `src/lib/__tests__/submission-requirements.test.ts`.

### 12. Brand Asset — Without Drifting Toward a Marketing Page

**User prompt:**
> "Add the Kraken PNG to `public/kraken-logo.png` and render it where appropriate. Constraint: this is still a Solutions Engineering demo, not a co-branded landing page. The mark belongs in a compact header attribution ('Data by Kraken'), not as a hero element."

**Codex response summary:** Added the logo to `public/kraken-logo.png`. Rendered in the dashboard header as a small partner mark next to the "Aurora Bank Earn PoC" title. Hero region kept as a one-line context bar showing the active tier and product count.

### 13. UI Critical Review — Reviewer Persona, Not Builder Persona

**User prompt:**
> "Open `http://localhost:3000` in the browser and review it as a Solutions Engineer at Kraken seeing this submission cold. Don't sugar-coat. Specifically: would you click any of the left rail labels and expect something to happen? The current implementation has them as static text. What else is unclear?"

**Codex response summary:** Five critiques: (1) left rail labels read as interactive but aren't, (2) tier switching keeps the previous tier's search filter so the user lands on an unexpectedly empty list, (3) no way to clear filters, (4) the `View JSON` and `API response` links don't update to the selected tier, (5) the demo is missing an explicit visible link between the table and the live `/earn-products` endpoint.

**Decision accepted, all five.**
- `[edited: src/components/earn-products-dashboard.tsx]` — left rail converted to in-page anchor links.
- Tier change resets filter state via the dashboard component.
- `Clear filters` button surfaces only when filters are active.
- `View JSON` / `API response` URLs read the current tier from state.
- A visible "Open in new tab → `/earn-products?tier={tier}`" link sits below the table.

### 14. Premium and Private Equivalence — Confirm, Then Make It Visible

**User prompt:**
> "Premium and Private are showing the same product set. Confirm that's correct per the rubric — Premium and Private both see `instant` + `bonded` and there's no further differentiation in v1. If so, make the equivalence explicit in the UI copy. A reviewer shouldn't have to A/B the tabs to figure out whether that's a bug or intentional."

**Codex response summary:** Confirmed against the rubric — Premium and Private both qualify for `instant` and `bonded`; no further v1 differentiation. Added a single line above the Private table: *"Private currently surfaces the same product set as Premium. Tier-specific differentiation is documented as a v2 product question in the design note."* Standard remains 3 products (`instant` only — DOT 8%, KSM 4.25%, ADA 3%). Premium and Private each return 6 (`[ATOM, DOT, SOL, KSM, ETH, ADA]` in APY-desc order).

### 15. Documentation Quality — External Audience, Not Me

**User prompt:**
> "Rewrite `README.md` and `solution-design-note.md` against the rubric's explicit audience rule: 'a mid-level backend engineer at Aurora Bank — not an internal reader.' Three rules: (a) no Kraken-internal framing, (b) no victory-lap sentences, (c) every implicit decision (rounding mode, locale, `can_allocate` exclusion, lower-bound APY) is named with a one-line rationale. README must contain `docker-compose up`, `/earn-products`, `Dependencies`, `Known Limitations`, `apr_estimate.low`, `can_allocate`. Design note must contain the `400 INVALID_TIER` / `500 DATA_UNAVAILABLE` codes, the `2.9999999999999999` precision example, the `Read ./data/*.json` data-loading rule, and at least one ```mermaid block. Show me the drafts; I'll mark anything that sounds like inside-baseball."

**Codex response summary:**
- **`README.md`** — quickstart (`docker-compose up`), API examples for all three tiers + invalid tier, architecture map matching the real `src/lib/earn.ts`, `src/lib/earn-response.ts`, `src/app/earn-products/route.ts` layout, dependency table with one-line safety notes per dep, known limitations section.
- **`solution-design-note.md`** — Aurora-facing handoff covering the tier policy table, APY policy (with the `2.9999999999999999` example called out), error contract (`400 INVALID_TIER` / `500 DATA_UNAVAILABLE`), edge-case list (missing `apr_estimate`, unsupported lock types, asset-code normalization), three production next steps written as questions Aurora's engineering team should answer first (auth model, locale, live-data path). Includes a Mermaid PoC architecture diagram and a Mermaid production reference diagram.

**Decision accepted after one revision pass.** Three sentences from the first draft got cut as victory-lap copy ("comprehensive coverage", "robust handling", "production-ready"). Final docs read tighter.

### 16. Architecture Diagrams — Renderable, Not Decorative

**User prompt:**
> "The Mermaid blocks in `solution-design-note.md` render but they read like placeholders. Tighten them so a reader understands the request path without reading prose. Two diagrams: (1) the PoC — what `docker-compose up` actually does, with the Next.js service boundary visible, the `./data/*.json` read step explicit, and the tier filter / sort / response build as separate nodes. (2) The production reference — customer channels, sync request path, async refresh job, Kraken APIs, and ops/observability as four distinct lanes. Both must render natively on GitHub. Use class definitions so the colors aren't random."

**Codex response summary:** Rewrote both Mermaid diagrams.
- **PoC flow** — Browser/curl → Next.js boundary (Compose service, port 3000) → `route.ts` handler → `createEarnProductsResponse` → `loadEarnData` (with the `Read ./data/*.json` step labeled) → `buildEarnProducts` (tier filter → APY threshold → sort) → JSON response. Class definitions distinguish entrypoints, transform steps, and data sources.
- **Production reference** — Four lanes: customer channels (Aurora app, internal dashboards), synchronous read path (gateway → service → cache → Kraken Earn API), asynchronous refresh path (cron job → strategy/asset fetch → cache write), ops lane (metrics/logs/alerts). Auth boundary drawn explicitly between Aurora and the service.

**Outcome:** Diagrams now read as architecture handoff artifacts a reviewer can use.

### 17. Final Consistency Review — Repo Truth Over AI Summary

**User prompt:**
> "Before I submit, reconcile this transcript against the actual repo. Walk these claims and verify each file:line:
>
> - Core logic in `src/lib/earn.ts`; types in `src/lib/earn-types.ts`; route adapter in `src/lib/earn-response.ts`.
> - Route at `src/app/earn-products/route.ts` is a one-liner.
> - 21 tests across `src/lib/__tests__/earn.test.ts`, `src/app/earn-products/route.test.ts`, `src/lib/__tests__/submission-requirements.test.ts`.
> - Premium returns exactly `[ATOM, DOT, SOL, KSM, ETH, ADA]` in that order; Standard returns 3 (DOT, KSM, ADA).
> - Response keys are exactly the eight in the spec.
> - `docker-compose.yml` has no `networks:` block; mounts `./data:/app/data:ro`.
> - Submission-requirements test enforces 'Critical review', 'Final Trap Review', 'AI Limits' in the transcript and the rubric-critical phrases in the README/design note.
>
> If any claim is wrong, fix the claim. Don't tell me 'mostly matches' — tell me what mismatches and where."

**Codex response summary:** All seven claims verified against the actual source. Two prior transcript drafts had referenced an earlier `src/services/` layout that no longer exists; those references were corrected.

## Final Trap Review

| Review item | Final behavior | Verified at |
|---|---|---|
| Runtime network | No `fetch`/`axios`/`https`/`net`/`WebSocket` in any runtime source. | `submission-requirements.test.ts` enforces with a regex sweep |
| Docker | `docker-compose up` serves `http://localhost:3000`; no custom `networks:` block; read-only `./data:/app/data:ro` mount. | `docker-compose.yml` |
| Data loading | Reads every `*.json` in `./data`, classifies by shape (`result.items` array → strategies; otherwise → assets), deduplicates strategies by `id` with alphabetically-later filenames winning. | `src/lib/earn.ts` `loadEarnData` |
| API route | `GET /earn-products?tier={standard\|premium\|private}` returns the sorted array. | `src/app/earn-products/route.ts` |
| Invalid tier | Structured `400 INVALID_TIER`, body `{ error: { code, message } }`. | `route.test.ts` |
| Data failure | Structured `500 DATA_UNAVAILABLE` for missing directory, empty directory, malformed JSON, or unrecognized shape. | `route.test.ts` |
| APY policy | Threshold uses the integer-portion of `apr_estimate.low` (`Number(wholePercent) >= 3`) — no float coercion. | `src/lib/earn.ts` `isAtLeastApyThreshold` |
| Precision trap | `"2.9999999999999999"` rejected because its whole-number part is `"2"`. Covered by the `precision-edge` fixture. | `src/lib/__tests__/earn.test.ts` |
| Tier policy | Standard → `instant` only. Premium and Private → `instant` and `bonded`. | `src/lib/earn.ts` `buildEarnProducts` |
| Premium/Private match | Same product set in v1, by design. Made visible in the UI. | dashboard component |
| Unsupported locks | `flex`, `timed`, `hybrid`, and unknown types excluded for all tiers. | `supportedLocks` set in `earn.ts` |
| Asset display | `${altname ?? rawCode} {Flexible|Bonded} Earn`. Raw code fallback verified. | `falls back to the raw Kraken asset code…` test |
| `can_allocate` / `allocation_restriction_info` | Never read in `buildEarnProducts`; never appear in response. Documented in design note as upstream signals. | grep returns no matches in transform code |
| Response shape | Exactly the eight allowed keys: `apyDisplay, apyValue, asset, displayName, eligibleTiers, lockType, minimumAmount, strategyId`. | `route.test.ts` asserts `Object.keys(body[0]).sort()` |

## Verification Loop

Final acceptance depended on commands run locally and verified by hand, not on AI confidence:

```bash
npm run lint
npm test
npm run build
docker-compose up -d --build
curl "http://localhost:3000/earn-products?tier=standard"
curl "http://localhost:3000/earn-products?tier=premium"
curl "http://localhost:3000/earn-products?tier=private"
curl "http://localhost:3000/earn-products?tier=bad"
```

Observed:

```text
npm run lint:            passed
npm test:                passed, 21 tests
npm run build:           passed
docker-compose up:       passed, service healthy on :3000

GET /                                       200, dashboard UI renders
GET /earn-products?tier=standard            200, 3 products, lockType=instant only,
                                            apyValues [8, 4.25, 3] (DOT, KSM, ADA)
GET /earn-products?tier=premium             200, 6 products, [ATOM, DOT, SOL, KSM, ETH, ADA]
                                            3 bonded + 3 instant
GET /earn-products?tier=private             200, same 6 products as premium
GET /earn-products?tier=bad                 400, { error: { code: "INVALID_TIER", ... } }
```

Browser verification also confirmed: tier switching resets filters; search and `Clear filters` work; `View JSON` and `API response` links update to the active tier; Kraken logo renders at the partner-mark size; the Premium/Private equivalence message is visible.

## AI Limits

AI was used as an accelerator and a sparring partner — not as an autonomous agent. The pattern held throughout:

- **AI for inventory, me for interpretation.** Section 4 (data archaeology) deliberately asked for enumeration only, not recommendation. The filter rules were derived from reading the table, not from AI inference about what a "reasonable" filter would be.
- **AI for fact-checking, me for business decisions.** Section 5 (the `allocation_restriction_info` question) used Codex as a docs lookup. The decision to drop the field from the response shape was mine, made on the rationale that "inventing behavior the customer didn't ask for is the most expensive class of mistake."
- **AI for first-pass review, me for final review.** Sections 9 (trap audit) and 11 (test calibration) used the model to grade its own output against rubrics I wrote — not to generate the rubrics. The "write the one-line code change that defeats this test" forcing function in Section 11 specifically existed to prevent flattery.
- **AI for scaffolding, me for the threshold compare.** The integer-portion APY check in `isAtLeastApyThreshold` was specified by me explicitly because the grader's `"2.9999999999999999"` fixture is a known failure mode for float-based implementations.
- **Trust but verify with the verification I ran.** AI-reported test counts and curl outputs were re-run in the live shell before submission. The cost is two seconds; the cost of a hallucinated "all passed" claim in a take-home is catastrophic.

Ambiguous areas are documented in `solution-design-note.md` rather than silently invented:

- `apr_estimate.low` is used conservatively; production should confirm APR vs APY terminology with Kraken and Aurora's compliance team.
- `can_allocate` and `allocation_restriction_info` are surfaced as upstream availability signals to reconcile, not as Aurora-tier inputs in v1.
- `flex`, `timed`, and `hybrid` lock types are excluded until Aurora and Kraken confirm a customer-facing taxonomy.
- Premium and Private share the same v1 product set by design — flagged in the UI and the design note.

The throughline: AI was the fastest path to inventory, scaffolding, second opinions, and adversarial fixture generation. It was never the path to a business decision, a checklist, or a verification result. Those stayed with me.
