import { EarnProductsDashboard } from "@/components/earn-products-dashboard";
import {
  buildEarnProducts,
  DATA_UNAVAILABLE_ERROR,
  EarnDataError,
  loadEarnData,
} from "@/lib/earn";
import type { EarnProduct, Tier } from "@/lib/earn-types";

export const dynamic = "force-dynamic";

type ProductsByTier = Record<Tier, EarnProduct[]>;

export default function Home() {
  let productsByTier: ProductsByTier | null = null;
  let loadError = null;

  try {
    const data = loadEarnData();
    const strategies = Array.from(data.strategies.values());

    productsByTier = {
      standard: buildEarnProducts(strategies, data.assets, "standard"),
      premium: buildEarnProducts(strategies, data.assets, "premium"),
      private: buildEarnProducts(strategies, data.assets, "private"),
    };
  } catch (error) {
    if (error instanceof EarnDataError) {
      console.error(error.message);
    } else {
      console.error("Unexpected earn product dashboard error", error);
    }

    loadError = DATA_UNAVAILABLE_ERROR;
  }

  return <EarnProductsDashboard productsByTier={productsByTier} error={loadError} />;
}
