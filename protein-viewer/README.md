# Boltz-2 Structure Viewer

Single-file local viewer for Boltz-2 predictions from NVIDIA's BioNeMo API,
using [Mol*](https://molstar.org/) rendered from CDN.

## Usage

The viewer hard-codes `protein.txt` in this directory as its input. Drop (or
rename) any Boltz-2 JSON output to `protein.txt` and reload the page.

### Running it

Because browsers block `fetch()` on `file://` URLs, double-clicking
`index.html` will show a "Could not load protein.txt" error. Serve the
folder over HTTP instead:

```sh
cd "/Users/sheldonbarnes/Documents/Claude/Projects/Protein Viewer"
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

No build step, no npm, no backend. Mol* is loaded once from jsDelivr and
then the page works offline.

## What it shows

- **Sidebar:** filename, structure selector (appears only when the JSON has
  more than one sample), and four confidence cards: Confidence, Complex
  pLDDT, pTM, ipTM. `complex_pde_score` is intentionally omitted — easy to
  re-add in `SCORE_FIELDS`.
- **Main area:** full Mol* viewer with its standard controls. Proteins
  render as cartoon with rainbow (N→C) residue-index coloring; DNA/RNA
  chains use Mol*'s default nucleic-acid representation.

## Customizing

All the knobs are at the top of the `<script>` block in `index.html`:

- `DATA_FILE` — change the filename.
- `SCORE_FIELDS` — add/remove/reorder metric cards, tweak formatters, or
  flip the `wide` flag to control which cards span two columns.
- Mol* viewer options are in `initViewer()` (`layoutShow*`, `viewportShow*`,
  etc). See the Mol* viewer plugin docs:
  - Viewer demo & options: <https://molstar.org/viewer/>
  - Plugin API docs: <https://molstar.org/docs/>
  - Source: <https://github.com/molstar/molstar>
- Default coloring is set in `loadStructure()` via
  `representationParams.theme.globalName`. Other themes worth trying:
  `chain-id`, `plddt-confidence`, `uniform`, `sequence-id`.
- Mol* version is pinned to `4.9.0` in the `<script>`/`<link>` tags. Bump if
  you want newer features — test first, their API changes between majors.

## Input format

Expects the standard BioNeMo Boltz-2 JSON shape:

```json
{
  "outputs": [
    {
      "structures_with_scores": [
        {
          "structure": "data_structure\n...",
          "format": "cif",
          "confidence_score": 0.9,
          "complex_plddt_score": 80.0,
          "ptm_score": 0.83,
          "iptm_score": 0.84
        }
      ]
    }
  ]
}
```

Multiple `outputs` and multiple `structures_with_scores` entries are both
flattened into the structure picker.
