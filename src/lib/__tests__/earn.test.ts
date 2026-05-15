import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildEarnProducts,
  EarnDataError,
  loadEarnData,
  parseTier,
  type StrategyRecord,
} from "../earn";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("earn product transformation", () => {
  it("limits Standard customers to instant-access strategies", () => {
    const products = buildEarnProducts(
      [
        strategy({ id: "bonded-sol", asset: "SOL", lockType: "bonded", low: "8.0" }),
        strategy({ id: "instant-eth", asset: "XETH", lockType: "instant", low: "4.0" }),
      ],
      assets([["XETH", "ETH"], ["SOL", "SOL"]]),
      "standard",
    );

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      asset: "ETH",
      lockType: "instant",
      eligibleTiers: ["Standard", "Premium", "Private"],
    });
  });

  it("allows Premium and Private customers to see bonded strategies", () => {
    const source = [
      strategy({ id: "instant-eth", asset: "XETH", lockType: "instant", low: "4.0" }),
      strategy({ id: "bonded-sol", asset: "SOL", lockType: "bonded", low: "8.0" }),
    ];

    for (const tier of ["premium", "private"] as const) {
      const products = buildEarnProducts(source, assets([["XETH", "ETH"], ["SOL", "SOL"]]), tier);

      expect(products.map((product) => product.lockType)).toEqual(["bonded", "instant"]);
      expect(products[0].eligibleTiers).toEqual(["Premium", "Private"]);
    }
  });

  it("applies APY threshold, display formatting, and stable sorting", () => {
    const products = buildEarnProducts(
      [
        strategy({ id: "low-apy", asset: "AAA", lockType: "instant", low: "2.99" }),
        strategy({ id: "equal-range", asset: "CCC", lockType: "instant", low: "3.0", high: "3.0" }),
        strategy({
          id: "precision-edge",
          asset: "DDD",
          lockType: "instant",
          low: "2.9999999999999999",
          high: "3.0000000000000001",
        }),
        strategy({
          id: "high-bound-trap",
          asset: "EEE",
          lockType: "instant",
          low: "2.50",
          high: "12.00",
        }),
        strategy({ id: "tie-b", asset: "BBB", lockType: "instant", low: "5.0", high: "6.0" }),
        strategy({ id: "tie-a", asset: "AAA", lockType: "instant", low: "5.0", high: "5.5" }),
      ],
      assets([
        ["AAA", "AAA"],
        ["BBB", "BBB"],
        ["CCC", "CCC"],
        ["DDD", "DDD"],
        ["EEE", "EEE"],
      ]),
      "standard",
    );

    expect(products.map((product) => product.strategyId)).toEqual([
      "tie-a",
      "tie-b",
      "equal-range",
    ]);
    expect(products.map((product) => product.apyDisplay)).toEqual([
      "5.00%-5.50%",
      "5.00%-6.00%",
      "3.00%",
    ]);
  });

  it("excludes unsupported lock types and non-finite APR values", () => {
    const missingAprField = strategy({ id: "missing-apr-field", lockType: "instant", low: "4.0" });
    delete missingAprField.apr_estimate;

    const products = buildEarnProducts(
      [
        strategy({ id: "flex", lockType: "flex", low: "10.0" }),
        strategy({ id: "hybrid", lockType: "hybrid", low: "10.0" }),
        strategy({ id: "timed", lockType: "timed", low: "10.0" }),
        missingAprField,
        strategy({ id: "missing-apr", lockType: "instant", low: "" }),
        strategy({ id: "valid", lockType: "instant", low: "4.0" }),
      ],
      assets([["XETH", "ETH"]]),
      "standard",
    );

    expect(products.map((product) => product.strategyId)).toEqual(["valid"]);
  });

  it("falls back to the raw Kraken asset code when asset metadata is absent", () => {
    const products = buildEarnProducts(
      [strategy({ id: "unknown-asset", asset: "XNEW", lockType: "instant", low: "4.0" })],
      new Map(),
      "standard",
    );

    expect(products[0].asset).toBe("XNEW");
    expect(products[0].displayName).toBe("XNEW Flexible Earn");
  });
});

describe("tier parsing", () => {
  it("accepts supported tiers case-insensitively", () => {
    expect(parseTier("standard")).toBe("standard");
    expect(parseTier("Premium")).toBe("premium");
    expect(parseTier("PRIVATE")).toBe("private");
  });

  it("rejects missing or unsupported tiers", () => {
    expect(parseTier(null)).toBeNull();
    expect(parseTier("vip")).toBeNull();
  });
});

describe("data loading", () => {
  it("merges valid assets and strategies responses from the data directory", () => {
    const directory = makeTempDir();

    writeJson(directory, "assets.json", {
      error: [],
      result: {
        XETH: { altname: "ETH" },
      },
    });
    writeJson(directory, "strategies.json", {
      error: [],
      result: {
        items: [strategy({ id: "instant-eth", asset: "XETH", lockType: "instant", low: "4.0" })],
      },
    });

    const data = loadEarnData(directory);

    expect(data.assets.get("XETH")?.altname).toBe("ETH");
    expect(data.strategies.get("instant-eth")?.asset).toBe("XETH");
  });

  it("reads every JSON file and merges duplicate records in filename order", () => {
    const directory = makeTempDir();

    writeJson(directory, "assets.json", {
      error: [],
      result: {
        XLTC: { altname: "LTC" },
        XETH: { altname: "ETH" },
      },
    });
    writeJson(directory, "strategies-a.json", {
      error: [],
      result: {
        items: [strategy({ id: "same-id", asset: "XETH", lockType: "instant", low: "4.0" })],
      },
    });
    writeJson(directory, "strategies-b.json", {
      error: [],
      result: {
        items: [strategy({ id: "same-id", asset: "XLTC", lockType: "instant", low: "6.0" })],
      },
    });

    const data = loadEarnData(directory);
    const products = buildEarnProducts(
      Array.from(data.strategies.values()),
      data.assets,
      "standard",
    );

    expect(data.strategies.get("same-id")?.asset).toBe("XLTC");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      asset: "LTC",
      apyValue: 6,
    });
  });

  it("throws a structured data error for malformed or incomplete data", () => {
    const malformedDirectory = makeTempDir();
    fs.writeFileSync(path.join(malformedDirectory, "broken.json"), "{not json");

    expect(() => loadEarnData(malformedDirectory)).toThrow(EarnDataError);

    const unrecognizedDirectory = makeTempDir();
    writeJson(unrecognizedDirectory, "unknown.json", {
      result: {
        ok: true,
      },
    });

    expect(() => loadEarnData(unrecognizedDirectory)).toThrow(EarnDataError);

    const incompleteDirectory = makeTempDir();
    writeJson(incompleteDirectory, "assets.json", {
      error: [],
      result: { XETH: { altname: "ETH" } },
    });

    expect(() => loadEarnData(incompleteDirectory)).toThrow(EarnDataError);
  });

  it("handles provided fixture edge cases without exposing unsupported products", () => {
    const data = loadEarnData(path.join(process.cwd(), "data"));
    const premiumProducts = buildEarnProducts(
      Array.from(data.strategies.values()),
      data.assets,
      "premium",
    );

    expect(premiumProducts.map((product) => product.asset)).toEqual([
      "ATOM",
      "DOT",
      "SOL",
      "KSM",
      "ETH",
      "ADA",
    ]);
    expect(premiumProducts.some((product) => product.asset === "MINA")).toBe(false);
    expect(premiumProducts.some((product) => product.asset === "MATIC")).toBe(false);
    expect(premiumProducts.every((product) => product.apyValue >= 3)).toBe(true);
  });
});

function strategy({
  id,
  asset = "XETH",
  lockType,
  low,
  high = low,
}: {
  id: string;
  asset?: string;
  lockType: string;
  low: string;
  high?: string;
}): StrategyRecord {
  return {
    id,
    asset,
    lock_type: { type: lockType },
    apr_estimate: { low, high },
    user_min_allocation: "0.01",
  };
}

function assets(entries: Array<[string, string]>) {
  return new Map(entries.map(([code, altname]) => [code, { altname }]));
}

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "earn-data-"));
  tempDirs.push(directory);
  return directory;
}

function writeJson(directory: string, fileName: string, payload: unknown) {
  fs.writeFileSync(path.join(directory, fileName), JSON.stringify(payload));
}
