/**
 * Citation registry — single source of truth for every literature reference
 * in the Discovery report. Each citation is a first-class data record that
 * surfaces in three places:
 *
 *   1. As an inline chip next to the claim it backs (the <Cite> component)
 *   2. In the slide-from-the-right citation drawer, with title, journal,
 *      resolvable URL, the body excerpt, and a list of every claim it backs
 *   3. (Future) In the Evidence Library scene as an aggregated table that
 *      can be exported as JSON / CSV / clipboard
 *
 * The `backs` array contains short claim IDs that scenes reference to ask
 * "what backs this?". A citation can back multiple claims; a claim can be
 * backed by multiple citations. The IDs are intentionally short and
 * scene-agnostic so the same claim can resurface anywhere.
 */

export const CITATIONS = [
  {
    id: 'rcsb-7nx1',
    kind: 'structure',
    label: 'RCSB PDB · 7NX1',
    short: '7NX1',
    title: 'LTK extracellular region — polyglycine type II hexagonal lattice',
    source: 'RCSB Protein Data Bank',
    year: '2022',
    url: 'https://www.rcsb.org/structure/7NX1',
    body: 'The crystal structure of the LTK extracellular region, described in the entry as "a novel architectural chimera of a permuted TNF-like module that braces a glycine-rich subdomain featuring a hexagonal lattice of long polyglycine type II helices." This is the structural confirmation that LTK\'s glycine architecture is real, observed, and unusual.',
    backs: ['glycine-cluster', 'ltk-flexibility', 'evolution-flexibility'],
  },
  {
    id: 'pubmed-1716976',
    kind: 'literature',
    label: 'PubMed · 1716976',
    short: 'PubMed 1716976',
    title: 'Glycine loops are highly flexible with little regular secondary structure',
    source: 'PubMed (foundational structural biology)',
    year: '1991',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1716976/',
    body: 'Foundational paper establishing that glycine loop sequences are "expected to be highly flexible, but possess little other regular secondary structure." Provides the mechanistic basis for why LTK\'s glycine clustering matters: glycines have no side chain, so consecutive glycines act as backbone hinges.',
    backs: ['glycine-cluster', 'ltk-flexibility'],
  },
  {
    id: 'pmc-8175086',
    kind: 'literature',
    label: 'PMC · 8175086',
    short: 'PMC 8175086',
    title: 'MOK identified as a mitochondrial kinase regulating cristae dynamics and oxidative stress',
    source: 'PubMed Central',
    year: '2021',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8175086/',
    body: 'Recent characterization of MOK as a mitochondrial kinase involved in cristae dynamics, respiration, and oxidative stress response. Bridges "poorly characterized kinase" to "metabolically active mitochondrial kinase" — and validates the AI semantic clustering with LTK on cardiometabolic relevance, after the fact.',
    backs: ['mok-mitochondrial', 'disease-pathway', 'ai-semantic-cluster'],
  },
  {
    id: 'nature-mint',
    kind: 'methodology',
    label: 'Nature Comm. · MINT',
    short: 'MINT (Nature)',
    title: 'MINT — protein-protein interaction modeling in scalable context',
    source: 'Nature Communications',
    year: '2025',
    url: 'https://www.nature.com/articles/s41467-025-67971-3',
    body: '"Designed to model sets of interacting proteins in a contextual and scalable manner," addressing the limitation that protein language models face challenges natively representing protein-protein interactions. Validates the AI-semantic-similarity methodology this report rests on.',
    backs: ['ai-semantic-cluster', 'methodology'],
  },
  {
    id: 'sciencedirect-w2v',
    kind: 'methodology',
    label: 'ScienceDirect · Word2Vec/PubMed',
    short: 'Word2Vec/PubMed',
    title: 'Word2Vec embedding of PubMed with kNN predicts future protein interactions',
    source: 'ScienceDirect',
    url: 'https://www.sciencedirect.com/',
    body: 'Foundation paper showing Word2Vec embedding of the PubMed corpus combined with k-nearest-neighbor classification can predict future protein interactions. Methodological basis for the 52% AI semantic similarity score that drove the LTK ↔ MOK clustering in this report.',
    backs: ['ai-semantic-cluster', 'methodology'],
  },
];

/** Fast lookup by id. */
export const CITATIONS_BY_ID = Object.fromEntries(CITATIONS.map((c) => [c.id, c]));

/** Citations that back a given claim id. */
export function citationsForClaim(claimId) {
  return CITATIONS.filter((c) => c.backs.includes(claimId));
}

/** Resolve a list of citation ids (possibly null/undefined) to records. */
export function resolveIds(ids) {
  if (!ids || !ids.length) return [];
  return ids.map((id) => CITATIONS_BY_ID[id]).filter(Boolean);
}
