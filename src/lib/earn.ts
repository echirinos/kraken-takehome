import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  TIERS,
  type EarnProduct,
  type EligibleTier,
  type StructuredError,
  type Tier,
} from "./earn-types";

export type { EarnProduct, StructuredError, Tier } from "./earn-types";

export const INVALID_TIER_ERROR: StructuredError = {
  error: {
    code: "INVALID_TIER",
    message: "tier must be one of: standard, premium, private.",
  },
};

export const DATA_UNAVAILABLE_ERROR: StructuredError = {
  error: {
    code: "DATA_UNAVAILABLE",
    message: "Earn product data is currently unavailable.",
  },
};

export class EarnDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EarnDataError";
  }
}

const assetSchema = z
  .object({
    altname: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const assetsResponseSchema = z.object({
  error: z.array(z.string()).optional(),
  result: z.record(z.string(), assetSchema),
});

const strategySchema = z
  .object({
    id: z.string(),
    asset: z.string(),
    lock_type: z
      .object({
        type: z.string(),
      })
      .passthrough(),
    apr_estimate: z
      .object({
        low: z.string().nullable().optional(),
        high: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    user_min_allocation: z.string(),
  })
  .passthrough();

const strategiesResponseSchema = z.object({
  error: z.array(z.string()).optional(),
  result: z
    .object({
      items: z.array(strategySchema),
    })
    .passthrough(),
});

type AssetRecord = z.infer<typeof assetSchema>;
export type StrategyRecord = z.infer<typeof strategySchema>;

type EarnData = {
  assets: Map<string, AssetRecord>;
  strategies: Map<string, StrategyRecord>;
};

type SupportedLockType = EarnProduct["lockType"];

const supportedLocks = new Set<SupportedLockType>(["instant", "bonded"]);
const APY_THRESHOLD = 3;
const decimalApyPattern = /^\+?\d+(?:\.\d+)?$/;
const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseTier(value: string | null): Tier | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return TIERS.includes(normalized as Tier) ? (normalized as Tier) : null;
}

export function getEarnProducts(
  tier: Tier,
  dataDirectory?: string,
): EarnProduct[] {
  const data = loadEarnData(dataDirectory);
  return buildEarnProducts(Array.from(data.strategies.values()), data.assets, tier);
}

export function buildEarnProducts(
  strategies: StrategyRecord[],
  assets: Map<string, AssetRecord>,
  tier: Tier,
): EarnProduct[] {
  return strategies
    .flatMap((strategy) => {
      const lockType = strategy.lock_type.type;

      if (!isSupportedLock(lockType)) {
        return [];
      }

      const lowApy = parseApy(strategy.apr_estimate?.low);
      const highApy = parseApy(strategy.apr_estimate?.high);

      if (
        !Number.isFinite(lowApy) ||
        !isAtLeastApyThreshold(strategy.apr_estimate?.low)
      ) {
        return [];
      }

      if (lockType === "bonded" && tier === "standard") {
        return [];
      }

      const asset = assets.get(strategy.asset);
      const assetSymbol = asset?.altname ?? strategy.asset;
      const eligibleTiers = getEligibleTiers(lockType);

      return [
        {
          strategyId: strategy.id,
          asset: assetSymbol,
          displayName: `${assetSymbol} ${lockType === "instant" ? "Flexible" : "Bonded"} Earn`,
          lockType,
          apyDisplay: formatApyRange(lowApy, highApy),
          apyValue: lowApy,
          eligibleTiers,
          minimumAmount: strategy.user_min_allocation,
        } satisfies EarnProduct,
      ];
    })
    .sort((a, b) => {
      if (b.apyValue !== a.apyValue) {
        return b.apyValue - a.apyValue;
      }

      const assetComparison = a.asset.localeCompare(b.asset);
      return assetComparison === 0
        ? a.strategyId.localeCompare(b.strategyId)
        : assetComparison;
    });
}

export function loadEarnData(
  dataDirectory = path.join(process.cwd(), "data"),
): EarnData {
  let fileNames: string[];

  try {
    fileNames = fs
      .readdirSync(dataDirectory)
      .filter((fileName) => fileName.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    throw new EarnDataError(`Unable to read data directory: ${String(error)}`);
  }

  if (fileNames.length === 0) {
    throw new EarnDataError("No JSON files found in data directory.");
  }

  const assets = new Map<string, AssetRecord>();
  const strategies = new Map<string, StrategyRecord>();
  let sawAssetsResponse = false;
  let sawStrategiesResponse = false;

  for (const fileName of fileNames) {
    const filePath = path.join(dataDirectory, fileName);
    const payload = readJsonFile(filePath);

    if (isStrategiesShape(payload)) {
      const parsed = strategiesResponseSchema.safeParse(payload);

      if (!parsed.success) {
        throw new EarnDataError(`Malformed strategies response: ${fileName}`);
      }

      sawStrategiesResponse = true;

      for (const strategy of parsed.data.result.items) {
        strategies.set(strategy.id, strategy);
      }

      continue;
    }

    if (isAssetsShape(payload)) {
      const parsed = assetsResponseSchema.safeParse(payload);

      if (!parsed.success) {
        throw new EarnDataError(`Malformed assets response: ${fileName}`);
      }

      sawAssetsResponse = true;

      for (const [assetCode, asset] of Object.entries(parsed.data.result)) {
        assets.set(assetCode, asset);
      }

      continue;
    }

    throw new EarnDataError(`Unrecognized data response shape: ${fileName}`);
  }

  if (!sawAssetsResponse || !sawStrategiesResponse) {
    throw new EarnDataError("Missing required assets or strategies response.");
  }

  return { assets, strategies };
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new EarnDataError(`Unable to parse JSON file ${filePath}: ${String(error)}`);
  }
}

function isStrategiesShape(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.result)) {
    return false;
  }

  return Array.isArray(payload.result.items);
}

function isAssetsShape(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.result)) {
    return false;
  }

  return !Array.isArray(payload.result.items);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseApy(value: string | null | undefined): number {
  const normalized = value?.trim();

  if (!normalized || !decimalApyPattern.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

function isAtLeastApyThreshold(value: string | null | undefined): boolean {
  const normalized = value?.trim();

  if (!normalized || !decimalApyPattern.test(normalized)) {
    return false;
  }

  const [wholePercent] = normalized.replace(/^\+/, "").split(".");

  return Number(wholePercent) >= APY_THRESHOLD;
}

function isSupportedLock(lockType: string): lockType is SupportedLockType {
  return supportedLocks.has(lockType as SupportedLockType);
}

function formatApyRange(lowApy: number, highApy: number): string {
  const normalizedHigh = Number.isFinite(highApy) ? highApy : lowApy;

  if (lowApy === normalizedHigh) {
    return `${numberFormatter.format(lowApy)}%`;
  }

  return `${numberFormatter.format(lowApy)}%-${numberFormatter.format(normalizedHigh)}%`;
}

function getEligibleTiers(lockType: string): EligibleTier[] {
  return lockType === "instant"
    ? ["Standard", "Premium", "Private"]
    : ["Premium", "Private"];
}
