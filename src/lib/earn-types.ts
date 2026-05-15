export const TIERS = ["standard", "premium", "private"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, "Standard" | "Premium" | "Private"> = {
  standard: "Standard",
  premium: "Premium",
  private: "Private",
};

export type EligibleTier = (typeof TIER_LABELS)[Tier];

export type EarnProduct = {
  strategyId: string;
  asset: string;
  displayName: string;
  lockType: "instant" | "bonded";
  apyDisplay: string;
  apyValue: number;
  eligibleTiers: EligibleTier[];
  minimumAmount: string;
};

export type StructuredError = {
  error: {
    code: "INVALID_TIER" | "DATA_UNAVAILABLE";
    message: string;
  };
};
