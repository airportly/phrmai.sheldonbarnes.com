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
        disease: data.diseases[0],
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
  
  findProteinByQuery(query: string): Protein | null {
    const normalized = query.toLowerCase().trim();
    
    for (const organKey of Object.keys(this.data.organs) as OrganKey[]) {
      const proteins = this.getProteinsByOrgan(organKey);
      for (const p of proteins) {
        if (normalized.includes(p.gene.toLowerCase())) {
          return p;
        }
      }
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
