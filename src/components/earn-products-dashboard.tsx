"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  TIER_LABELS,
  TIERS,
  type EarnProduct,
  type StructuredError,
  type Tier,
} from "@/lib/earn-types";

type ProductsByTier = Record<Tier, EarnProduct[]>;
type LockFilter = "all" | EarnProduct["lockType"];

type EarnProductsDashboardProps = {
  productsByTier: ProductsByTier | null;
  error: StructuredError | null;
};

const tierDescriptions: Record<Tier, string> = {
  standard: "Instant-access products only. Bonded products are excluded.",
  premium: "All qualifying instant and bonded products.",
  private: "Same v1 catalog as Premium: all qualifying instant and bonded products.",
};

const tierPolicySummary =
  "Standard is intentionally narrower. Premium and Private share the same v1 catalog because both tiers receive all qualifying strategies.";

const lockFilters: Array<{ label: string; value: LockFilter }> = [
  { label: "All", value: "all" },
  { label: "Instant", value: "instant" },
  { label: "Bonded", value: "bonded" },
];

const emptyProducts: EarnProduct[] = [];

export function EarnProductsDashboard({
  productsByTier,
  error,
}: EarnProductsDashboardProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>("standard");
  const [query, setQuery] = useState("");
  const [lockFilter, setLockFilter] = useState<LockFilter>("all");
  const products = productsByTier?.[selectedTier] ?? emptyProducts;
  const hasActiveFilters = query.trim().length > 0 || lockFilter !== "all";
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesLock =
        lockFilter === "all" ? true : product.lockType === lockFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.asset.toLowerCase().includes(normalizedQuery) ||
        product.displayName.toLowerCase().includes(normalizedQuery) ||
        product.strategyId.toLowerCase().includes(normalizedQuery);

      return matchesLock && matchesQuery;
    });
  }, [lockFilter, products, query]);
  const highestApy = products[0]?.apyDisplay ?? "N/A";
  const bondedCount = products.filter((product) => product.lockType === "bonded").length;
  const instantCount = products.length - bondedCount;

  function selectTier(tier: Tier) {
    setSelectedTier(tier);
    setQuery("");
    setLockFilter("all");
  }

  function clearFilters() {
    setQuery("");
    setLockFilter("all");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef2f6] text-[#101828]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="relative hidden border-r border-[#d5dde8] bg-[#f8fafc] px-4 py-4 lg:block">
          <div className="flex items-center gap-3 border-b border-[#dfe5ee] pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#17134a] text-sm font-semibold text-white">
              AB
            </div>
            <div>
              <p className="text-sm font-semibold text-[#101828]">Aurora Bank</p>
              <p className="text-xs text-[#667085]">Kraken Earn PoC</p>
            </div>
          </div>

          <nav className="mt-5 space-y-1 text-sm" aria-label="Dashboard sections">
            <SidebarLink href="#product-catalog" label="Product catalog" active />
            <SidebarLink href="#tier-policy" label="Tier policy" />
            <SidebarLink
              href={`/earn-products?tier=${selectedTier}`}
              label="API response"
              badge="JSON"
            />
          </nav>

          <div className="absolute bottom-4 hidden w-[216px] rounded-md border border-[#d5dde8] bg-white p-3 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
              Data mode
            </p>
            <p className="mt-1 text-sm font-medium text-[#101828]">Local fixtures</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#cfd7e3] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#17134a] text-sm font-semibold text-white shadow-sm">
                AB
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#526070]">
                  Aurora Bank / Kraken Earn PoC
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-[#101828] sm:text-3xl">
                  Eligible crypto earn products
                </h1>
              </div>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-[#526070]">
                Eligible crypto earn products
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[#101828]">
                Product catalog
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <PartnerMark />
              <a
                href={`/earn-products?tier=${selectedTier}`}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#b8c3d4] bg-white px-4 text-sm font-semibold text-[#243041] shadow-sm transition hover:border-[#8897ac] hover:bg-[#f9fafc] focus:outline-none focus:ring-2 focus:ring-[#17134a]/20"
              >
                View JSON
              </a>
            </div>
          </header>

          <section
            id="tier-policy"
            className="scroll-mt-4 grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <div className="overflow-hidden rounded-lg border border-[#cfd7e3] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#e1e6ee] px-5 py-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[#101828]">
                    Customer tier
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526070]">
                    Tier eligibility, APY threshold, and Kraken asset metadata
                    are applied before products reach Aurora channels.
                  </p>
                </div>

                <div
                  className="grid grid-cols-3 rounded-md border border-[#c1cad8] bg-[#edf1f6] p-1"
                  role="tablist"
                  aria-label="Customer tier"
                >
                  {TIERS.map((tier) => {
                    const isSelected = selectedTier === tier;

                    return (
                      <button
                        key={tier}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => selectTier(tier)}
                        className={`h-9 rounded-[5px] px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#17134a]/20 ${
                          isSelected
                            ? "bg-[#17134a] text-white shadow-sm"
                            : "text-[#526070] hover:bg-white"
                        }`}
                      >
                        {TIER_LABELS[tier]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid divide-y divide-[#e1e6ee] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Metric label="Products" value={String(products.length)} />
                <Metric label="Highest APY" value={highestApy} tone="positive" />
                <Metric label="Instant / bonded" value={`${instantCount} / ${bondedCount}`} />
              </div>

              <div className="border-t border-[#e1e6ee] bg-[#fbfcfe] px-5 py-3">
                <p className="text-sm leading-6 text-[#526070]">
                  <span className="font-semibold text-[#101828]">
                    Tier policy:
                  </span>{" "}
                  {tierPolicySummary}
                </p>
              </div>
            </div>

            <aside className="rounded-lg border border-[#17134a] bg-[#111827] p-5 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9ca7bd]">
                Selected tier
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {TIER_LABELS[selectedTier]}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#d5dceb]">
                {tierDescriptions[selectedTier]}
              </p>
              {selectedTier !== "standard" ? (
                <p className="mt-3 rounded-md bg-white/10 px-3 py-2 text-xs leading-5 text-[#d5dceb]">
                  Premium and Private are expected to match in this PoC. A
                  future policy layer could add Private-only products or limits.
                </p>
              ) : null}
              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-white/15">
                <PolicyCell label="APY floor" value="3.00%" />
                <PolicyCell label="APY basis" value="Low" />
              </div>
            </aside>
          </section>

          <section
            id="product-catalog"
            className="scroll-mt-4 flex-1 overflow-hidden rounded-lg border border-[#cfd7e3] bg-white shadow-sm"
          >
            <div className="flex flex-col gap-4 border-b border-[#e1e6ee] bg-[#fbfcfe] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#101828]">
                  {TIER_LABELS[selectedTier]} products
                </h2>
                <p className="mt-1 text-sm text-[#526070]">
                  {selectedTier === "standard"
                    ? "Standard shows instant-access products only."
                    : `${TIER_LABELS[selectedTier]} shows the full qualifying v1 product set.`}{" "}
                  Sorted by lower APY estimate, then asset and strategy ID.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search asset or strategy"
                  className="h-10 min-w-0 rounded-md border border-[#c1cad8] bg-white px-3 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#17134a] focus:ring-2 focus:ring-[#17134a]/15 sm:w-64"
                />
                <div className="grid grid-cols-3 rounded-md border border-[#c1cad8] bg-[#edf1f6] p-1">
                  {lockFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setLockFilter(filter.value)}
                      className={`h-8 rounded-[5px] px-3 text-xs font-semibold transition ${
                        lockFilter === filter.value
                          ? "bg-white text-[#101828] shadow-sm"
                          : "text-[#526070] hover:bg-white/70"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[#edf1f7] px-5 py-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-medium text-[#667085]">
                  {filteredProducts.length} of {products.length} records
                </span>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-[#17134a] transition hover:bg-[#eef2f6] focus:outline-none focus:ring-2 focus:ring-[#17134a]/20"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
              <span className="text-xs font-medium text-[#667085]">
                {lockFilter === "all" ? "All lock types" : `${lockFilter} only`}
              </span>
            </div>

            {error ? (
              <ErrorState error={error} />
            ) : products.length === 0 ? (
              <EmptyState tier={selectedTier} />
            ) : filteredProducts.length === 0 ? (
              <NoResultsState />
            ) : (
              <ProductsTable products={filteredProducts} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SidebarLink({
  href,
  label,
  active = false,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between rounded-md px-3 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-[#17134a]/20 ${
        active
          ? "bg-[#e6ebf2] text-[#101828]"
          : "text-[#526070] hover:bg-[#eef2f6] hover:text-[#101828]"
      }`}
    >
      <span>{label}</span>
      {badge ? (
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function PartnerMark() {
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd7e3] bg-white px-3 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
        Data by
      </span>
      <Image
        src="/kraken-logo.png"
        alt="Kraken"
        width={92}
        height={16}
        priority
        className="h-4 w-auto"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-semibold ${
          tone === "positive" ? "text-[#08745f]" : "text-[#101828]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PolicyCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aeb8ca]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ProductsTable({ products }: { products: EarnProduct[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#d7deea] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.1em] text-[#667085]">
            <th className="px-5 py-4">Asset</th>
            <th className="px-5 py-4">Product</th>
            <th className="px-5 py-4">APY</th>
            <th className="px-5 py-4">Lock</th>
            <th className="px-5 py-4">Minimum</th>
            <th className="px-5 py-4">Eligible tiers</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.strategyId}
              className="border-b border-[#edf1f7] transition hover:bg-[#fbfcfe] last:border-b-0"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#d7deea] bg-[#f4f7fb] text-sm font-semibold text-[#17134a]">
                    {product.asset.slice(0, 3)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#101828]">
                      {product.asset}
                    </p>
                    <p className="font-mono text-xs text-[#667085]">
                      {product.strategyId}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-sm font-medium text-[#26313f]">
                {product.displayName}
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex rounded-md bg-[#e8f5f1] px-2.5 py-1 font-mono text-sm font-semibold text-[#08745f]">
                  {product.apyDisplay}
                </span>
              </td>
              <td className="px-5 py-4">
                <LockBadge lockType={product.lockType} />
              </td>
              <td className="px-5 py-4 font-mono text-sm text-[#344054]">
                {product.minimumAmount}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {product.eligibleTiers.map((tier) => (
                    <span
                      key={tier}
                      className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]"
                    >
                      {tier}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LockBadge({ lockType }: { lockType: EarnProduct["lockType"] }) {
  const className =
    lockType === "instant"
      ? "border-[#b7d9d1] bg-[#f0faf7] text-[#08745f]"
      : "border-[#c9c7ef] bg-[#f2f1ff] text-[#352f8c]";

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {lockType}
    </span>
  );
}

function EmptyState({ tier }: { tier: Tier }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <h2 className="text-lg font-semibold text-[#101828]">
        No qualifying products
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#516070]">
        No products currently meet Aurora&apos;s APY, lock type, and{" "}
        {TIER_LABELS[tier]} tier eligibility policy.
      </p>
    </div>
  );
}

function NoResultsState() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <h2 className="text-lg font-semibold text-[#101828]">
        No matching products
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#526070]">
        Adjust the search or lock type filter to broaden the catalog view.
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: StructuredError }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#b42318]">
        {error.error.code}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-[#101828]">
        Unable to load products
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#516070]">
        {error.error.message}
      </p>
    </div>
  );
}
