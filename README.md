# Kraken Earn Products PoC

Aurora Bank wants to evaluate Kraken Earn products for a tiered crypto-yield offering. This repository contains a TypeScript proof of concept that reads Kraken-shaped local fixtures, applies Aurora's business policy, exposes the required API, and includes a small reviewer-facing demo UI.

The submission is designed for the grading environment: one Docker Compose command, no credentials, no outbound runtime network dependency, and deterministic local data handling.

## Quickstart

```bash
docker-compose up
```

Open [http://localhost:3000](http://localhost:3000).

The required API is available at:

```bash
curl "http://localhost:3000/earn-products?tier=standard"
curl "http://localhost:3000/earn-products?tier=premium"
curl "http://localhost:3000/earn-products?tier=private"
```

## API Contract

`GET /earn-products?tier={standard|premium|private}`

Success responses are JSON arrays sorted by `apyValue` descending, then asset symbol, then strategy ID.

```json
[
  {
    "strategyId": "ESRFUO3-Q62XD-WIOIL7",
    "asset": "DOT",
    "displayName": "DOT Flexible Earn",
    "lockType": "instant",
    "apyDisplay": "8.00%-12.00%",
    "apyValue": 8,
    "eligibleTiers": ["Standard", "Premium", "Private"],
    "minimumAmount": "0.01"
  }
]
```

Invalid or missing tier returns HTTP 400:

```json
{
  "error": {
    "code": "INVALID_TIER",
    "message": "tier must be one of: standard, premium, private."
  }
}
```

Unavailable or malformed local data returns HTTP 500:

```json
{
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "Earn product data is currently unavailable."
  }
}
```

The API never returns raw stack traces.

## Architecture

```text
data/*.json
  -> response-shape classification
  -> Zod validation
  -> deterministic merge
  -> Earn product transformation
  -> tier/APY/lock filtering
  -> API route and demo UI
```

Key files:

| Path | Purpose |
|---|---|
| `src/lib/earn.ts` | Data loading, schema validation, product transformation, APY formatting, tier filtering, sorting. |
| `src/lib/earn-response.ts` | Shared HTTP response wrapper for structured API errors. |
| `src/app/earn-products/route.ts` | Required `GET /earn-products` endpoint. |
| `src/app/page.tsx` | Server-side data load for the demo UI. |
| `src/components/earn-products-dashboard.tsx` | Aurora Bank demo UI using the same transformed product data as the API. |
| `data/` | Local Kraken-shaped mock responses mounted read-only by Docker Compose. |

The API and UI intentionally share the same core logic so the visible demo cannot drift from the machine-readable endpoint.

## Data Handling

The service reads every `.json` file in `./data` at runtime. It does not hard-code `assets.json` or `strategies.json`.

Files are classified by response shape:

- Earn Strategies response: `result.items` is an array.
- Asset Info response: `result` is an object keyed by asset code.

Valid records are merged in sorted filename order. Duplicate strategy IDs or asset codes are deterministic: later files win. This lets graders add fixture files without code changes and gives Aurora a predictable override model for future test data.

Runtime network access is not required. The application code does not call Kraken, `fetch`, `axios`, or any outbound HTTP client at runtime.

## Business Rules

APY policy:

- `apr_estimate.low` is used as the compliance-safe `apyValue` for filtering and sorting.
- Products with lower-bound APY below `3.00%` are excluded.
- Ranges display as `8.00%-12.00%`; equal low/high values display as `3.00%`.
- Decimal APY strings are checked before floating-point parsing, so `2.9999999999999999` does not pass the `3.00%` threshold through JavaScript rounding.

Tier policy:

| Aurora tier | Visible lock types |
|---|---|
| Standard | `instant` only |
| Premium | `instant`, `bonded` |
| Private | `instant`, `bonded` |

Product eligibility:

- `instant`: `["Standard", "Premium", "Private"]`
- `bonded`: `["Premium", "Private"]`

Unsupported or ambiguous mock lock types such as `flex`, `timed`, and `hybrid` are excluded for v1. The assessment explicitly maps Standard flexible/instant access to `lock_type.type === "instant"`, so this PoC avoids guessing product taxonomy beyond that.

Asset display:

- Kraken asset codes are normalized with Asset Info `altname` when available, for example `XETH -> ETH` and `XADA -> ADA`.
- Missing asset metadata falls back to the raw Kraken asset code.

`can_allocate` is not used as the Aurora tier filter. In Kraken's response it appears to represent account-level availability; this PoC calculates Aurora tier eligibility independently and documents that the two signals should be reconciled before production launch.

## Verification

Local checks:

```bash
npm run lint
npm test
npm run build
docker-compose up
```

The test suite includes:

- tier filtering for Standard, Premium, and Private
- APY threshold, display formatting, stable sorting, and precision edge cases
- unsupported lock types and missing APR handling
- all-JSON-file loading and deterministic merge behavior
- route-level 400 and 500 structured error contracts
- static submission guardrails for Docker Compose, required artifacts, local-only runtime access, and documentation-critical decisions

Latest local verification result:

- `npm run lint` passed
- `npm test` passed: 20 tests
- `npm run build` passed
- `docker-compose up -d --build` passed
- live API checks returned `200` for Standard, Premium, and Private
- invalid tier returned structured `400 INVALID_TIER`
- browser smoke checks confirmed tier switching, filtering, JSON links, and the product catalog UI

## Dependencies

| Dependency | Why it is used | Risk/control |
|---|---|---|
| Next.js | One TypeScript service for the App Router API and demo UI. | Runtime stays local-only; production should move back to stable Next.js once the same dependency fixes are available outside canary. |
| React | UI rendering for the reviewer-facing catalog. | No credentials or external API calls. |
| Tailwind CSS | Small, local styling surface without a component framework dependency. | Styles compile at build time; no runtime service dependency. |
| Zod | Runtime validation of Kraken-shaped fixture files before transformation. | Prevents malformed data from leaking raw exceptions into responses. |
| Vitest | Fast unit and route tests for business logic and submission guardrails. | Development-only dependency. |

The project currently pins `next@16.3.0-canary.20` because the local audit path showed a patched dependency there before the next stable line. For a production Aurora implementation, I would prefer the latest stable Next.js version once it carries the same fix.

## Known Limitations

- This is a local-fixture PoC, not an authenticated Kraken integration.
- APY labels use `en-US` formatting; production should use Aurora customer locale settings.
- The mock schema names `apr_estimate`, while the requested frontend field is `apyValue`; production should confirm final APR/APY terminology and calculation with Kraken and Aurora Compliance.
- The UI is a proof-of-concept review surface, not Aurora's production design system.
- A CLI smoke-test command could reuse `src/lib/earn.ts`, but it is intentionally out of scope for v1 because the assessment prioritizes the HTTP service, Docker run path, data handling, tests, and documentation.
