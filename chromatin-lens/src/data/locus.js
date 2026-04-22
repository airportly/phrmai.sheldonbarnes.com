// Beta globin locus data, chromosome 11, roughly chr11:5,200,000-5,300,000 in hg38
// Data is representative of published Hi-C, ChIP-seq, and sequence sources
// Real sequence from HBB gene region, GenBank reference

export const LOCUS = {
  name: "Beta globin locus (HBB)",
  chromosome: "chr11",
  start: 5200000,
  end: 5300000,
  description: "Classic textbook locus containing HBB, HBD, HBG1, HBG2, HBE1 and the Locus Control Region"
};

// Scale definitions, each with a zoom threshold and physical scale in nanometers
// Zoom value goes from 0 (most zoomed out) to 1 (most zoomed in)
// `maxGrow` is how much the scene grows within its zoom range (Powers-of-Ten feel)
// `disputed: true` marks scales whose in-vivo reality is debated — shown to users.
export const SCALES = [
  {
    id: "nucleus",
    name: "Nucleus & chromosome territories",
    sizeLabel: "~10 µm · whole genome",
    bpRange: "~6 Gb (diploid)",
    zoomMin: 0.000,
    zoomMax: 0.125,
    maxGrow: 16,
    description: "The entire genome — 46 chromosomes in a human diploid cell — is packed into a nucleus roughly 10 µm across. Each chromosome occupies its own spatial 'territory' and does not tangle with its neighbors. Gene-dense chromosomes tend to cluster near the center; gene-poor ones near the lamina."
  },
  {
    id: "compartment",
    name: "A/B compartments along chr11",
    sizeLabel: "~10 Mb blocks",
    bpRange: "tens of millions of bp",
    zoomMin: 0.125,
    zoomMax: 0.250,
    maxGrow: 16,
    description: "Within each chromosome, chromatin segregates into alternating active (A, euchromatin) and inactive (B, heterochromatin) compartments. A regions are gene-dense and transcribed; B regions are gene-poor and often pressed against the nuclear lamina. Shows up as a checkerboard pattern in Hi-C contact maps."
  },
  {
    id: "tad",
    name: "Topologically Associating Domain (TAD)",
    sizeLabel: "~1 Mb · ~1 µm",
    bpRange: "~1,000,000 base pairs",
    zoomMin: 0.250,
    zoomMax: 0.375,
    maxGrow: 16,
    description: "Self-interacting chromatin neighborhoods with sharp boundaries. Regulatory contacts tend to stay inside a TAD. The β-globin locus sits inside its own ~200 kb TAD. TADs appear as bright triangles in Hi-C maps and are usually bounded by convergent CTCF sites."
  },
  {
    id: "loop",
    name: "Chromatin loop with CTCF anchors",
    sizeLabel: "~100 kb · ~500 nm",
    bpRange: "100,000 base pairs",
    zoomMin: 0.375,
    zoomMax: 0.500,
    maxGrow: 16,
    description: "Inside each TAD, individual loops bring specific regulatory regions into contact with their target genes. Here the Locus Control Region loops to the HBB promoter, held in place by cohesin and two convergent CTCF sites."
  },
  {
    id: "fiber",
    name: "30-nm chromatin fiber (solenoid)",
    sizeLabel: "~30 nm diameter",
    bpRange: "thousands of base pairs",
    zoomMin: 0.500,
    zoomMax: 0.625,
    maxGrow: 14,
    disputed: true,
    description: "The classical textbook model: nucleosomes coil into a regular solenoid ~30 nm across. Super-resolution microscopy (ChromEMT) has since shown that cells do not actually form a regular 30-nm fiber in vivo — chromatin is a more disordered array of nucleosome 'clutches'. Shown here for historical and educational reasons."
  },
  {
    id: "nucleosomes",
    name: "Nucleosome array on chromatin fiber",
    sizeLabel: "~2 kb · ~100 nm",
    bpRange: "2,000 base pairs",
    zoomMin: 0.625,
    zoomMax: 0.750,
    maxGrow: 18,
    description: "The 'beads on a string' form of chromatin. Individual nucleosomes — ~147 bp of DNA wrapped around a histone octamer — separated by stretches of linker DNA. This is the basic repeating unit of eukaryotic chromatin."
  },
  {
    id: "helix",
    name: "DNA double helix",
    sizeLabel: "~50 bp · ~17 nm",
    bpRange: "50 base pairs",
    zoomMin: 0.750,
    zoomMax: 0.875,
    maxGrow: 14,
    description: "B-form DNA: two antiparallel strands wound around a common axis with ~10.5 base pairs per turn. The sequence shown is from the HBB promoter. Base pairs follow A–T and G–C rules."
  },
  {
    id: "atomic",
    name: "Nucleotide chemistry",
    sizeLabel: "~1 nm · individual atoms",
    bpRange: "1 base pair",
    zoomMin: 0.875,
    zoomMax: 1.000,
    maxGrow: 10,
    description: "At the chemical level, a single base pair is two flat heterocyclic ring systems held together by hydrogen bonds (G–C with three, A–T with two). Each base is linked to a deoxyribose sugar, and sugars are connected through phosphate groups to form the backbone. Base stacking between adjacent pairs is the main force stabilizing the helix."
  }
];

// CTCF anchor positions for the loop, normalized to 0-1 along the loop
export const CTCF_ANCHORS = [
  { position: 0.05, strand: "forward", label: "CTCF site 1 (LCR boundary)" },
  { position: 0.95, strand: "reverse", label: "CTCF site 2 (HBB boundary)" }
];

// Gene positions along the loop, normalized 0-1.
// `active` is the default (adult) state; overridden by developmental stage.
export const GENES = [
  { start: 0.12, end: 0.17, name: "HBE1", active: false },
  { start: 0.35, end: 0.40, name: "HBG2", active: false },
  { start: 0.45, end: 0.50, name: "HBG1", active: false },
  { start: 0.70, end: 0.72, name: "HBD",  active: false },
  { start: 0.80, end: 0.85, name: "HBB",  active: true }
];

// Cell-cycle / mitosis stages — visible on the Nucleus level.
// Each stage completely rearranges 3D genome architecture: loops, TADs,
// and compartments all dissolve at prometaphase and are rebuilt at telophase.
export const CELL_CYCLE_STAGES = [
  {
    id: 'interphase',
    label: 'Interphase',
    timeframe: '~95% of cell life',
    summary: 'Chromosomes occupy loose territories. Nuclear envelope intact. Loops, TADs, compartments, and transcription are all active. This is what the rest of the app shows.'
  },
  {
    id: 'metaphase',
    label: 'Metaphase',
    timeframe: '~15 min',
    summary: '46 condensed X-shaped chromosomes line up at the cell equator. Nuclear envelope gone. Loops/TADs/compartments have all dissolved — condensin has built a totally different ~80 kb loop architecture.'
  },
  {
    id: 'anaphase',
    label: 'Anaphase',
    timeframe: '~5 min',
    summary: 'Centromeres split. Sister chromatids are reeled apart to opposite poles by spindle microtubules. Each daughter receives exactly one copy of every chromosome.'
  },
  {
    id: 'telophase',
    label: 'Telophase',
    timeframe: '~10 min',
    summary: 'Two new nuclear envelopes reform. Chromatin decondenses. Interphase loops/TADs/compartments re-establish. Cell pinches in two (cytokinesis).'
  }
];

// Developmental globin switch: the LCR physically contacts a different gene at
// each stage, driving expression of the right globin for that point in life.
export const DEVELOPMENTAL_STAGES = [
  {
    id: 'embryonic',
    label: 'Embryonic',
    timeframe: '0–6 wk gestation',
    activeGenes: ['HBE1'],
    summary: 'LCR → HBE1 (ε). Primitive yolk-sac erythroblasts make Hb Gower/Portland (ζ₂ε₂, α₂ε₂).'
  },
  {
    id: 'fetal',
    label: 'Fetal',
    timeframe: '6 wk – birth',
    activeGenes: ['HBG1', 'HBG2'],
    summary: 'LCR → HBG1/HBG2 (γ). HbF (α₂γ₂) has higher O₂ affinity than HbA — how fetal blood pulls O₂ from maternal blood.'
  },
  {
    id: 'adult',
    label: 'Adult',
    timeframe: 'birth → lifelong',
    activeGenes: ['HBB'],
    summary: 'LCR → HBB (β). BCL11A silences HBG1/HBG2. HbA (α₂β₂) is the primary adult hemoglobin.'
  }
];

// Nucleosome positions and linker lengths for the mid-scale view
// Array of nucleosomes with their position along a linear fiber
export const NUCLEOSOMES = Array.from({ length: 12 }, (_, i) => ({
  index: i,
  // Slight irregularity in spacing to look realistic
  position: i * 1.0 + (Math.sin(i * 2.3) * 0.08),
  // Slight rotation variation
  rotation: i * 0.52 + Math.cos(i * 1.7) * 0.15
}));

// Alternative DNA structures — toggleable at the Helix level.
export const ALT_FORMS = [
  {
    id: 'b',
    label: 'B-DNA',
    short: 'B',
    color: '#6b9eff',
    description: 'The standard right-handed double helix. What 97% of the genome looks like at any given moment. ~10.5 bp/turn, 3.4 Å rise per base pair, 2 nm diameter.'
  },
  {
    id: 'z',
    label: 'Z-DNA',
    short: 'Z',
    color: '#a78bfa',
    description: 'Left-handed, zigzag backbone. Forms at GC-rich tracts under torsional stress (e.g., behind RNA polymerase). Recognized by ZBP1 and ADAR1 — roles in innate immunity and RNA editing.'
  },
  {
    id: 'g4',
    label: 'G-quadruplex',
    short: 'G4',
    color: '#fbbf24',
    description: 'Four-stranded structure of stacked G-tetrads. Forms at G-rich sequences — telomeres, MYC/KRAS promoters, 5′ UTRs. Small molecules that stabilize G4s are being developed as cancer therapies.'
  },
  {
    id: 'r-loop',
    label: 'R-loop',
    short: 'R-loop',
    color: '#fb923c',
    description: 'Three-stranded: nascent RNA hybridizes with DNA template, displacing the non-template strand as ssDNA. Forms behind elongating Pol II. Unresolved R-loops cause replication stress and DNA damage.'
  }
];

// Histone-tail modifications (the "histone code"). Users can toggle these
// onto all nucleosomes on the Nucleosome level to see what each mark looks
// like and where it's typically found in the genome.
export const HISTONE_MARKS = [
  {
    id: 'none',
    label: 'None',
    short: '—',
    color: '#6b7280',
    emissive: '#9ca3af',
    description: 'No marks shown — the nucleosome in its "naïve" form. In reality, histone tails are almost always carrying a mix of modifications.'
  },
  {
    id: 'h3k4me3',
    label: 'H3K4me3',
    short: 'K4me3',
    color: '#60a5fa',
    emissive: '#2563eb',
    description: 'Trimethylation of histone H3 at lysine 4 — a hallmark of active gene promoters. Recognized by TAF3 and CHD1; recruits transcription machinery. At HBB in adult erythroid cells, the ~2 kb around the promoter is heavily H3K4me3-marked.'
  },
  {
    id: 'h3k27ac',
    label: 'H3K27ac',
    short: 'K27ac',
    color: '#34d399',
    emissive: '#059669',
    description: 'Acetylation of H3 at lysine 27 — marks active enhancers and promoters. Added by p300/CBP, read by BRD4. The β-globin LCR carries heavy H3K27ac, which is why it can drive HBB so strongly.'
  },
  {
    id: 'h3k27me3',
    label: 'H3K27me3',
    short: 'K27me3',
    color: '#f87171',
    emissive: '#dc2626',
    description: 'Trimethylation of H3K27 — deposited by Polycomb Repressive Complex 2 (PRC2). Silences developmentally regulated genes (e.g., Hox clusters, HBG1/HBG2 in adult erythroid cells). Reversible — unlike H3K9me3.'
  },
  {
    id: 'h3k9me3',
    label: 'H3K9me3',
    short: 'K9me3',
    color: '#a78bfa',
    emissive: '#7c3aed',
    description: 'Trimethylation of H3K9 — the mark of constitutive heterochromatin. Deposited by SUV39H1/2 and SETDB1, recognized by HP1 which then spreads the mark. Silences transposable elements, pericentromeric DNA, and lamina-associated domains.'
  },
  {
    id: 'h3k36me3',
    label: 'H3K36me3',
    short: 'K36me3',
    color: '#fbbf24',
    emissive: '#d97706',
    description: 'Trimethylation of H3K36 — laid down along the body of actively transcribed genes by SETD2, which rides with elongating Pol II. Suppresses spurious transcription initiation within genes and influences co-transcriptional splicing.'
  }
];

// Real DNA sequence from HBB promoter region, hg38 chr11:5248000-5248050 approximate
// From GenBank, human HBB reference sequence
export const DNA_SEQUENCE = "ACATTTGCTTCTGACACAACTGTGTTCACTAGCAACCTCAAACAGACACC";

// Complement for rendering the opposite strand
export const COMPLEMENT = {
  A: "T", T: "A", G: "C", C: "G"
};

// ---- Nucleus scene data ----
// A handful of "chromosome territories" to suggest the 46-chromosome crowd.
// chr11 is highlighted as our protagonist.
export const CHROMOSOME_TERRITORIES = [
  { id: 'chr1',  position: [ 1.6,  1.2,  0.4], radius: 0.9, color: '#7aa2ff' },
  { id: 'chr2',  position: [-1.8,  0.9, -0.2], radius: 0.85, color: '#a78bfa' },
  { id: 'chr3',  position: [ 0.3, -1.6,  0.8], radius: 0.8, color: '#4ecdc4' },
  { id: 'chr4',  position: [-1.2, -1.3, -0.5], radius: 0.7, color: '#f472b6' },
  { id: 'chr7',  position: [ 1.9, -0.8, -0.3], radius: 0.65, color: '#fb923c' },
  { id: 'chr8',  position: [-0.6,  1.8,  0.3], radius: 0.6, color: '#60a5fa' },
  { id: 'chr11', position: [ 0.2,  0.1,  0.0], radius: 0.55, color: '#ffd93d', highlight: true },
  { id: 'chr14', position: [-1.9, -0.2,  0.6], radius: 0.55, color: '#e879a6' },
  { id: 'chr17', position: [ 1.1, -1.5, -0.8], radius: 0.5, color: '#8b5cf6' },
  { id: 'chrX',  position: [ 0.8,  1.4, -1.0], radius: 0.75, color: '#6b9eff' },
  { id: 'chrY',  position: [-0.4, -0.4,  1.4], radius: 0.4, color: '#9ca3af' }
];

// Lamina-associated domain markers — bright rings near the nuclear envelope
export const LAD_POSITIONS = [
  { position: [ 2.8, -0.6,  0.5] },
  { position: [-2.5,  1.1, -0.8] },
  { position: [ 0.3, -2.7, -0.6] }
];

// ---- Compartment scene data ----
// Simplified A/B pattern along a schematic chr11. Each segment is either A
// (active, lighter) or B (inactive, darker). Our HBB region lives in segment 6.
export const COMPARTMENT_SEGMENTS = [
  { type: 'B', length: 1 },
  { type: 'A', length: 1.2 },
  { type: 'B', length: 0.8 },
  { type: 'A', length: 1.4 },
  { type: 'B', length: 1 },
  { type: 'A', length: 1.1, highlightHbb: true }, // where β-globin lives
  { type: 'B', length: 0.9 },
  { type: 'A', length: 1 },
  { type: 'B', length: 1.2 },
  { type: 'A', length: 0.9 }
];

// ---- TAD scene data ----
// Three adjacent TADs; the middle one contains our HBB loop.
export const TAD_LAYOUT = [
  { id: 'tad-left',  center: [-3.2, 0, 0], loops: 4, highlight: false },
  { id: 'tad-hbb',   center: [ 0,   0, 0], loops: 5, highlight: true },
  { id: 'tad-right', center: [ 3.2, 0, 0], loops: 3, highlight: false }
];

// ---- 30-nm fiber parameters ----
// Classical one-start solenoid: ~6 nucleosomes per turn, helical rise ~11 nm.
export const FIBER_PARAMS = {
  nucleosomesPerTurn: 6,
  turns: 4,
  radius: 1.6,
  rise: 0.8, // per turn, in scene units
  nucleosomeRadius: 0.38
};

// ---- Atomic scene: schematic G-C base pair ----
// Positions are approximate for visual clarity, not PDB-accurate.
// Atom types: C, N, O, P, H. Colors follow CPK convention.
export const ATOM_COLORS = {
  C: '#d1d5db',  // light grey (carbon)
  N: '#6b9eff',  // blue (nitrogen)
  O: '#ff6b6b',  // red (oxygen)
  P: '#fb923c',  // orange (phosphorus)
  H: '#ffffff'   // white (hydrogen)
};

// Schematic G-C base pair atoms. The guanine is on the left, cytosine on the right.
// Coordinates are in scene units, arranged in a flat plane for clarity.
const GUANINE_ATOMS = [
  { el: 'N', pos: [-1.3,  0.5, 0] },
  { el: 'C', pos: [-1.9,  0.3, 0] },
  { el: 'N', pos: [-2.3, -0.4, 0] },
  { el: 'C', pos: [-2.0, -1.1, 0] },
  { el: 'C', pos: [-1.3, -1.1, 0] },
  { el: 'C', pos: [-0.9, -0.4, 0] },
  { el: 'N', pos: [-0.9,  1.1, 0] },
  { el: 'C', pos: [-1.6,  1.3, 0] },
  { el: 'N', pos: [-2.0,  0.9, 0] },
  { el: 'O', pos: [-2.4, -1.7, 0] },
  { el: 'N', pos: [-1.0, -1.7, 0] }
];
const CYTOSINE_ATOMS = [
  { el: 'N', pos: [ 0.2,  0.2, 0] },
  { el: 'C', pos: [ 0.9,  0.4, 0] },
  { el: 'C', pos: [ 1.5,  0.0, 0] },
  { el: 'C', pos: [ 1.5, -0.8, 0] },
  { el: 'N', pos: [ 0.8, -1.0, 0] },
  { el: 'C', pos: [ 0.2, -0.6, 0] },
  { el: 'O', pos: [-0.4, -0.9, 0] },
  { el: 'N', pos: [ 2.2,  0.3, 0] }
];
// Hydrogen bonds between the two bases (each entry = guanine-atom-idx to cytosine-atom-idx)
const GC_HBONDS = [
  [0, 0], // N (G) ··· N (C) — minor groove bond
  [9, 6], // O (G) ··· N (C) — carbonyl to amine
  [10, 7] // N (G) ··· O (C) — amine to carbonyl
];
// Schematic sugar and phosphate beads for context
const SUGAR_PHOSPHATES = [
  { el: 'sugar', pos: [-2.8,  1.6, 0] },   // guanine sugar (5′ side)
  { el: 'phosphate', pos: [-3.5,  2.3, 0] },
  { el: 'sugar', pos: [ 2.8, -1.6, 0] },   // cytosine sugar (5′ side of other strand)
  { el: 'phosphate', pos: [ 3.5, -2.3, 0] }
];

export const ATOMIC_SCENE = {
  guanine: GUANINE_ATOMS,
  cytosine: CYTOSINE_ATOMS,
  hbonds: GC_HBONDS,
  scaffolds: SUGAR_PHOSPHATES,
  // Ghost of the next base pair above/below to illustrate stacking
  stackGhost: [
    { offset: [0, 0,  1.0], opacity: 0.25 },
    { offset: [0, 0, -1.0], opacity: 0.25 }
  ]
};

// Click-to-learn content for every interactive element in the scenes.
// Keys are stable ids used throughout the scene components.
export const INFO = {
  // ---- Nucleus level ----
  nucleus: {
    title: "Cell nucleus",
    subtitle: "~10 µm diameter",
    body: "A membrane-bound organelle containing the genome. The nuclear envelope — a double membrane studded with nuclear pore complexes — regulates all traffic in and out. Inside, chromosomes are organized into territories, compartments, and phase-separated bodies like the nucleolus."
  },
  "nuclear-envelope": {
    title: "Nuclear envelope & lamina",
    subtitle: "Double membrane + lamin meshwork",
    body: "Two phospholipid bilayers perforated by ~2,000 nuclear pore complexes. The inner face is lined by the nuclear lamina — a meshwork of lamin A/B intermediate filaments. The lamina serves as a tether for inactive heterochromatin (LADs)."
  },
  nucleolus: {
    title: "Nucleolus",
    subtitle: "Ribosome factory · phase-separated",
    body: "The largest nuclear body, formed around clusters of ribosomal RNA genes on five different chromosomes. A phase-separated (liquid-liquid) condensate where rRNA is transcribed, processed and assembled with ribosomal proteins into ribosomal subunits."
  },
  "chromosome-territory": {
    title: "Chromosome territory",
    subtitle: "Each chromosome occupies its own subvolume",
    body: "Chromosomes do not tangle randomly — each one settles into a distinct spatial territory within the nucleus. Gene-rich chromosomes (like 19) tend to cluster near the center; gene-poor ones (like 18, Y) tend to sit near the lamina. Territories partly overlap at their edges, where inter-chromosomal contacts happen."
  },
  chr11: {
    title: "Chromosome 11",
    subtitle: "135 Mb · our chromosome of interest",
    body: "Contains the β-globin gene cluster at chr11p15, along with many other important genes (insulin, tyrosine hydroxylase, WT1). Medium-sized, metacentric, and gene-rich for its size — so it tends to sit toward the nuclear interior."
  },
  lad: {
    title: "Lamina-Associated Domain (LAD)",
    subtitle: "~0.1–10 Mb regions tethered to the lamina",
    body: "Large chromatin regions (~1,300 in a human cell) that physically contact the nuclear lamina. LADs are gene-poor, replicate late, and are enriched for H3K9me2/3 heterochromatin. Their boundaries often coincide with CTCF sites."
  },

  // ---- Mitosis-specific elements ----
  "mitotic-chromosome": {
    title: "Mitotic chromosome",
    subtitle: "Condensed · X-shaped · ~1–10 µm long",
    body: "A fully condensed chromosome at metaphase, compacted about 10,000-fold compared to interphase. Two sister chromatids (identical copies made in S phase) are joined at the centromere. The iconic X-shape is produced by condensin-driven ~80 kb loops arranged helically around a central scaffold — a totally different architecture from interphase loops and TADs, which have dissolved."
  },
  chromatid: {
    title: "Sister chromatid",
    subtitle: "One complete copy of a chromosome",
    body: "One of the two identical DNA molecules produced during S phase. At metaphase, sister chromatids are held together by cohesin at the centromere. At anaphase, separase cleaves cohesin and spindle microtubules pull the sisters to opposite poles — each daughter cell ends up with exactly one copy."
  },
  centromere: {
    title: "Centromere",
    subtitle: "Kinetochore attachment site · primary constriction",
    body: "The chromosome region where sister chromatids are held together and where the kinetochore — a huge protein complex that microtubules attach to — assembles. Centromeres are epigenetically defined by the histone variant CENP-A, not by a specific DNA sequence."
  },
  spindle: {
    title: "Mitotic spindle",
    subtitle: "Microtubule apparatus · built in ~15 min",
    body: "A bipolar array of microtubules nucleated from two centrosomes at opposite poles of the cell. Kinetochore microtubules attach to chromosomes and generate the forces that align them at metaphase and pull sisters apart at anaphase. Chemotherapy drugs like paclitaxel and vinblastine target the spindle."
  },
  condensin: {
    title: "Condensin",
    subtitle: "SMC2/SMC4 complex · builds mitotic chromosomes",
    body: "A ring-shaped ATPase related to cohesin (also SMC family). Condensin II acts first to establish ~80 kb loops; condensin I arrays those loops helically around a central scaffold. The result is the compact rod-like mitotic chromosome. Without condensin, chromosomes fail to segregate and the cell dies."
  },

  // ---- Loop dynamics: extrusion + transcription ----
  "pol-ii": {
    title: "RNA Polymerase II",
    subtitle: "~12-subunit enzyme · ~40 nt/s",
    body: "The enzyme that transcribes protein-coding genes into messenger RNA. Pol II loads at the promoter (assisted by general transcription factors), transcribes through the gene body at ~40 nucleotides per second, and releases the nascent mRNA at the end. LCR-driven contacts load many Pol II molecules onto HBB — one of the most highly transcribed genes in red blood cell precursors."
  },
  mrna: {
    title: "Nascent mRNA",
    subtitle: "Co-transcriptional splicing + processing",
    body: "The RNA copy of a gene being made by Pol II. As Pol II travels through introns and exons, the spliceosome removes introns and joins exons into a mature mRNA. HBB mRNA gets a 5′ cap and 3′ poly-A tail, then is exported to the cytoplasm and translated into β-globin."
  },
  "extrusion-loop": {
    title: "Loop extrusion",
    subtitle: "Active process · cohesin-driven",
    body: "Cohesin captures a small piece of DNA and progressively reels it through its ring, creating a growing loop. Each cohesin complex extrudes at ~1 kb/s. The process stops when cohesin encounters two CTCF sites in convergent orientation — those become the stable loop anchors. Without this extrusion process, enhancers and promoters could not reliably find each other across megabases."
  },

  // ---- Replication fork + alt DNA forms (helix level) ----
  "replication-fork": {
    title: "Replication fork",
    subtitle: "The branch point where DNA is being copied",
    body: "At a replication fork, the double helix is unwound by helicase and each parental strand serves as template for a new daughter strand. The fork moves at ~50 bp/s in human cells. Thousands of forks operate simultaneously from ~50,000 origins, copying the entire ~6 Gb diploid genome in about 8 hours."
  },
  replisome: {
    title: "Replisome",
    subtitle: "Large protein complex at the fork",
    body: "The machine that does DNA replication. Contains CMG helicase (that unwinds the helix), DNA polymerases ε and δ (that synthesize the new strands), the sliding clamp PCNA, primase, and ssDNA-binding protein RPA. ~20 subunits total, moves processively along the DNA."
  },
  helicase: {
    title: "CMG helicase",
    subtitle: "Unwinds the duplex at ~50 bp/s",
    body: "A ring-shaped ATPase (CDC45–MCM2-7–GINS = CMG) that encircles the leading-strand template and uses ATP to translocate along it, splitting the two strands apart. Loads onto DNA during G1 phase as an inactive double hexamer; activated at S-phase entry by kinases CDK and DDK."
  },
  "leading-strand": {
    title: "Leading strand",
    subtitle: "Continuous synthesis · 5′→3′ toward the fork",
    body: "The daughter strand that is synthesized continuously in the same direction the fork is moving. DNA polymerase ε adds nucleotides without interruption as the helicase opens the duplex. One long mRNA-like molecule is produced behind the fork."
  },
  "lagging-strand": {
    title: "Lagging strand",
    subtitle: "Discontinuous · Okazaki fragments",
    body: "Because DNA polymerase can only synthesize 5′→3′ but the two template strands run in opposite directions, one daughter has to be made backward — in short ~100–200 bp pieces called Okazaki fragments. These are later joined by DNA ligase. Polymerase δ handles most lagging-strand synthesis."
  },
  okazaki: {
    title: "Okazaki fragment",
    subtitle: "~100–200 bp of new lagging-strand DNA",
    body: "A short piece of newly synthesized lagging-strand DNA. Each fragment starts with a short RNA primer laid down by primase, gets extended by polymerase δ, then the primer is removed and the fragment is joined to its neighbor by DNA ligase I. About 20 million Okazaki fragments are made per S phase in a human cell."
  },

  "alt-z": {
    title: "Z-DNA",
    subtitle: "Left-handed double helix · zigzag backbone",
    body: "An alternative form of DNA that's left-handed (opposite of B-DNA) and has a zigzag sugar-phosphate backbone. Forms transiently at GC-rich tracts under torsional stress (e.g., behind an elongating RNA polymerase). Z-DNA binding proteins (ZBP1, ADAR1) recognize this shape and have roles in immunity and RNA editing."
  },
  "alt-g4": {
    title: "G-quadruplex",
    subtitle: "Four-stranded · stacks of G-tetrads",
    body: "A four-stranded structure that forms at runs of G-rich sequences. Four guanines in a single plane hydrogen-bond into a square 'G-tetrad'; multiple tetrads stack to form the quadruplex. Common at telomeres (TTAGGG repeats), gene promoters (MYC, KRAS), and 5′ UTRs where they regulate translation. Targeted by small molecules in cancer therapy."
  },
  "alt-r-loop": {
    title: "R-loop",
    subtitle: "Three-stranded · RNA:DNA hybrid + displaced ssDNA",
    body: "A three-stranded nucleic acid structure where a nascent RNA hybridizes back to its DNA template, displacing the non-template DNA strand as single-stranded DNA. Forms behind transcribing RNA polymerase, especially at GC-rich or G-quadruplex-prone regions. Regulates some genes and class-switch recombination in B cells; unresolved R-loops cause genome instability."
  },

  // ---- Compartment level ----
  "compartment-a": {
    title: "A compartment (active)",
    subtitle: "Euchromatin · gene-dense · early-replicating",
    body: "Open, transcriptionally active chromatin. Enriched for H3K27ac, H3K4me3, and accessible to transcription factors. A regions preferentially contact other A regions in 3D — one of the clearest patterns in Hi-C maps."
  },
  "compartment-b": {
    title: "B compartment (inactive)",
    subtitle: "Heterochromatin · gene-poor · late-replicating",
    body: "Closed, silent chromatin marked by H3K9me3 or H3K27me3. B regions preferentially contact other B regions, often at the nuclear periphery or the nucleolus. Compartment identity is cell-type-specific — a region can switch A↔B when a cell differentiates."
  },

  // ---- TAD level ----
  tad: {
    title: "Topologically Associating Domain",
    subtitle: "~1 Mb · ~1 µm · self-interacting",
    body: "A region of the genome that folds into a self-contacting neighborhood. Enhancers and promoters inside a TAD are much more likely to contact each other than anything outside. TAD boundaries are usually marked by convergent CTCF sites and housekeeping genes. Disrupting a boundary can re-wire enhancer–gene contacts and cause disease."
  },
  "tad-boundary": {
    title: "TAD boundary",
    subtitle: "Convergent CTCF site pair",
    body: "The insulating edge between two TADs. Cohesin loop-extrusion stalls here, so contacts don't cross. Deleting a TAD boundary in the limb-bud causes ectopic enhancer hijacking and polydactyly — a textbook example of 3D-genome-driven disease."
  },
  "sub-tad": {
    title: "Sub-TAD",
    subtitle: "Nested contact domain (~100–500 kb)",
    body: "Finer-scale self-interacting blocks nested inside larger TADs. Often contain specific enhancer–promoter loops. At higher Hi-C resolution, what looked like one TAD resolves into several nested sub-TADs."
  },

  // ---- Loop level (already defined below, kept minimal) ----
  loop: {
    title: "Chromatin loop",
    subtitle: "~100 kb · ~500 nm",
    body: "A large DNA loop held together at its base by a cohesin ring. Loops bring distant regulatory regions into 3D contact with their target genes, letting enhancers activate transcription across tens of thousands of base pairs."
  },
  ctcf: {
    title: "CTCF binding site",
    subtitle: "~19 bp recognition motif",
    body: "CCCTC-binding factor (CTCF) is an 11-zinc-finger protein that binds specific DNA sequences and anchors chromatin loops. Stable loop anchors require two CTCF sites in convergent (opposing) orientations — then cohesin stalls between them and the loop is held in place."
  },
  cohesin: {
    title: "Cohesin complex",
    subtitle: "SMC1 · SMC3 · RAD21 · STAG1/2",
    body: "A ring-shaped ATPase complex that extrudes DNA through its own ring, expanding a chromatin loop until it encounters two convergent CTCF sites. Cohesin also holds sister chromatids together after DNA replication."
  },
  lcr: {
    title: "Locus Control Region (LCR)",
    subtitle: "~20 kb · upstream of HBB",
    body: "A cluster of strong enhancers defined by DNase I hypersensitive sites HS1–HS5. Binds erythroid transcription factors (GATA1, KLF1, NF-E2) and drives high-level expression of whichever globin gene is appropriate for the developmental stage (HBE1 → HBG → HBB)."
  },
  hbb: {
    title: "HBB — β-globin",
    subtitle: "Adult · ~1.6 kb · 3 exons · active in this cell",
    body: "Encodes the β subunit of adult hemoglobin (HbA = 2α + 2β + 4 heme). A single A→T mutation in codon 6 (Glu→Val) causes sickle-cell disease; truncating and splicing mutations cause β-thalassemia. In adult erythroid cells the LCR loops into contact with HBB to drive its expression."
  },
  hbd: {
    title: "HBD — δ-globin",
    subtitle: "Adult minor · ~2% of adult hemoglobin",
    body: "Encodes the δ subunit of HbA2, a minor adult hemoglobin (2α + 2δ). Expressed at low levels alongside HBB because its promoter lacks a key CACCC element. Elevated HbA2 (>3.5%) is a diagnostic marker for β-thalassemia trait."
  },
  hbg1: {
    title: "HBG1 — Aγ-globin (fetal)",
    subtitle: "Fetal · silenced in adult erythroid cells",
    body: "One of two fetal γ-globin genes. HBG1 (Aγ) differs from HBG2 (Gγ) by a single amino acid at position 136 (alanine vs glycine). Fetal hemoglobin (HbF = 2α + 2γ) is the dominant oxygen carrier from ~6 weeks gestation until birth. Reactivating HBG1/HBG2 in adults is a leading therapeutic strategy for sickle-cell disease."
  },
  hbg2: {
    title: "HBG2 — Gγ-globin (fetal)",
    subtitle: "Fetal · silenced in adult erythroid cells",
    body: "The second fetal γ-globin gene, duplicated from HBG1 ~50 million years ago in the primate lineage. Carries glycine at position 136 (HBG1 has alanine). Co-expressed with HBG1 during fetal life; both are shut off at birth as the γ→β switch occurs."
  },
  hbe1: {
    title: "HBE1 — ε-globin (embryonic)",
    subtitle: "Embryonic · silenced after ~6 weeks gestation",
    body: "The earliest-expressed globin gene. ε combines with ζ and α chains to form Hb Gower-1, Hb Gower-2 and Hb Portland in primitive yolk-sac erythroblasts. Permanently silenced at the embryonic-to-fetal switch (~6 weeks gestation) by the transcription factors BCL11A and ZBTB7A."
  },
  // ---- 30-nm fiber level (disputed) ----
  "fiber-30nm": {
    title: "30-nm chromatin fiber",
    subtitle: "Disputed · classical textbook model",
    body: "A regular solenoid formed by nucleosomes coiling 6-per-turn into a ~30-nm-thick fiber. Reproducible in vitro with purified nucleosomes and crowding agents. BUT — in living cells, super-resolution microscopy (ChromEMT, 2017) and cryo-EM tomography show chromatin is a disordered, flexible array without a regular 30-nm solenoid. Consider it a useful teaching caricature, not a structure cells actually build."
  },
  "histone-h1": {
    title: "Histone H1 (linker histone)",
    subtitle: "Sits at nucleosome entry/exit",
    body: "The fifth histone family. H1 binds where DNA enters and exits a nucleosome, clamping the 'bead' and helping pull adjacent nucleosomes together. Absolutely required for higher-order folding in vitro. Nucleosome + H1 + ~20 bp of extra DNA is called a chromatosome (166 bp)."
  },
  chromatosome: {
    title: "Chromatosome",
    subtitle: "Nucleosome + H1 + ~20 bp (~166 bp)",
    body: "A nucleosome particle that includes the linker histone H1. H1 makes contacts at the DNA entry/exit sites, bringing the two linker DNAs close together and creating a more compact, stable particle that is the real building block of condensed chromatin."
  },

  nucleosome: {
    title: "Nucleosome",
    subtitle: "147 bp · 1.65 turns · ~11 nm disc",
    body: "The fundamental unit of chromatin. ~147 base pairs of DNA wrap around a histone octamer — two each of H2A, H2B, H3, H4. Compacts DNA roughly 7-fold and regulates which underlying sequences are accessible to transcription factors."
  },
  "histone-tail": {
    title: "Histone tail",
    subtitle: "Unstructured N-terminal extension · substrate for the 'histone code'",
    body: "Each of the 8 core histones has a short unstructured tail that sticks out past the DNA. These tails are substrates for dozens of modifications — methylation, acetylation, phosphorylation, ubiquitination — laid down by writer enzymes and read by effector proteins. The combinatorial pattern of marks is called the 'histone code' and is one of the main layers of epigenetic regulation."
  },
  h3k4me3: {
    title: "H3K4me3",
    subtitle: "Trimethylated H3 lysine 4 · active promoter mark",
    body: "Written by MLL/SET1 complexes, read by TAF3, CHD1 and INHAT. H3K4me3 is tightly localized to the ~2 kb around active and poised promoters. It doesn't cause transcription directly but recruits the TFIID general transcription factor and nucleosome-remodeling complexes. The HBB promoter carries strong H3K4me3 in adult erythroid cells."
  },
  h3k27ac: {
    title: "H3K27ac",
    subtitle: "Acetylated H3 lysine 27 · active enhancer mark",
    body: "Written by p300/CBP histone acetyltransferases, read by BRD4 bromodomains. The single most reliable marker of active enhancers and super-enhancers in ChIP-seq. The β-globin LCR carries a massive H3K27ac signal in adult erythroid cells, which is how the LCR gets identified as an enhancer in the first place."
  },
  h3k27me3: {
    title: "H3K27me3",
    subtitle: "Trimethylated H3 lysine 27 · Polycomb silencing",
    body: "Deposited by Polycomb Repressive Complex 2 (PRC2), whose catalytic subunit is EZH2. Silences developmentally regulated genes — including the γ-globin genes HBG1/HBG2 in adult erythroid cells. PRC2 dysregulation is implicated in many cancers; tazemetostat (an EZH2 inhibitor) was FDA-approved in 2020."
  },
  h3k9me3: {
    title: "H3K9me3",
    subtitle: "Trimethylated H3 lysine 9 · constitutive heterochromatin",
    body: "Written by SUV39H1/2 and SETDB1, recognized by HP1 (heterochromatin protein 1). HP1 binds H3K9me3, recruits more SUV39H, and the mark spreads — creating self-propagating silenced domains. Marks pericentromeric regions, transposable elements, and lamina-associated domains (LADs)."
  },
  h3k36me3: {
    title: "H3K36me3",
    subtitle: "Trimethylated H3 lysine 36 · gene body mark",
    body: "Deposited by SETD2 along the body of actively transcribed genes as RNA Pol II elongates. Suppresses spurious intragenic transcription initiation and influences alternative splicing by recruiting splicing factors. Loss of SETD2 is a driver mutation in clear-cell renal carcinoma."
  },

  histone: {
    title: "Histone octamer",
    subtitle: "(H2A · H2B · H3 · H4) × 2",
    body: "Eight core histones form a protein disc at the heart of every nucleosome. Unstructured histone tails protrude from the core and carry post-translational modifications (acetylation, methylation, phosphorylation) that make up the 'histone code' regulating gene activity."
  },
  "wrap-dna": {
    title: "Wrapped DNA",
    subtitle: "147 bp in 1.65 left-handed turns",
    body: "DNA in direct contact with the histone octamer. Makes 14 contact points wherever the minor groove faces the protein core. The path of wrapping determines which sequences are accessible and which are buried — a major layer of gene regulation."
  },
  "linker-dna": {
    title: "Linker DNA",
    subtitle: "~20–80 bp between nucleosomes",
    body: "The stretch of DNA between neighboring nucleosomes. Its length varies by cell type and along the genome. Histone H1 binds at the nucleosome entry/exit and the adjacent linker, clamping the 'bead' and promoting higher-order chromatin folding."
  },
  helix: {
    title: "DNA double helix",
    subtitle: "B-form · 2 nm diameter · 3.4 Å/bp",
    body: "Two antiparallel polynucleotide strands wound around a common axis, held by base pairing and base stacking. B-form DNA is right-handed with ~10.5 bp per turn and has distinct major and minor grooves that proteins read to find their binding sites."
  },
  backbone: {
    title: "Sugar-phosphate backbone",
    subtitle: "5′ → 3′ antiparallel strands",
    body: "Alternating deoxyribose and phosphate groups linked by phosphodiester bonds. The two strands run in opposite 5′→3′ directions. Proteins often grip the backbone for affinity while reading sequence-specific contacts in the grooves."
  },
  basepair: {
    title: "Base pair",
    subtitle: "A–T (2 H-bonds) · G–C (3 H-bonds)",
    body: "Two complementary bases held together by hydrogen bonds. G–C pairs are more stable than A–T, so GC-rich regions of the genome melt at higher temperatures. Complementary base pairing is the basis of DNA replication, transcription, and sequencing."
  },
  "base-A": {
    title: "Adenine (A)",
    subtitle: "Purine · double-ring",
    body: "Pairs with thymine via two hydrogen bonds. Purines (A, G) are larger than pyrimidines (C, T) — purine–pyrimidine pairing keeps the double helix a uniform width."
  },
  "base-T": {
    title: "Thymine (T)",
    subtitle: "Pyrimidine · single-ring",
    body: "Pairs with adenine via two hydrogen bonds. In RNA, thymine is replaced by uracil (U)."
  },
  "base-G": {
    title: "Guanine (G)",
    subtitle: "Purine · double-ring",
    body: "Pairs with cytosine via three hydrogen bonds — the strongest of the canonical base pairs. CpG dinucleotides are hotspots for methylation and mutation."
  },
  "base-C": {
    title: "Cytosine (C)",
    subtitle: "Pyrimidine · single-ring",
    body: "Pairs with guanine via three hydrogen bonds. Cytosine methylation at CpG sites is a key epigenetic mark that usually correlates with gene silencing."
  },

  // ---- Atomic level ----
  atom: {
    title: "Atom",
    subtitle: "CPK coloring · C grey, N blue, O red, P orange, H white",
    body: "At this scale we're looking at individual atoms. Nucleic acid bases are aromatic heterocycles — flat rings of alternating carbon and nitrogen. The planarity of the rings is what allows base stacking."
  },
  "purine-ring": {
    title: "Purine ring",
    subtitle: "Adenine & Guanine · two fused rings (9 atoms)",
    body: "A 9-membered bicyclic heterocycle: a 6-membered ring fused to a 5-membered ring. Adenine and guanine are purines. The conserved ring system means purines always face into the helix the same way."
  },
  "pyrimidine-ring": {
    title: "Pyrimidine ring",
    subtitle: "Cytosine, Thymine, Uracil · single 6-membered ring",
    body: "A single 6-membered aromatic ring with two nitrogens. Pyrimidines are smaller than purines — a purine always pairs with a pyrimidine so that the helix stays a uniform ~2 nm width."
  },
  "hydrogen-bond": {
    title: "Hydrogen bond",
    subtitle: "~2–3 Å · the ladder rungs",
    body: "A weak directional attraction between a hydrogen attached to an electronegative atom (N–H, O–H) and another electronegative atom nearby. Two H-bonds hold an A–T pair, three hold a G–C pair. Weak individually, but millions along a chromosome add up to significant stability."
  },
  "base-stacking": {
    title: "Base stacking",
    subtitle: "π–π interactions between adjacent bases",
    body: "Adjacent base pairs stack on top of each other like a pile of coins, ~3.4 Å apart. Stacking (van der Waals + π–π) contributes more to double-helix stability than the hydrogen bonds between strands. It's also why DNA absorbs UV light at 260 nm — and why melting disrupts absorbance."
  },
  "deoxyribose": {
    title: "Deoxyribose sugar",
    subtitle: "5-carbon sugar (C1′–C5′)",
    body: "The 'D' in DNA. A 5-carbon sugar whose 2′ position carries a hydrogen instead of a hydroxyl (unlike RNA's ribose). The base attaches at C1′ and phosphates link at C3′ and C5′, giving DNA its 5′→3′ direction."
  },
  phosphate: {
    title: "Phosphate group",
    subtitle: "PO₄ · negatively charged at physiological pH",
    body: "Links adjacent sugars through phosphodiester bonds and carries the negative charge that makes DNA acidic. DNA-binding proteins often use basic residues (arginine, lysine) to grip the phosphate backbone non-specifically."
  }
};

// How scientists actually see each level. `match` tells the user how honest
// the 3D rendering is versus what's imaged in real experiments.
//   "strong"    — direct microscopy matches the 3D rendering closely
//   "moderate"  — partially imaged, partially inferred
//   "weak"      — inferred from data (contact maps), 3D is a cartoon
//   "disputed"  — imaging evidence conflicts (e.g. 30-nm fiber)
// `sourceUrl` links to a canonical public page (Wikipedia or PDB) that
// shows the real image alongside context. Intentionally conservative —
// only Wikipedia + PDB, both extremely stable and free.
export const IMAGING = {
  nucleus: {
    technique: "Multi-color FISH · confocal microscopy",
    match: "strong",
    caption: "Chromosome painting lights each chromosome in a unique color. The result — compact colored blobs in distinct nuclear territories — maps almost 1:1 onto the 3D rendering here.",
    reference: "Cremer & Cremer 2010, Cold Spring Harb Perspect Biol",
    sourceUrl: "https://en.wikipedia.org/wiki/Chromosome_territories",
    sourceLabel: "Wikipedia · Chromosome territories"
  },
  compartment: {
    technique: "Hi-C contact map (not a microscope image)",
    match: "weak",
    caption: "Hi-C measures how often pairs of loci touch in 3D. A/B compartments show up as a large-scale checkerboard pattern — not a photograph. The 3D rendering here is a model built from contact frequencies.",
    reference: "Lieberman-Aiden et al. 2009, Science",
    sourceUrl: "https://en.wikipedia.org/wiki/Chromosome_conformation_capture",
    sourceLabel: "Wikipedia · Hi-C (3C methods)"
  },
  tad: {
    technique: "Hi-C triangle · super-resolution ORCA / Hi-M",
    match: "moderate",
    caption: "TADs appear as bright triangles in Hi-C maps. Super-resolution tracing (ORCA, Hi-M) later imaged them as physical globular domains in single cells — supporting the 3D rendering.",
    reference: "Bintu et al. 2018, Science",
    sourceUrl: "https://en.wikipedia.org/wiki/Topologically_associating_domain",
    sourceLabel: "Wikipedia · TAD"
  },
  loop: {
    technique: "Hi-C peaks · ChIA-PET · two-colour FISH",
    match: "moderate",
    caption: "A convergent-CTCF loop shows up as a bright 'dot' off the Hi-C diagonal. FISH with probes at the anchors finds the two loci in close proximity, but the clean teardrop shape is a textbook cartoon.",
    reference: "Rao et al. 2014, Cell",
    sourceUrl: "https://en.wikipedia.org/wiki/CCCTC-binding_factor",
    sourceLabel: "Wikipedia · CTCF & chromatin loops"
  },
  fiber: {
    technique: "EM in vitro · ChromEMT in cells",
    match: "disputed",
    caption: "Purified chromatin + crowding agents → regular 30-nm solenoids by EM. BUT ChromEMT imaging in actual cells (Ou 2017) shows no regular fiber — just irregular nucleosome clutches. The 3D here matches the in-vitro image, not what cells contain.",
    reference: "Ou et al. 2017, Science · Finch & Klug 1976, PNAS",
    sourceUrl: "https://en.wikipedia.org/wiki/Chromatin",
    sourceLabel: "Wikipedia · Chromatin structure"
  },
  nucleosomes: {
    technique: "Negative-stain EM · cryo-EM",
    match: "strong",
    caption: "Swollen chromatin on an EM grid shows the iconic 'beads on a string': dark nucleosome cores linked by thin DNA. The 3D rendering is directly built from these images.",
    reference: "Olins & Olins 1974, Science · Luger et al. 1997 (PDB 1AOI)",
    sourceUrl: "https://www.rcsb.org/structure/1AOI",
    sourceLabel: "PDB 1AOI · Luger 1997 crystal structure"
  },
  helix: {
    technique: "X-ray fibre diffraction · AFM · crystal structures",
    match: "moderate",
    caption: "Photo 51 (Franklin 1952) encodes the helix as an abstract X-shape — you can't 'see' the helix in it directly. AFM and crystal structures do show helical geometry matching the 3D rendering.",
    reference: "Franklin & Gosling 1953, Nature · Watson & Crick 1953, Nature",
    sourceUrl: "https://en.wikipedia.org/wiki/Photo_51",
    sourceLabel: "Wikipedia · Photo 51"
  },
  atomic: {
    technique: "X-ray crystallography · cryo-EM (sub-Å)",
    match: "strong",
    caption: "Every atom in a PDB entry is experimentally placed from diffraction or cryo-EM density. The CPK color convention used here is universal in molecular graphics.",
    reference: "RCSB Protein Data Bank · EMDB",
    sourceUrl: "https://www.rcsb.org/structure/1BNA",
    sourceLabel: "PDB 1BNA · Drew-Dickerson B-DNA"
  }
};

// Data provenance, used for the sidebar. `url` is optional — each entry
// links to its canonical public page when one exists.
export const PROVENANCE = [
  {
    key: 'locus',
    label: 'Locus',
    text: 'UCSC Genome Browser, hg38, HBB region',
    url:  'https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr11:5200000-5300000'
  },
  {
    key: 'hic',
    label: 'Hi-C',
    text: 'Rao et al. 2014, Cell, GM12878 Hi-C data (ENCODE)',
    url:  'https://en.wikipedia.org/wiki/Chromosome_conformation_capture'
  },
  {
    key: 'ctcf',
    label: 'CTCF',
    text: 'ENCODE CTCF ChIP-seq, GM12878',
    url:  'https://www.encodeproject.org/'
  },
  {
    key: 'sequence',
    label: 'Sequence',
    text: 'GenBank NG_059281.1, HBB gene region',
    url:  'https://www.ncbi.nlm.nih.gov/nuccore/NG_059281.1'
  },
  {
    key: 'nucleosome',
    label: 'Nucleosome',
    text: 'PDB 1AOI, Luger et al. 1997 (reference structure)',
    url:  'https://www.rcsb.org/structure/1AOI'
  }
];
