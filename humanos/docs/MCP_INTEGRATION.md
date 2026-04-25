# MCP Integration Reference

The Human OS interface is grounded in the cardiometabolic-research MCP server. This document specifies the available tools, their parameters, and how the Human OS components consume them.

## Server overview

The cardiometabolic-research MCP server exposes a curated database of approximately 2,365 proteins associated with 13 cardiometabolic diseases: diabetes mellitus, obesity, metabolic syndrome, non-alcoholic fatty liver disease, coronary artery disease, myocardial infarction, heart failure, hypertension, dyslipidemia, atherosclerosis, atrial fibrillation, stroke, and familial hypercholesterolemia.

Roughly 2,308 proteins have AlphaFold v6 structural predictions loaded. AlphaMissense pathogenic variants are loaded for the pathogenic class only (benign and ambiguous variants are not in scope). Semantic embeddings are available for all proteins, enabling cosine-similarity searches.

Queries outside the 13-disease scope return empty results. This is intentional. The Human OS interface should make scope visible to the user rather than pretending to be a general-purpose tool.

## Tools

### search_proteins_by_disease

Returns proteins associated with a disease, ranked by OpenTargets association score.

**Parameters**:
- `disease_query` (string, required): EFO ID like `EFO_0000400` or free-text disease name like "atherosclerosis"
- `min_score` (number, default 0.3): Association score floor
- `limit` (integer, default 20): Maximum proteins to return
- `require_structure` (boolean, default false): If true, only return proteins with AlphaFold structures

**Returns**: List of objects with `uniprot_accession`, `gene_name`, `protein_name`, `function_summary`, `association_score`, `mean_plddt`.

**Used by Human OS for**: Populating the protein chip list when an organ is clicked. The organ-to-disease mapping is in `src/data/fma-disease-mapping.json`.

### get_protein_details

Returns the full record for one protein.

**Parameters**:
- `accession` (string, optional): UniProt accession like `Q8NBP7`
- `gene_name` (string, optional): Gene symbol like `PCSK9`
- Exactly one of the two must be supplied.

**Returns**: Object with sequence, domains, GO terms, top diseases, structure metadata, function annotation. Full schema in the server's tool definition.

**Used by Human OS for**: Populating all eight context cards when a protein is selected. The Molecular Structure card uses the structure block. The Protein Binding card uses top diseases and function. The Patient Population Variance card cross-references with `get_pathogenic_variants`.

### get_pathogenic_variants

Returns AlphaMissense pathogenic missense variants for a protein, ranked by pathogenicity score.

**Parameters**:
- `accession` (string, required): UniProt accession
- `min_score` (number, default 0.564): AlphaMissense pathogenic threshold
- `limit` (integer, default 50): Maximum variants to return

**Returns**: List of variant objects with `position`, `reference_aa`, `alternate_aa`, `variant`, `pathogenicity_score`, `class`.

**Used by Human OS for**: The Patient Population Variance card summary count, and the Phase 4 deep-dive variant heatmap.

### search_similar_proteins_semantic

Ranks proteins by cosine similarity between their embedding and a query text.

**Parameters**:
- `query_text` (string, required): Free-text functional description
- `limit` (integer, default 10): Maximum proteins to return

**Returns**: List of objects with `uniprot_accession`, `gene_name`, `protein_name`, `distance`, `similarity`.

**Used by Human OS for**: The Protein Binding card's "semantic neighbors" section, which shows proteins functionally similar to the selected one.

## Caching strategy

Most queries are deterministic and stable. Aggressive caching is appropriate.

- `search_proteins_by_disease`: Cache by `(disease_query, min_score, limit)` for the session. The protein list for "atherosclerosis at min 0.3" does not change during a user session.
- `get_protein_details`: Cache by accession or gene_name forever. Protein details are stable.
- `get_pathogenic_variants`: Cache by accession forever. Variant lists are stable.
- `search_similar_proteins_semantic`: Cache by `query_text` for the session. Embeddings are deterministic.

Suggested implementation: Simple in-memory Map keyed by JSON-stringified parameters, with no expiration during the session. Reset on page reload.

## Error handling

The MCP server can be unavailable for several reasons: network issues, server maintenance, or scope violations (querying outside the 13 diseases).

For network and maintenance issues, fall back to last-known cached data with a visible "live data unavailable" indicator in the UI chrome. The interface should remain navigable.

For scope violations, the server returns an empty result with a `scope_note` field explaining what is in scope. The Human OS interface should detect empty results and surface the scope_note to the user as a helpful message rather than appearing broken.

## Latency expectations

- `search_proteins_by_disease` with limit 20: typically under 500ms
- `get_protein_details`: typically under 300ms
- `get_pathogenic_variants` with limit 50: typically under 400ms
- `search_similar_proteins_semantic`: typically under 800ms (involves embedding computation)

If latency exceeds 2 seconds for any single call, treat as degraded service and show a loading indicator.

## Tool selection guidance for Claude reasoning layer

When the Claude API integration in Phase 3 receives a natural language query, the system prompt should guide it toward the right tool:

- "Tell me about [protein]" → `get_protein_details`
- "What proteins are involved in [disease]?" → `search_proteins_by_disease`
- "What variants does [protein] have?" → `get_pathogenic_variants`
- "What's similar to [protein]?" or "Functions like [description]" → `search_similar_proteins_semantic`
- "What's in the [organ]?" → translate organ to disease list, then `search_proteins_by_disease` for each

Multi-step queries are common. "What proteins are shared between diabetes and atherosclerosis?" requires two `search_proteins_by_disease` calls and an intersection. Claude should be able to chain calls.

## Connection details

The MCP server is configured in your Claude Desktop or Claude Code installation. The exact connection string is in `.claude.json` or the equivalent config file. For the Human OS web app, the integration happens server-side (in a Next.js API route) using the Anthropic SDK with the MCP server attached as a remote tool.

The server runs locally on the developer machine for development. For internal PhrmAI deployment, the server should be packaged into a container or deployed to an internal service so the Human OS web app can reach it.
