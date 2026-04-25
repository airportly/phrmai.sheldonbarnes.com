/**
 * MCP Client - Wrapper for the cardiometabolic-research MCP server.
 * 
 * This module is used in Phase 2 to replace the static JSON data with live
 * database queries. The interface is async so it can transparently swap in
 * the MCP integration when ready.
 * 
 * For Phase 1, the methods return data from the static fma-protein-mapping.json.
 * For Phase 2, they make actual HTTP calls to the MCP server.
 * 
 * The toggle between modes is controlled by the MCP_SERVER_URL environment
 * variable. When unset, the static fallback is used.
 */

import { proteinMapper, type Protein, type OrganKey } from './protein-mapper';

const MCP_URL = process.env.MCP_SERVER_URL ?? '';
const USE_LIVE_MCP = MCP_URL.length > 0;

// Simple in-memory cache for MCP responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(tool: string, params: any): string {
  return `${tool}:${JSON.stringify(params)}`;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Search proteins associated with a disease.
 */
export async function searchProteinsByDisease(
  diseaseQuery: string,
  options: { minScore?: number; limit?: number; requireStructure?: boolean } = {}
): Promise<Protein[]> {
  const params = {
    disease_query: diseaseQuery,
    min_score: options.minScore ?? 0.3,
    limit: options.limit ?? 20,
    require_structure: options.requireStructure ?? false,
  };
  
  const key = cacheKey('search_proteins_by_disease', params);
  const cached = getCached<Protein[]>(key);
  if (cached) return cached;
  
  if (!USE_LIVE_MCP) {
    // Phase 1 fallback: search through static data
    const proteins: Protein[] = [];
    for (const organKey of ['brain', 'heart', 'liver', 'pancreas', 'kidneys', 'adipose'] as OrganKey[]) {
      const data = proteinMapper.getOrganData(organKey);
      if (!data) continue;
      if (data.diseases.some(d => d.toLowerCase().includes(diseaseQuery.toLowerCase()))) {
        proteins.push(...data.proteins.filter(p => p.score >= params.min_score));
      }
    }
    const result = proteins.slice(0, params.limit);
    setCached(key, result);
    return result;
  }
  
  // Phase 2: live MCP call (server-side via API route)
  const response = await fetch('/api/mcp/search-proteins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`MCP error: ${response.statusText}`);
  const data = await response.json();
  const proteins: Protein[] = data.results.map((r: any) => ({
    gene: r.gene_name,
    uniprot: r.uniprot_accession,
    name: r.protein_name,
    function: r.function_summary,
    plddt: r.mean_plddt,
    score: r.association_score,
  }));
  setCached(key, proteins);
  return proteins;
}

/**
 * Get full protein details by UniProt accession or gene symbol.
 */
export async function getProteinDetails(
  identifier: { accession?: string; geneName?: string }
): Promise<Protein | null> {
  const params = {
    accession: identifier.accession,
    gene_name: identifier.geneName,
  };
  
  const key = cacheKey('get_protein_details', params);
  const cached = getCached<Protein | null>(key);
  if (cached !== null) return cached;
  
  if (!USE_LIVE_MCP) {
    if (identifier.geneName) {
      const found = proteinMapper.findProteinByQuery(identifier.geneName);
      setCached(key, found);
      return found;
    }
    return null;
  }
  
  const response = await fetch('/api/mcp/protein-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    setCached(key, null);
    return null;
  }
  const data = await response.json();
  setCached(key, data);
  return data;
}

/**
 * Get pathogenic variants for a protein.
 */
export async function getPathogenicVariants(
  accession: string,
  options: { minScore?: number; limit?: number } = {}
): Promise<Array<{ position: number; variant: string; pathogenicityScore: number }>> {
  const params = {
    accession,
    min_score: options.minScore ?? 0.564,
    limit: options.limit ?? 50,
  };
  
  const key = cacheKey('get_pathogenic_variants', params);
  const cached = getCached<any[]>(key);
  if (cached) return cached;
  
  if (!USE_LIVE_MCP) {
    return [];
  }
  
  const response = await fetch('/api/mcp/pathogenic-variants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) return [];
  const data = await response.json();
  const result = data.variants.map((v: any) => ({
    position: v.position,
    variant: v.variant,
    pathogenicityScore: v.pathogenicity_score,
  }));
  setCached(key, result);
  return result;
}

/**
 * Find functionally similar proteins via semantic embedding.
 */
export async function searchSimilarProteinsSemantic(
  queryText: string,
  options: { limit?: number } = {}
): Promise<Protein[]> {
  const params = {
    query_text: queryText,
    limit: options.limit ?? 10,
  };
  
  const key = cacheKey('search_similar_proteins_semantic', params);
  const cached = getCached<Protein[]>(key);
  if (cached) return cached;
  
  if (!USE_LIVE_MCP) {
    return [];
  }
  
  const response = await fetch('/api/mcp/similar-proteins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) return [];
  const data = await response.json();
  const proteins: Protein[] = data.results.map((r: any) => ({
    gene: r.gene_name,
    uniprot: r.uniprot_accession,
    name: r.protein_name,
    function: r.function_summary ?? '',
    plddt: r.mean_plddt ?? null,
    score: r.similarity ?? 0,
  }));
  setCached(key, proteins);
  return proteins;
}

export const mcpClient = {
  searchProteinsByDisease,
  getProteinDetails,
  getPathogenicVariants,
  searchSimilarProteinsSemantic,
  isLive: () => USE_LIVE_MCP,
};
