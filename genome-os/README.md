# GenomeOS v0.1 Prototype

A one-day prototype showing smooth zoom across three scales of chromatin organization at the beta globin locus (HBB, chromosome 11).

## What this is

A proof of concept for the GenomeOS project. It demonstrates the core idea: one continuous zoomable object showing chromatin at three scales (chromatin loop, nucleosome array, DNA double helix), with real sequence data from the HBB locus and a sidebar showing provenance and biological context at each scale.

## What this is not

A finished product. Transitions are functional but not fully polished. Geometry is representative rather than exact. Data is pre-packaged rather than fetched live. This is a defensible first demo to show an instructor or advisor, not a research instrument.

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Controls

Drag the bottom slider to zoom smoothly between scales, or use the left and right arrow keys. Drag the 3D view with your mouse to rotate. The view auto-rotates slowly.

## Project structure

```
src/
  App.jsx                     Main component and layout
  main.jsx                    React entry point
  data/
    locus.js                  Beta globin locus data, scale definitions, sequence
  scenes/
    ScaleController.jsx       Orchestrates scale transitions based on zoom
    LoopScene.jsx             Chromatin loop with CTCF anchors and genes
    NucleosomeScene.jsx       Nucleosome array with histones and linker DNA
    HelixScene.jsx            DNA double helix with real HBB sequence
  components/
    Sidebar.jsx               Scale info, provenance, description panel
    ZoomControl.jsx           Slider and scale indicators
```

## Tech stack

- Vite for dev server and build
- React 18
- Three.js for 3D rendering
- react-three-fiber for declarative Three.js in React
- @react-three/drei for camera controls

## Where to iterate next

Priority 1: Polish the transitions. The current fade-between-scenes works but is not seamless. A more sophisticated approach would morph geometry rather than cross-fade.

Priority 2: Add a fourth scale above the loop (TAD or chromosome territory) to extend the range.

Priority 3: Replace representative data with live-fetched data from 4DN and ENCODE.

Priority 4: Add interactive tooltips that expose the underlying data for each protein, gene, and base pair when clicked.

Priority 5: Add a guided tour mode that auto-navigates a first-time user through the full zoom.

## Data sources

All data in this prototype is representative of publicly available sources. For the full production version, data would be fetched directly from:

- UCSC Genome Browser (locus coordinates and annotations)
- 4D Nucleome Data Portal (Hi-C derived structures)
- ENCODE (ChIP-seq for CTCF and cohesin)
- GenBank (reference sequence)
- PDB (reference nucleosome structure 1AOI)

## License

Prototype for educational and research exploration. Not yet licensed.
