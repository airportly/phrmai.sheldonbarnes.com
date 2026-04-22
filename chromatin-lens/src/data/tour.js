// Audio-narrated tour of the whole app. Each step is a partial app-state snapshot
// plus narration text. The AudioTourControl walks through them using the Web
// Speech API. Step advances when TTS `onend` fires, or after `pauseAfterMs`.

import { SCALES } from './locus';

const midpoint = (id) => {
  const s = SCALES.find((x) => x.id === id);
  return (s.zoomMin + s.zoomMax) / 2;
};

// Sensible default state that a step can partially override.
const RESET = {
  mitosisDetail: 'full',
  mitosisProgress: 0,
  mitosisPlaying: false,
  stageId: 'adult',
  extrusionProgress: 1,
  extrusionPlaying: false,
  transcribing: false,
  histoneMarkId: 'none',
  replicationProgress: 0,
  replicationPlaying: false,
  altFormId: 'b',
  selectedInfo: null,
};

export const TOUR_STEPS = [
  {
    id: 'intro',
    narration:
      "Welcome to ChromatinLens. This is an interactive tour of the eight levels of chromatin organization in a human cell, anchored on the beta-globin locus on chromosome eleven. We'll travel from the whole nucleus down to individual atoms, with several animations playing along the way. You can pause or exit the tour at any time. Let's begin.",
    state: { ...RESET, zoom: midpoint('nucleus') }
  },
  {
    id: 'nucleus',
    narration:
      "We're inside a human cell nucleus, about ten micrometers across. All 46 chromosomes live in here, each in its own spatial territory. The yellow one is chromosome eleven, our home for the entire tour. The pink blob is the nucleolus, where ribosomes are made. The small green rings are lamina-associated domains — silenced chromatin regions pressed against the nuclear envelope.",
    state: { ...RESET, zoom: midpoint('nucleus') }
  },
  {
    id: 'mitosis',
    narration:
      "When a cell divides, this whole organization is torn down and rebuilt. Watch over the next twelve seconds as the chromosomes condense into X-shapes, align at the equator, split apart, and form two new daughter nuclei. Every time a cell divides, loops, TADs, and compartments dissolve and reform. It is chromatin's most dramatic moment.",
    state: { ...RESET, zoom: midpoint('nucleus'), mitosisDetail: 'full', mitosisProgress: 0, mitosisPlaying: true },
    pauseAfterMs: 2500
  },
  {
    id: 'compartment',
    narration:
      "Zooming into chromosome eleven, we see alternating A and B compartments. The gold regions are active euchromatin — gene-dense and transcribed. The indigo regions are inactive heterochromatin — gene-poor, often pressed against the nuclear lamina. The red sphere marks where the beta-globin locus lives, inside an active A compartment.",
    state: { ...RESET, zoom: midpoint('compartment') }
  },
  {
    id: 'tad',
    narration:
      "A million base pairs at a time, chromatin folds into self-interacting neighborhoods called Topologically Associating Domains, or TADs. The gold bubble in the middle is the TAD that contains our beta-globin genes. The blue bubbles on either side are neighboring TADs. The red spheres between them are CTCF boundary elements — insulators that keep the neighborhoods distinct.",
    state: { ...RESET, zoom: midpoint('tad') }
  },
  {
    id: 'loop-intro',
    narration:
      "Inside the TAD, we finally see an individual chromatin loop, about a hundred kilobases across. The purple sphere is the Locus Control Region — a powerful enhancer. The yellow beam is its physical contact with the HBB gene. This contact is what turns HBB on.",
    state: { ...RESET, zoom: midpoint('loop'), stageId: 'adult' }
  },
  {
    id: 'loop-embryonic',
    narration:
      "The remarkable thing about this loop is that it retargets during development. Early in embryogenesis, the Locus Control Region contacts HBE1 — the embryonic globin gene. This is the hemoglobin of a yolk-sac embryo, only days old.",
    state: { ...RESET, zoom: midpoint('loop'), stageId: 'embryonic' }
  },
  {
    id: 'loop-fetal',
    narration:
      "After about six weeks of gestation, the loop switches. The LCR now contacts the fetal genes HBG1 and HBG2. Fetal hemoglobin binds oxygen more tightly than adult hemoglobin — which is how a fetus pulls oxygen across the placenta from its mother's blood.",
    state: { ...RESET, zoom: midpoint('loop'), stageId: 'fetal' }
  },
  {
    id: 'loop-adult',
    narration:
      "At birth, the switch flips again. The LCR targets HBB, the adult beta-globin gene, and stays there for life. Mutations in HBB cause sickle-cell disease and beta-thalassemia. The first-ever CRISPR therapy, Casgevy, works by silencing the BCL11A transcription factor, reactivating these fetal genes to compensate for broken adult HBB.",
    state: { ...RESET, zoom: midpoint('loop'), stageId: 'adult' }
  },
  {
    id: 'loop-extrusion',
    narration:
      "How does a loop form in the first place? The purple ring at the base is cohesin. Let's rewind and watch cohesin build this loop from scratch, reeling DNA through its ring at about a thousand base pairs per second, stopping only when it bumps into the two red CTCF sites.",
    state: { ...RESET, zoom: midpoint('loop'), stageId: 'adult', extrusionProgress: 0, extrusionPlaying: true },
    pauseAfterMs: 2000
  },
  {
    id: 'loop-transcription',
    narration:
      "And this is what the loop is for. Now that LCR and HBB are in contact, RNA polymerase two loads onto HBB and transcribes. The pink blobs moving along the gene are polymerase molecules; the teal particles drifting outward are nascent messenger RNAs being released. In a real red-blood-cell precursor, beta-globin mRNA is produced at thousands of copies per cell.",
    state: { ...RESET, zoom: midpoint('loop'), stageId: 'adult', extrusionProgress: 1, transcribing: true }
  },
  {
    id: 'fiber',
    narration:
      "Moving on. Here is the thirty-nanometer chromatin fiber — a textbook solenoid of coiled nucleosomes. You'll notice it is flagged as disputed. Purified chromatin forms this structure in a test tube, but modern imaging of living cells shows chromatin is actually a disordered clutch of nucleosomes, not a regular fiber. It's a cautionary tale about textbook diagrams.",
    state: { ...RESET, zoom: midpoint('fiber') }
  },
  {
    id: 'nucleosomes-intro',
    narration:
      "At the two-kilobase scale, we see the true fundamental unit of chromatin — the nucleosome. Each pink disc is an octamer of eight histone proteins. The blue DNA wraps around it about one-point-six times, burying a hundred and forty-seven base pairs per nucleosome. This is the shape that gives chromatin the famous beads-on-a-string appearance.",
    state: { ...RESET, zoom: midpoint('nucleosomes'), histoneMarkId: 'none' }
  },
  {
    id: 'nucleosomes-k27ac',
    narration:
      "Protruding from each nucleosome are histone tails. These tails carry combinations of chemical modifications — the so-called histone code. Let's paint all the tails green with H3K27 acetylation, the hallmark mark of active enhancers. This is what the LCR actually looks like at the nucleosome level — acetylated to the hilt.",
    state: { ...RESET, zoom: midpoint('nucleosomes'), histoneMarkId: 'h3k27ac' }
  },
  {
    id: 'nucleosomes-k27me3',
    narration:
      "Now flip to H3K27 tri-methylation, shown in red. This is the mark of Polycomb silencing, laid down by the PRC2 complex. In adult red-blood-cell precursors, all the fetal globin nucleosomes carry this mark. Reactivating those silenced nucleosomes is the strategy behind sickle-cell CRISPR therapy.",
    state: { ...RESET, zoom: midpoint('nucleosomes'), histoneMarkId: 'h3k27me3' }
  },
  {
    id: 'helix-intro',
    narration:
      "Zooming deeper, we reach the DNA double helix itself. Two antiparallel strands wound around each other, with ten and a half base pairs per turn. Each rung is a base pair — A binds T with two hydrogen bonds, G binds C with three. This is the molecule that Watson, Crick, and Franklin figured out in 1953.",
    state: { ...RESET, zoom: midpoint('helix') }
  },
  {
    id: 'helix-replication',
    narration:
      "Let's watch DNA replicate. The yellow ring is a helicase, unwinding the parents. Behind the fork you'll see continuous green synthesis on the leading strand, and discontinuous cyan Okazaki fragments on the lagging strand. Fifty thousand forks like this operate at once in every dividing cell, copying the whole diploid genome — six billion base pairs — in about eight hours.",
    state: { ...RESET, zoom: midpoint('helix'), replicationProgress: 0, replicationPlaying: true },
    pauseAfterMs: 2000
  },
  {
    id: 'helix-g4',
    narration:
      "DNA doesn't always stay as a clean double helix. Here, a G-rich region has folded into a four-stranded G-quadruplex. G-quadruplexes form at telomeres and at the promoters of cancer genes like MYC. Small molecules that stabilize G-quadruplexes are being tested as cancer drugs.",
    state: { ...RESET, zoom: midpoint('helix'), altFormId: 'g4' }
  },
  {
    id: 'atomic',
    narration:
      "At the final level, we see chemistry. Each base is an aromatic ring system — carbons in grey, nitrogens in blue, oxygens in red. The dashed white lines are hydrogen bonds. And above and below, you can see base stacking — the planar bases piled like coins — which actually provides most of the stability of the double helix, more than the hydrogen bonds themselves.",
    state: { ...RESET, zoom: midpoint('atomic') }
  },
  {
    id: 'conclusion',
    narration:
      "That ends the tour. You now have the whole chromatin stack in view — from the nucleus, down through compartments, TADs, loops, nucleosomes, and the helix, all the way to individual atoms. Explore on your own. Click any element to learn more. Try the play buttons at levels one, four, six, and seven. Thanks for taking the tour.",
    state: { ...RESET, zoom: midpoint('nucleus') }
  }
];

// Which scale each step belongs to. Null = meta step (intro/conclusion) —
// not included in per-level tours.
const STEP_SCALE = {
  'intro': null,
  'nucleus': 'nucleus',
  'mitosis': 'nucleus',
  'compartment': 'compartment',
  'tad': 'tad',
  'loop-intro': 'loop',
  'loop-embryonic': 'loop',
  'loop-fetal': 'loop',
  'loop-adult': 'loop',
  'loop-extrusion': 'loop',
  'loop-transcription': 'loop',
  'fiber': 'fiber',
  'nucleosomes-intro': 'nucleosomes',
  'nucleosomes-k27ac': 'nucleosomes',
  'nucleosomes-k27me3': 'nucleosomes',
  'helix-intro': 'helix',
  'helix-replication': 'helix',
  'helix-g4': 'helix',
  'atomic': 'atomic',
  'conclusion': null,
};

// Returns a curated subset of tour steps for a given scale id — used when
// the user requests a tour of just the level they're currently viewing.
export function stepsForScale(scaleId) {
  return TOUR_STEPS.filter((s) => STEP_SCALE[s.id] === scaleId);
}
