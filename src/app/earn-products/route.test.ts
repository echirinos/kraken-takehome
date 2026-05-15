import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createEarnProductsResponse } from "@/lib/earn-response";
import { GET } from "./route";

describe("GET /earn-products", () => {
  it("returns a structured 400 response for missing or invalid tier", async () => {
    const missingTierResponse = GET(new Request("http://localhost:3000/earn-products"));

    expect(missingTierResponse.status).toBe(400);
    await expect(missingTierResponse.json()).resolves.toEqual({
      error: {
        code: "INVALID_TIER",
        message: "tier must be one of: standard, premium, private.",
      },
    });

    const invalidTierResponse = GET(
      new Request("http://localhost:3000/earn-products?tier=gold"),
    );

    expect(invalidTierResponse.status).toBe(400);
    await expect(invalidTierResponse.json()).resolves.toEqual({
      error: {
        code: "INVALID_TIER",
        message: "tier must be one of: standard, premium, private.",
      },
    });
  });

  it("returns the required product shape for Standard using local data", async () => {
    const response = GET(
      new Request("http://localhost:3000/earn-products?tier=standard"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
    expect(
      body.every((product: { lockType: string }) => product.lockType === "instant"),
    ).toBe(true);
    expect(body.map((product: { apyValue: number }) => product.apyValue)).toEqual([
      8,
      4.25,
      3,
    ]);
    expect(Object.keys(body[0]).sort()).toEqual([
      "apyDisplay",
      "apyValue",
      "asset",
      "displayName",
      "eligibleTiers",
      "lockType",
      "minimumAmount",
      "strategyId",
    ]);
    expect(body[0]).toMatchObject({
      asset: "DOT",
      displayName: "DOT Flexible Earn",
      eligibleTiers: ["Standard", "Premium", "Private"],
      lockType: "instant",
    });
  });

  it("returns bonded strategies for Premium while preserving sort order", async () => {
    const response = GET(
      new Request("http://localhost:3000/earn-products?tier=premium"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(6);
    expect(body.map((product: { asset: string }) => product.asset)).toEqual([
      "ATOM",
      "DOT",
      "SOL",
      "KSM",
      "ETH",
      "ADA",
    ]);
    expect(
      body.filter((product: { lockType: string }) => product.lockType === "bonded"),
    ).toHaveLength(3);
    expect(body[0]).toMatchObject({
      asset: "ATOM",
      eligibleTiers: ["Premium", "Private"],
      lockType: "bonded",
    });
  });

  it("returns a structured 500 response when earn data is unavailable", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "earn-empty-"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = createEarnProductsResponse(
        new Request("http://localhost:3000/earn-products?tier=standard"),
        { dataDirectory: directory },
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "DATA_UNAVAILABLE",
          message: "Earn product data is currently unavailable.",
        },
      });
      expect(consoleError).toHaveBeenCalledWith("No JSON files found in data directory.");
    } finally {
      consoleError.mockRestore();
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns a structured 500 response for a missing data directory", async () => {
    const missingDirectory = path.join(os.tmpdir(), `earn-missing-${Date.now()}`);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = createEarnProductsResponse(
        new Request("http://localhost:3000/earn-products?tier=standard"),
        { dataDirectory: missingDirectory },
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "DATA_UNAVAILABLE",
          message: "Earn product data is currently unavailable.",
        },
      });
      expect(consoleError.mock.calls[0]?.[0]).toContain("Unable to read data directory");
    } finally {
      consoleError.mockRestore();
    }
  });
});
