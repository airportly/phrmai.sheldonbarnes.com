/**
 * Protein characterization helpers.
 *
 * Surfaces filterable / sortable axes for the catalog view: function class,
 * gene family, drug target status, AlphaFold confidence band, variant burden.
 * The taxonomy is intentionally coarse — six function classes plus a fallback,
 * five gene families derived from name prefixes — because the snapshot has
 * around 45 proteins and finer buckets would feel sparse.
 */

import type { Protein, OrganKey } from './protein-mapper';
import { proteinMapper } from './protein-mapper';
import { hasVariants } from './variant-analysis';

export type FunctionClass =
  | 'Ion channel'
  | 'Receptor'
  | 'Kinase'
  | 'Transcription factor'
  | 'Apolipoprotein'
  | 'Coagulation'
  | 'Enzyme'
  | 'Transporter'
  | 'Other';

export type GeneFamily =
  | 'KCN (K+ channels)'
  | 'SCN (Na+ channels)'
  | 'APO (apolipoproteins)'
  | 'F (coagulation factors)'
  | 'HNF (HNF transcription factors)'
  | 'Other';

export type PlddtBand = 'Very high' | 'Confident' | 'Low' | 'Very low' | 'No structure';

export type VariantBurdenBand = 'High burden' | 'Moderate' | 'Low' | 'No data';

export interface EnrichedProtein extends Protein {
  organ: OrganKey;
  organLabel: string;
  organColor: string;
  functionClass: FunctionClass;
  geneFamily: GeneFamily;
  plddtBand: PlddtBand;
  variantBurden: VariantBurdenBand;
  /** True when notes mention a drug, drug target, or therapeutic class. */
  isDrugTarget: boolean;
}

const ORGAN_KEYS: OrganKey[] = ['brain', 'heart', 'liver', 'pancreas', 'kidneys', 'adipose'];

export function functionClassFor(p: Protein): FunctionClass {
  const fn = (p.function ?? '').toLowerCase();
  const gene = p.gene.toUpperCase();
  if (gene.startsWith('KCN') || gene.startsWith('SCN') || gene.startsWith('CACN') || fn.includes('channel')) return 'Ion channel';
  if (fn.includes('receptor') || gene.startsWith('ADR') || gene === 'AGTR1' || gene === 'GLP1R' || gene === 'GIPR' || gene === 'MC4R' || gene === 'LEPR') return 'Receptor';
  if (fn.includes('kinase') || gene === 'INSR') return 'Kinase';
  if (fn.includes('transcription factor') || gene.startsWith('HNF') || gene.startsWith('SMAD') || gene === 'PPARG' || gene === 'THRB') return 'Transcription factor';
  if (gene.startsWith('APO') || fn.includes('apolipoprotein')) return 'Apolipoprotein';
  if (gene.match(/^F\d+$/) || fn.includes('coagulation') || fn.includes('thrombin') || fn.includes('clotting')) return 'Coagulation';
  if (fn.includes('atpase') || fn.includes('transport') || fn.startsWith('atp-binding') || gene.startsWith('SLC') || gene.startsWith('ABC')) return 'Transporter';
  if (fn.includes('reductase') || fn.includes('synthase') || fn.includes('dehydrogenase') || fn.includes('hydrolase') || fn.includes('protease') || fn.includes('phosphat')) return 'Enzyme';
  return 'Other';
}

export function geneFamilyFor(p: Protein): GeneFamily {
  const g = p.gene.toUpperCase();
  if (g.startsWith('KCN')) return 'KCN (K+ channels)';
  if (g.startsWith('SCN')) return 'SCN (Na+ channels)';
  if (g.startsWith('APO')) return 'APO (apolipoproteins)';
  if (g.match(/^F\d+$/))   return 'F (coagulation factors)';
  if (g.startsWith('HNF')) return 'HNF (HNF transcription factors)';
  return 'Other';
}

export function plddtBandFor(p: Protein): PlddtBand {
  if (p.plddt == null) return 'No structure';
  if (p.plddt >= 90) return 'Very high';
  if (p.plddt >= 70) return 'Confident';
  if (p.plddt >= 50) return 'Low';
  return 'Very low';
}

export function variantBurdenFor(p: Protein): VariantBurdenBand {
  if (!hasVariants(p.uniprot) && (p.variantCount == null || p.variantCount === 0)) return 'No data';
  const count = p.variantCount ?? (hasVariants(p.uniprot) ? 100 : 0);
  if (count >= 200) return 'High burden';
  if (count >= 50)  return 'Moderate';
  return 'Low';
}

const DRUG_KEYWORDS = [
  'target', 'inhibitor', 'agonist', 'antagonist', 'blocker',
  'statin', 'sulfonylurea', 'thiazolidinedione', 'glp', 'sglt',
  'arb', 'ace inhibitor', 'beta-blocker', 'mab', 'sirna',
  'evolocumab', 'alirocumab', 'inclisiran', 'dabigatran', 'rivaroxaban', 'apixaban',
  'losartan', 'valsartan', 'lisinopril', 'enalapril', 'metoprolol', 'bisoprolol', 'carvedilol',
  'semaglutide', 'tirzepatide', 'liraglutide', 'metreleptin', 'setmelanotide', 'pioglitazone', 'rosiglitazone',
  'cilostazol', 'clopidogrel', 'ticagrelor', 'flecainide', 'anacetrapib', 'obicetrapib', 'pelacarsen',
];

export function isDrugTarget(p: Protein): boolean {
  const text = `${p.notes ?? ''} ${p.function ?? ''}`.toLowerCase();
  return DRUG_KEYWORDS.some((kw) => text.includes(kw));
}

export function enrichProtein(p: Protein, organ: OrganKey): EnrichedProtein {
  const organData = proteinMapper.getOrganData(organ);
  return {
    ...p,
    organ,
    organLabel: organData?.label ?? organ,
    organColor: organData?.color ?? '#94a3b8',
    functionClass: functionClassFor(p),
    geneFamily: geneFamilyFor(p),
    plddtBand: plddtBandFor(p),
    variantBurden: variantBurdenFor(p),
    isDrugTarget: isDrugTarget(p),
  };
}

export function getAllEnrichedProteins(): EnrichedProtein[] {
  const out: EnrichedProtein[] = [];
  const seen = new Set<string>();
  for (const organ of ORGAN_KEYS) {
    const data = proteinMapper.getOrganData(organ);
    if (!data) continue;
    for (const p of data.proteins) {
      const key = `${p.gene}:${organ}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(enrichProtein(p, organ));
    }
  }
  return out;
}
