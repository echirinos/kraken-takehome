import { createEarnProductsResponse } from "@/lib/earn-response";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return createEarnProductsResponse(request);
}
