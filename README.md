# ProofStack MCP Server

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for [ProofStack](https://proof-stack-lake.vercel.app) — a library of audited indie product business cases. Every figure is read from a published source (pricing pages, founder posts, transparency dashboards) and linked, so AI assistants can cite evidence instead of guessing.

**Endpoint** (Streamable HTTP, no auth required):

```
https://proof-stack-lake.vercel.app/mcp
```

## Tools

| Tool | What it does |
|---|---|
| `search_cases` | Search 43 audited products by keyword, category, business model, or acquisition channel |
| `get_case` | Full case detail: pricing tiers, revenue disclosures, acquisition operations, what to copy / what not to copy, and source URLs for every claim |
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

## Data honesty rules

- Revenue that is not publicly disclosed is returned as `unknown` — never estimated.
- Acquisition narratives are researched from first-party sources; cases that have not been researched yet say so explicitly instead of returning template text.
- Every case ships its evidence: source URLs with evidence grades (A/B/C).

**Open dataset**: the full case library and benchmarks are downloadable at [proofstack-dataset](https://github.com/lttxzmj/proofstack-dataset) (CC BY 4.0).

More machine-readable context: [llms.txt](https://proof-stack-lake.vercel.app/llms.txt) · [Pricing benchmarks](https://proof-stack-lake.vercel.app/benchmarks) · [Case library](https://proof-stack-lake.vercel.app/cases)
