import { NextResponse } from "next/server";
import {
  DATA_UNAVAILABLE_ERROR,
  EarnDataError,
  getEarnProducts,
  INVALID_TIER_ERROR,
  parseTier,
} from "./earn";

type EarnProductsResponseOptions = {
  dataDirectory?: string;
};

export function createEarnProductsResponse(
  request: Request,
  options: EarnProductsResponseOptions = {},
) {
  const tier = parseTier(new URL(request.url).searchParams.get("tier"));

  if (!tier) {
    return NextResponse.json(INVALID_TIER_ERROR, { status: 400 });
  }

  try {
    return NextResponse.json(getEarnProducts(tier, options.dataDirectory));
  } catch (error) {
    if (error instanceof EarnDataError) {
      console.error(error.message);
    } else {
      console.error("Unexpected earn products error", error);
    }

    return NextResponse.json(DATA_UNAVAILABLE_ERROR, { status: 500 });
  }
}
