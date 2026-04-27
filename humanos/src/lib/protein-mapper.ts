/**
 * Protein mapper - Centralizes the organ-to-disease-to-protein lookup logic.
 * 
 * In Phase 1, this reads from the static fma-protein-mapping.json file.
 * In Phase 2, the lookups go through mcp-client.ts to hit the live database.
 * The interface stays the same so consumer components do not need to change.
 */

import mappingData from '@/data/fma-protein-mapping.json';

export type OrganKey = 'brain' | 'heart' | 'liver' | 'pancreas' | 'kidneys' | 'adipose';

export interface Protein {
  gene: string;
  uniprot: string;
  name: string;
  function: string;
  plddt: number | null;
  score: number;
  notes?: string;
  variantCount?: number;
  hotspots?: number[];
  disease?: string;
}

export interface OrganData {
  fmaId: string;
  label: string;
  subtitle: string;
  color: string;
  diseases: string[];
  proteins: Protein[];
}

class ProteinMapper {
  private data = mappingData;
  
  getOrganData(organ: OrganKey): OrganData | null {
    const data = (this.data.organs as any)[organ];
    if (!data) return null;
    return {
      fmaId: data.fmaId,
      label: data.label,
      subtitle: data.subtitle,
      color: data.color,
      diseases: data.diseases,
      proteins: data.proteins.map((p: any) => ({
        gene: p.gene,
        uniprot: p.uniprot,
        name: p.name,
        function: p.function,
        plddt: p.plddt,
        score: p.score,
        notes: p.notes,
        disease: p.disease ?? data.diseases[0],
      })),
    };
  }
  
  getProteinsByOrgan(organ: OrganKey): Protein[] {
    return this.getOrganData(organ)?.proteins ?? [];
  }
  
  getOrganLabel(organ: OrganKey): string {
    return this.getOrganData(organ)?.label ?? organ;
  }
  
  getOrganColor(organ: OrganKey): string {
    return this.getOrganData(organ)?.color ?? '#2dd4bf';
  }
  
  /**
   * Resolve a free-form query (a chat message, a voice transcript) to a
   * specific protein. Strategy is layered, strictest first:
   *
   *   1. Exact gene-symbol token (word-boundary). "Tell me about PCSK9" hits
   *      PCSK9; "interesting" does NOT hit INS just because it contains
   *      "ins".
   *   2. Exact protein-name token. "Insulin" → INS, "myostatin" → MSTN.
   *   3. Common-name aliases for proteins whose colloquial name doesn't match
   *      either the gene symbol or the canonical protein name in the data.
   *   4. Loose contains-match on gene symbol (last resort, kept for
   *      back-compat with prior behavior).
   *
   * Among ties, the highest OpenTargets association score wins so an unambiguous
   * "insulin" picks the Insulin entry, not Insulin-degrading enzyme.
   */
  findProteinByQuery(query: string): Protein | null {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return null;
    const tokens = new Set(normalized.split(/[^a-z0-9]+/i).filter(Boolean));

    const all: Protein[] = [];
    for (const organKey of Object.keys(this.data.organs) as OrganKey[]) {
      all.push(...this.getProteinsByOrgan(organKey));
    }

    const pickBest = (matches: Protein[]) =>
      matches.length === 0 ? null : matches.reduce((a, b) => (b.score > a.score ? b : a));

    // Tier 1: exact gene-symbol token match.
    const t1 = all.filter((p) => tokens.has(p.gene.toLowerCase()));
    if (t1.length) return pickBest(t1);

    // Tier 2: exact protein-name token match (e.g. "insulin" matches the
    // protein literally named "Insulin"). We tokenize the protein name too
    // and check for an intersection with the query tokens.
    const t2 = all.filter((p) => {
      const nameTokens = (p.name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      // Single-word protein names: require equality with one of the query
      // tokens so "insulin" hits INS but not "Insulin-degrading enzyme".
      if (nameTokens.length === 1) return tokens.has(nameTokens[0]);
      // Multi-word names: require that the FULL query phrase appears (so
      // "insulin receptor" hits INSR but bare "insulin" does not).
      const phrase = (p.name ?? '').toLowerCase();
      return phrase && normalized.includes(phrase);
    });
    if (t2.length) return pickBest(t2);

    // Tier 3: common-name aliases that don't appear in the data. Maps the
    // colloquial term to the canonical gene symbol.
    const aliases: Record<string, string> = {
      insulin: 'INS',
      leptin: 'LEP',
      adiponectin: 'ADIPOQ',
      glucagon: 'GCG',
      'beta-amyloid': 'APP',
      amyloid: 'APP',
    };
    for (const token of tokens) {
      const sym = aliases[token];
      if (sym) {
        const hit = all.find((p) => p.gene.toUpperCase() === sym.toUpperCase());
        if (hit) return hit;
      }
    }

    // Tier 4: loose contains-match on gene symbol. Last resort for cases
    // like "PCSK9-targeted therapy" where the gene appears without a clean
    // word boundary.
    for (const p of all) {
      if (normalized.includes(p.gene.toLowerCase())) return p;
    }
    return null;
  }
  
  findOrganByQuery(query: string): OrganKey | null {
    const normalized = query.toLowerCase().trim();
    
    const aliases: Record<string, OrganKey> = {
      'brain': 'brain',
      'heart': 'heart',
      'cardiac': 'heart',
      'liver': 'liver',
      'hepatic': 'liver',
      'pancreas': 'pancreas',
      'pancreatic': 'pancreas',
      'kidney': 'kidneys',
      'kidneys': 'kidneys',
      'renal': 'kidneys',
      'adipose': 'adipose',
      'fat': 'adipose',
    };
    
    for (const [alias, organ] of Object.entries(aliases)) {
      if (normalized.includes(alias)) return organ;
    }
    return null;
  }
  
  getOrganForProtein(protein: Protein): OrganKey | null {
    for (const organKey of Object.keys(this.data.organs) as OrganKey[]) {
      const proteins = this.getProteinsByOrgan(organKey);
      if (proteins.some(p => p.gene === protein.gene)) {
        return organKey;
      }
    }
    return null;
  }
  
  /**
   * Compute the context complexity score for a protein.
   * Range: 0 to 1.
   * 30% structural confidence + 40% disease association + 30% variant burden.
   */
  computeComplexity(protein: Protein): number {
    const structScore = (protein.plddt ?? 0) / 100;
    const diseaseScore = protein.score;
    const variantScore = Math.min((protein.variantCount ?? 0) / 200, 1);
    return Math.max(0, Math.min(1,
      structScore * 0.3 + diseaseScore * 0.4 + variantScore * 0.3
    ));
  }
  
  getAllShadowProteins(): Record<string, Array<{ gene: string; reason: string }>> {
    return this.data.shadowProteins as any;
  }
}

export const proteinMapper = new ProteinMapper();
