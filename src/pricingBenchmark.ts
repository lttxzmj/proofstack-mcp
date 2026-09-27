/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Turns a set of audited cases into a statistical answer instead of a reading list.
 * A builder deciding where to put a paywall needs the distribution, not five stories.
 */

export type BenchmarkTally = { label: string; count: number };

/** One canonical slug rule shared by the server routes and the SPA, so URLs never drift. */
export function categorySlug(category: string): string {
  return String(category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Categories with enough audited pricing data to publish as their own page. */
export function benchmarkCategorySlugs(cases: any[]): string[] {
  const categories = Array.from(new Set((cases || []).map((item: any) => item?.category).filter(Boolean)));
  return categories
    .filter((category) => buildPricingBenchmark((cases || []).filter((item: any) => item.category === category)))
    .map((category) => categorySlug(String(category)));
}

export type PricingBenchmark = {
  sample_size: number;
  paid_sample_size: number;
  free_tier_count: number;
  first_paid_median: number | null;
  first_paid_min: number | null;
  first_paid_max: number | null;
  gate_tallies: BenchmarkTally[];
};

/** Recurring paywall boundaries, matched on both languages because cases are bilingual. */
const GATE_PATTERNS: Array<{ id: string; zh: string; en: string; words: RegExp }> = [
  { id: "branding", zh: "去除品牌水印", en: "Remove branding", words: /水印|品牌标识|branding|watermark|made with|badge/i },
  { id: "custom_domain", zh: "自定义域名", en: "Custom domain", words: /自定义域名|custom domain|own domain/i },
  { id: "usage_limit", zh: "用量上限（条目/次数/存储）", en: "Usage limits (items, runs, storage)", words: /条目|数量限制|次数|额度|存储|storage|limit of|up to \d|quota|credits?/i },
  { id: "team", zh: "团队协作与权限", en: "Team seats and permissions", words: /团队|协作|成员|权限|team|seats?|collaborat|role/i },
  { id: "api", zh: "API 与集成", en: "API and integrations", words: /\bapi\b|集成|integration|webhook|zapier/i },
  { id: "analytics", zh: "高级分析与报表", en: "Advanced analytics", words: /分析|报表|report|analytics|insight|dashboard/i },
  { id: "automation", zh: "自动化与工作流", en: "Automation and workflows", words: /自动化|工作流|automation|workflow|trigger/i },
  { id: "export", zh: "导出与数据下载", en: "Export and downloads", words: /导出|下载|export|download|csv/i },
  { id: "support", zh: "优先支持", en: "Priority support", words: /优先支持|专属支持|priority support|dedicated support/i },
  { id: "sso", zh: "SSO 与合规", en: "SSO and compliance", words: /\bsso\b|合规|compliance|saml|audit log/i }
];

export function priceToNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^(free|\u514d\u8d39|0)$/i.test(raw)) return 0;
  const match = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 100) / 100;
}

/**
 * Computes the paywall distribution across the supplied cases. Returns null when the
 * sample is too small to say anything honest about it.
 */
export function buildPricingBenchmark(cases: any[], language: "zh" | "en" = "zh"): PricingBenchmark | null {
  const usable = (cases || []).filter((item) => item && (item.revenue_model?.pricing_tiers?.length || item.revenue_model?.paid_trigger));
  if (usable.length < 3) return null;

  const firstPaidPrices: number[] = [];
  let freeTierCount = 0;
  const gateHits = new Map<string, number>();

  for (const singleCase of usable) {
    const revenue = singleCase.revenue_model || {};
    const tiers = Array.isArray(revenue.pricing_tiers) ? revenue.pricing_tiers : [];
    const priced = tiers
      .map((tier: any) => ({ tier, amount: priceToNumber(tier?.price) }))
      .filter((entry: any) => entry.amount !== null) as Array<{ tier: any; amount: number }>;

    if (revenue.free_plan === true || priced.some((entry) => entry.amount === 0)) freeTierCount += 1;

    const paid = priced.filter((entry) => entry.amount > 0).sort((left, right) => left.amount - right.amount);
    if (paid.length > 0) firstPaidPrices.push(paid[0].amount);

    // What sits behind the paywall: the first paid tier's features plus the stated trigger.
    const gateText = [
      revenue.paid_trigger,
      revenue.paid_trigger_en,
      ...(paid[0]?.tier?.features || [])
    ].map((item: any) => String(item || "")).join(" ");

    const seen = new Set<string>();
    for (const pattern of GATE_PATTERNS) {
      if (pattern.words.test(gateText) && !seen.has(pattern.id)) {
        seen.add(pattern.id);
        gateHits.set(pattern.id, (gateHits.get(pattern.id) || 0) + 1);
      }
    }
  }

  const gate_tallies = GATE_PATTERNS
    .filter((pattern) => (gateHits.get(pattern.id) || 0) > 0)
    .map((pattern) => ({ label: language === "zh" ? pattern.zh : pattern.en, count: gateHits.get(pattern.id) as number }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  return {
    sample_size: usable.length,
    paid_sample_size: firstPaidPrices.length,
    free_tier_count: freeTierCount,
    first_paid_median: median(firstPaidPrices),
    first_paid_min: firstPaidPrices.length ? Math.min(...firstPaidPrices) : null,
    first_paid_max: firstPaidPrices.length ? Math.max(...firstPaidPrices) : null,
    gate_tallies
  };
}
