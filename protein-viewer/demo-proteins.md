# Boltz-2 demo inputs

Sequences pulled from RCSB PDB on 2026-04-19. Each complex has one protein
chain (A) and two DNA chains (B, C). Paste into the BioNeMo Boltz-2 form at
`build.nvidia.com/mit/boltz2` (or POST to the NIM API — JSON payload at the
bottom of each section).

**MSA note:** leave MSA blank to let BioNeMo auto-generate. If you'd rather
supply one, `a3m.mmseqs.com` returns an `.a3m` file for a query sequence
with no install.

Sampling defaults that match a typical BioNeMo UI run:
- `recycling_steps: 3`
- `sampling_steps: 50`
- `diffusion_samples: 1`
- `step_scale: 1.5`

---

## 1. Zif268 zinc finger bound to DNA

PDB 1AAY · *Mus musculus* · Classic three-finger zinc-finger DNA binder.
Visually striking — three fingers thread the major groove in sequence.

**Note:** the crystal structure has 3 Zn²⁺ ions. Boltz-2 doesn't need them
specified as ligands for the fold prediction; the ipTM will be slightly
lower than an all-atom inclusive run, but the overall geometry is fine for
a viewer demo.

### Form fields

| Chain | Type    | Copies | Sequence |
|-------|---------|--------|----------|
| A     | Protein | 1      | `MERPYACPVESCDRRFSRSDELTRHIRIHTGQKPFQCRICMRNFSRSDHLTTHIRTHTGEKPFACDICGRKFARSDERKRHTKIHLRQKD` |
| B     | DNA     | 1      | `AGCGTGGGCGT` |
| C     | DNA     | 1      | `TACGCCCACGC` |

### API JSON

```json
{
  "polymers": [
    {
      "id": "A",
      "molecule_type": "protein",
      "sequence": "MERPYACPVESCDRRFSRSDELTRHIRIHTGQKPFQCRICMRNFSRSDHLTTHIRTHTGEKPFACDICGRKFARSDERKRHTKIHLRQKD",
      "num_copies": 1
    },
    { "id": "B", "molecule_type": "dna", "sequence": "AGCGTGGGCGT", "num_copies": 1 },
    { "id": "C", "molecule_type": "dna", "sequence": "TACGCCCACGC", "num_copies": 1 }
  ],
  "recycling_steps": 3,
  "sampling_steps": 50,
  "diffusion_samples": 1,
  "step_scale": 1.5
}
```

---

## 2. λ Cro repressor bound to operator DNA

PDB 6CRO · *Enterobacteria phage λ* · Tiny helix-turn-helix dimer. Textbook
example for "this is what an HTH looks like." 59 aa per chain.

**Note:** in the crystal structure Cro is a homodimer (two copies of the
protein chain). Leaving `num_copies: 2` tells Boltz-2 to predict the dimer.

### Form fields

| Chain | Type    | Copies | Sequence |
|-------|---------|--------|----------|
| A     | Protein | 2      | `EQRITLKDYAMRFGQTKTAKDLGVYQSAINKAIHAGRKIFLTINADGSVYAEEVKPFPSN` |
| B     | DNA     | 1      | `TGTATCACCCGCGGTGATAG` |
| C     | DNA     | 1      | `ACTATCACCGCGGGTGATAC` |

### API JSON

```json
{
  "polymers": [
    {
      "id": "A",
      "molecule_type": "protein",
      "sequence": "EQRITLKDYAMRFGQTKTAKDLGVYQSAINKAIHAGRKIFLTINADGSVYAEEVKPFPSN",
      "num_copies": 2
    },
    { "id": "B", "molecule_type": "dna", "sequence": "TGTATCACCCGCGGTGATAG", "num_copies": 1 },
    { "id": "C", "molecule_type": "dna", "sequence": "ACTATCACCGCGGGTGATAC", "num_copies": 1 }
  ],
  "recycling_steps": 3,
  "sampling_steps": 50,
  "diffusion_samples": 1,
  "step_scale": 1.5
}
```

---

## 3. TATA-binding protein (TBP) bound to the TATA box

PDB 1CDW · *Homo sapiens* · Saddle-shaped TBP bends its DNA by ~80° — the
most visually dramatic of the three. 180 aa protein (C-terminal core
domain), 16-bp DNA with the TATAAAA consensus.

### Form fields

| Chain | Type    | Copies | Sequence |
|-------|---------|--------|----------|
| A     | Protein | 1      | `SGIVPQLQNIVSTVNLGCKLDLKTIALRARNAEYNPKRFAAVIMRIREPRTTALIFSSGKMVCTGAKSEENSRLAARKYARVVQKLGFPAKFLDFKIQNMVGSCDVKFPIRLEGLVLTHQQFSSYEPELFPGLIYRMIKPRIVLLIFVSGKVVLTGAKVRAEIYEAFENIYPILKGFRK` |
| B     | DNA     | 1      | `CAGCCTTTTATAGCAG` |
| C     | DNA     | 1      | `CTGCTATAAAAGGCTG` |

### API JSON

```json
{
  "polymers": [
    {
      "id": "A",
      "molecule_type": "protein",
      "sequence": "SGIVPQLQNIVSTVNLGCKLDLKTIALRARNAEYNPKRFAAVIMRIREPRTTALIFSSGKMVCTGAKSEENSRLAARKYARVVQKLGFPAKFLDFKIQNMVGSCDVKFPIRLEGLVLTHQQFSSYEPELFPGLIYRMIKPRIVLLIFVSGKVVLTGAKVRAEIYEAFENIYPILKGFRK",
      "num_copies": 1
    },
    { "id": "B", "molecule_type": "dna", "sequence": "CAGCCTTTTATAGCAG", "num_copies": 1 },
    { "id": "C", "molecule_type": "dna", "sequence": "CTGCTATAAAAGGCTG", "num_copies": 1 }
  ],
  "recycling_steps": 3,
  "sampling_steps": 50,
  "diffusion_samples": 1,
  "step_scale": 1.5
}
```

---

## After running each one

Save the returned JSON (BioNeMo gives you a download button) as
`zif268.json`, `lambda_cro.json`, `tbp.json` in this folder. Then in
`index.html`, change `DATA_FILE = 'protein.txt'` to the one you want to
view, or add a small file-picker to switch between them — the viewer's
structure-picker sidebar will auto-populate if a given file has multiple
`structures_with_scores` entries.

## Schema caveat on the API JSON

The field names above (`polymers`, `molecule_type`, `num_copies`, etc.)
match the public BioNeMo Boltz-2 NIM spec as of this writing. NVIDIA has
been iterating the schema — if a POST returns a validation error, check
`docs.nvidia.com/bionemo-nim/latest` for the current field names. The
sequences themselves don't change.
