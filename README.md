# ProofStack MCP Server

[![AI-visibility check](https://proof-stack-lake.vercel.app/ai-check/badge.svg?url=proof-stack-lake.vercel.app)](https://proof-stack-lake.vercel.app/ai-check?url=proof-stack-lake.vercel.app)

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for [ProofStack](https://proof-stack-lake.vercel.app) — a library of researched indie product cases with published pricing, revenue disclosures where available, and source links. Research depth, freshness, and translation coverage vary by case; this is not a financial audit.

**Endpoint** (Streamable HTTP, no auth required):

```
https://proof-stack-lake.vercel.app/mcp
```

## Tools

| Tool | What it does |
|---|---|
| `search_cases` | Search the published product library by keyword, category, business model, or acquisition channel |
| `get_case` | Full case detail: pricing tiers, revenue disclosures, acquisition operations, what to copy / what not to copy, and available source URLs |
| `pricing_benchmarks` | Median first paid tier, free-tier prevalence, and paywall-capability distribution, computed from published pricing pages |

## Example client configuration

```json
{
  "mcpServers": {
    "proofstack": {
      "url": "https://proof-stack-lake.vercel.app/mcp"
    }
  }
}
```

Works with any MCP client that supports remote Streamable HTTP servers (Claude Desktop / Claude Code, Cursor, etc.).

## Source code

The server implementation is open (Apache-2.0) in [`src/`](src/): [`mcp.ts`](src/mcp.ts) is the exact JSON-RPC/tool logic running at the endpoint above, and [`pricingBenchmark.ts`](src/pricingBenchmark.ts) is the benchmark computation. The data source contract is documented in [`database-contract.ts`](src/database-contract.ts); the underlying dataset is open too (CC BY 4.0) at [proofstack-dataset](https://github.com/lttxzmj/proofstack-dataset).

## Data honesty rules

- Revenue that is not publicly disclosed is returned as `unknown` — never estimated.
- Acquisition narratives are researched from first-party sources; cases that have not been researched yet say so explicitly instead of returning template text.
- Cases include available source URLs with evidence grades (A/B/C). Check each case’s research status and sources before relying on its claims.

**Open dataset**: the full case library and benchmarks are downloadable at [proofstack-dataset](https://github.com/lttxzmj/proofstack-dataset) (CC BY 4.0).

More machine-readable context: [llms.txt](https://proof-stack-lake.vercel.app/llms.txt) · [Pricing benchmarks](https://proof-stack-lake.vercel.app/benchmarks) · [Case library](https://proof-stack-lake.vercel.app/cases)


## Free tool: AI-visibility check

Can GPTBot and ClaudeBot actually read *your* site? Run the free check (robots rules, llms.txt, sitemap, server rendering, JSON-LD) and get a shareable scorecard + README badge: https://proof-stack-lake.vercel.app/ai-check

## Local / evaluation adapter

Requires Node.js 22 or later. Run `node stdio.mjs` to expose the same public tools over newline-delimited JSON-RPC stdio. This adapter forwards tool requests to the public endpoint above; it does not require a database credential, read local files, or host a separate dataset. Only JSON-RPC responses go to stdout. An endpoint outage returns a protocol error instead of invented data. The adapter supports this endpoint's JSON responses; it is not a general-purpose SSE proxy.

For Glama: build steps `[]`, CMD arguments `["node", "stdio.mjs"]`, Node.js 24, no environment variables. Publishing an evaluation release does not require paid hosting.
