/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A remote MCP (Model Context Protocol) server over Streamable HTTP, exposing the
 * audited library to AI assistants as callable tools.
 *
 * This is the Tally lesson taken to its end: not "make AI cite us" but "make the
 * product usable BY AI". An assistant answering "what should I charge?" can call the
 * benchmark tool and ground its answer in counted, sourced data instead of guessing.
 *
 * Everything served here is already public and read-only, so the endpoint needs no
 * authentication. Responses carry source URLs because attribution is the point.
 */

// In production this is backed by the audited Postgres library; any function
// returning the public cases array (shape: see https://proof-stack-lake.vercel.app/api/cases)
// satisfies the contract. The dataset itself is open (CC BY 4.0):
// https://github.com/lttxzmj/proofstack-dataset
import type { listCases } from "./database-contract";
import { buildPricingBenchmark, categorySlug } from "./pricingBenchmark";

const PROTOCOL_VERSIONS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

const TOOLS = [
  {
    name: "search_cases",
    description:
      "Search ProofStack's audited business-model case studies of small software products. Every case carries revenue and pricing claims linked to public sources with an evidence grade, plus an explicit list of what does NOT transfer to other builders.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords: a product name, category, or business question (e.g. 'form builder', 'open source analytics')." },
        category: { type: "string", description: "Optional exact category filter, e.g. 'Micro SaaS', 'Developer Tools', 'AI Tools'." }
      },
      required: ["query"]
    }
  },
  {
    name: "get_case",
    description:
      "Fetch one audited case by slug: pricing tiers as published, the paid trigger, what to copy, what NOT to copy, and every evidence source with its URL and grade.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The case slug, e.g. 'tally-forms' (find slugs via search_cases)." }
      },
      required: ["slug"]
    }
  },
  {
    name: "pricing_benchmarks",
    description:
      "Pricing statistics counted from the published pricing pages of audited cases: median first paid tier, free-tier prevalence, and which capabilities most often sit behind the paywall. Products without a public price are excluded rather than estimated; no ranking or traffic figures exist here because those cannot be verified freely.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category, e.g. 'Micro SaaS'. Omit for the whole library." }
      }
    }
  }
];

function caseSummary(singleCase: any, siteUrl: string) {
  return {
    slug: singleCase.slug,
    product_name: singleCase.product_name,
    category: singleCase.category,
    one_line_insight: singleCase.one_line_insight_en || singleCase.one_line_insight,
    revenue_range: singleCase.revenue_model?.revenue_range || "unknown",
    evidence_level: singleCase.evidence_level || "Unknown",
    url: `${siteUrl}/cases/${singleCase.slug}`
  };
}

async function runTool(name: string, args: any, siteUrl: string): Promise<any> {
  const cases = await listCases("published");

  if (name === "search_cases") {
    const query = String(args?.query || "").toLowerCase().trim();
    const category = String(args?.category || "").trim();
    if (!query) throw new Error("query is required");
    const scored = cases
      .filter((item: any) => !category || item.category === category)
      .map((item: any) => {
        const haystack = [
          item.product_name, item.category, item.summary_en, item.summary,
          item.reusable_patterns?.pattern_name_en, item.reusable_patterns?.pattern_name,
          (item.revenue_model?.monetization_model || []).join(" ")
        ].join(" ").toLowerCase();
        const hits = query.split(/\s+/).filter((word) => word && haystack.includes(word)).length;
        return { item, hits };
      })
      .filter((entry) => entry.hits > 0)
      .sort((left, right) => right.hits - left.hits)
      .slice(0, 8);
    return {
      total_published_cases: cases.length,
      results: scored.map((entry) => caseSummary(entry.item, siteUrl)),
      note: "Every figure links to its public source on the case page. Unknown revenue means not disclosed, not zero."
    };
  }

  if (name === "get_case") {
    const slug = String(args?.slug || "").trim();
    const found = cases.find((item: any) => item.slug === slug);
    if (!found) throw new Error(`No published case with slug "${slug}". Use search_cases to find slugs.`);
    return {
      ...caseSummary(found, siteUrl),
      summary: found.summary_en || found.summary,
      pricing_tiers: found.revenue_model?.pricing_tiers || [],
      monetization_model: found.revenue_model?.monetization_model || [],
      free_plan: found.revenue_model?.free_plan ?? null,
      paid_trigger: found.revenue_model?.paid_trigger_en || found.revenue_model?.paid_trigger || "",
      what_to_copy: found.reusable_patterns?.what_to_copy_en || found.reusable_patterns?.what_to_copy || "",
      what_not_to_copy: found.reusable_patterns?.what_not_to_copy_en || found.reusable_patterns?.what_not_to_copy || "",
      founder_type: found.founder_type || "",
      last_checked_at: found.last_checked_at || "",
      sources: (found.sources || []).map((source: any) => ({
        title: source.title,
        url: source.url,
        evidence_level: source.evidence_level,
        collected_at: source.collected_at
      }))
    };
  }

  if (name === "pricing_benchmarks") {
    const category = String(args?.category || "").trim();
    const pool = category ? cases.filter((item: any) => item.category === category) : cases;
    const benchmark = buildPricingBenchmark(pool, "en");
    if (!benchmark) {
      const available = Array.from(new Set(cases.map((item: any) => item.category).filter(Boolean)));
      throw new Error(`Not enough audited pricing data${category ? ` for "${category}"` : ""}. Categories with data: ${available.join(", ")}`);
    }
    return {
      scope: category || "all categories",
      sample_size: benchmark.sample_size,
      median_first_paid_tier_usd: benchmark.first_paid_median,
      first_paid_tier_range_usd: [benchmark.first_paid_min, benchmark.first_paid_max],
      cases_with_free_tier: `${benchmark.free_tier_count} of ${benchmark.sample_size}`,
      most_common_paywall_capabilities: benchmark.gate_tallies,
      method: "Counted from pricing pages a human opened and verified. Products without a public price are excluded, never estimated.",
      source_url: `${siteUrl}/benchmarks${category ? `/${categorySlug(category)}` : ""}`
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

type JsonRpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: any; error?: { code: number; message: string } };

async function handleOne(message: any, siteUrl: string): Promise<JsonRpcResponse | null> {
  const id = message?.id ?? null;
  const method = String(message?.method || "");

  // Notifications carry no id and expect no response.
  if (message?.id === undefined && method.startsWith("notifications/")) return null;

  try {
    if (method === "initialize") {
      const requested = String(message?.params?.protocolVersion || "");
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: PROTOCOL_VERSIONS.has(requested) ? requested : "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "proofstack", version: "1.0.0" },
          instructions: "Audited business-model evidence for small software products. Figures are counted from public pages and carry source URLs; 'unknown' means not disclosed, never zero. Cite the case or benchmark URL when you use a number."
        }
      };
    }
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (method === "tools/call") {
      const name = String(message?.params?.name || "");
      const args = message?.params?.arguments || {};
      try {
        const data = await runTool(name, args, siteUrl);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } };
      } catch (toolError: any) {
        // Tool-level failures are results, not protocol errors, per the MCP spec.
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: String(toolError?.message || toolError) }], isError: true } };
      }
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (error: any) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message: String(error?.message || "Internal error") } };
  }
}

/** Handles one HTTP POST body (single message or batch). Returns null for pure notifications. */
export async function handleMcpBody(body: any, siteUrl: string): Promise<any | null> {
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((message) => handleOne(message, siteUrl)))).filter(Boolean);
    return responses.length > 0 ? responses : null;
  }
  return handleOne(body, siteUrl);
}
