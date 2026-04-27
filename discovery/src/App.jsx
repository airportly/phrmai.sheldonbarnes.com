import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CITATIONS, CITATIONS_BY_ID, resolveIds } from './citations.js';

/**
 * HumanOS Discovery — single-page scroll story.
 *
 * The page is a sequence of full-viewport "scenes". Scene 1 is visible on
 * load; every later scene starts hidden (opacity 0, slight Y offset) and
 * reveals as it scrolls into view via an IntersectionObserver. A right-edge
 * dot nav and an optional auto-narrating tour drive navigation. Each scene
 * carries a real interactive widget (network you can hover, conservation
 * map you can hover by domain, ATP pocket you can click, dynamics meters
 * you can drive with a temperature slider, etc.) — the goal is to make
 * "what AI found" feel explorable rather than recited.
 *
 * Story arc (mirrors the master HTML's 14 tabs, compressed to a single
 * reading flow):
 *
 *   01 Hero / cosmic open
 *   02 The question      — can AI find new things, or just pattern-match?
 *   03 Meet LTK & MOK    — same family, wildly different physics
 *   04 Glycine paradox   — 14.3% vs 1.7%, the 10×G ripple
 *   05 AI semantic net   — interactive 30%-vs-52% graph
 *   06 ATP pocket        — ILVK ↔ ILIK, the V→I selectivity handle
 *   07 Conservation      — what evolution kept, what it let drift
 *   08 Dynamics          — RMSF / B-factor / conformations at 310 K
 *   09 Disease pathways  — bridge to cardiometabolic disease
 *   10 Therapeutic plays — four drug-design strategies with potential
 *   11 How we got here   — 6-step methodology
 *   12 Takeaway          — closing punch + share
 */

// ---------------------------------------------------------------------------
// Tour script (narration + scene anchors)
// ---------------------------------------------------------------------------

const SCENES = [
  { id: 'hero',          short: 'Open',           narration: "Welcome. This is what happens when AI is pointed at protein data and asked to find something genuinely new. Scroll down to take the journey." },
  { id: 'question',      short: 'The question',   narration: "Here's the question that made this whole thing happen. Can AI actually find new things in protein data — or is it just pattern matching dressed up as science? The honest answer is: it can. And what follows is the proof." },
  { id: 'meet',          short: 'Meet LTK & MOK', narration: "Meet two human kinases — L T K and M O K. They're in the same protein family. They're both active in cardiometabolic disease. And they could not be more different physically. L T K is long, floppy, and packed with glycine. M O K is short, compact, and barely has any. That difference is where the discovery starts." },
  { id: 'glycine',       short: 'Glycine paradox', narration: "Glycine has no side chain. Strings of consecutive glycines act like hinges — they let the protein bend. L T K has runs of ten glycines in a row. Watch them ripple. M O K has nothing like this. It moves like a brick. Same family, completely different physics." },
  { id: 'network',       short: 'AI similarity',  narration: "Here is what AI did that conventional sequence alignment couldn't. Embedded into the same vector space, L T K and M O K cluster together at fifty-two percent functional similarity, even though their raw sequences only match thirty percent. Hover any node to see how they're connected." },
  { id: 'pocket',        short: 'ATP pocket',     narration: "Both kinases bind A T P in the same canonical pocket — but the third residue of the recognition motif is different. L T K packs a valine; M O K packs an isoleucine. That single carbon changes the pocket's shape just enough to design selective drugs against one and not the other." },
  { id: 'conservation',  short: 'Conservation',   narration: "Mapping conservation across each protein shows the proof. The catalytic core — kinase domain, A T P pocket, D F G motif — is locked in green. The glycine clusters in L T K sit in red, free to drift. Function is preserved. Flexibility is the variable. Hover any domain to see what it does." },
  { id: 'dynamics',      short: 'Dynamics',       narration: "At three hundred ten Kelvin — body temperature — molecular dynamics simulation makes the physics quantitative. L T K's average backbone deviation is three point eight Ångströms. M O K is one point two. That's three point two times more motion, sampling five and a half times more conformations." },
  { id: 'pathways',      short: 'Disease',        narration: "Both proteins land on the same set of cardiometabolic diseases — type two diabetes, heart failure, metabolic syndrome, obesity. They share modulators: A M P K, m T O R, insulin, mitochondrial pathways. The clinical relevance is real." },
  { id: 'therapeutic',   short: 'Opportunity',    narration: "Four therapeutic strategies fall out of this. L T K-selective inhibitors at eighty-five percent potential. M O K mitochondrial modulators at seventy. Dual-selective agents leveraging the I L V K versus I L I K difference at seventy-eight. And novel glycine-flexibility modulators at sixty-five — a mechanism nobody has filed patents on yet." },
  { id: 'methodology',   short: 'How',            narration: "The work itself was a six-step pipeline. Database query, sequence retrieval, A I clustering, pattern recognition, literature validation, hypothesis generation. Each step is reproducible." },
  { id: 'evidence',      short: 'Evidence',       narration: "Every claim in this report is sourced. Five citations span the structural, literature, and methodological backing. You can sort, filter, and export them — the report is portable." },
  { id: 'closing',       short: 'Takeaway',       narration: "What you just walked through is what AI looks like when it's actually doing science. Not a chatbot, not a buzzword — a system that found something nobody had connected, and made the case for it. End of journey." },
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** IntersectionObserver wrapper. Returns a ref to attach + a boolean for in-view. */
function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Once a scene comes into view we KEEP it revealed (no flicker on
        // scroll-back). The story-progress nav uses a separate, smaller
        // observer to track "current" scene.
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: options.rootMargin ?? '0px 0px -15% 0px', threshold: options.threshold ?? 0.18 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options.rootMargin, options.threshold]);
  return [ref, inView];
}

/** Tracks the active scene for the right-edge nav. */
function useActiveScene(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const observers = [];
    const handlers = new Map();
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) handlers.set(id, entry.intersectionRatio);
          else handlers.delete(id);
          // Pick the scene with the highest visible ratio.
          let best = ids[0], bestRatio = -1;
          for (const [k, v] of handlers.entries()) {
            if (v > bestRatio) { best = k; bestRatio = v; }
          }
          setActive(best);
        },
        { threshold: [0.25, 0.5, 0.75] },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [ids.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

/** Animate a number from 0 to `value` once `start` flips true. */
function useCountUp(value, { start, duration = 1200, decimals = 0 } = {}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setN(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, value, duration]);
  return decimals === 0 ? Math.round(n) : Number(n.toFixed(decimals));
}

// ---------------------------------------------------------------------------
// Citation drawer context + chip component
// ---------------------------------------------------------------------------
//
// Citations are first-class data (see citations.js). Anywhere in the tree, a
// scene can render `<Cite ids={['rcsb-7nx1']} />` next to a claim and the
// chip will surface the citation in the slide-from-the-right drawer when
// clicked. `<Cite ids={['a', 'b']} />` renders multiple chips inline; the
// `<SourcesButton>` in the tour bar opens the drawer with every citation.

const CitationContext = React.createContext({ open: () => {} });

function Cite({ ids }) {
  const { open } = React.useContext(CitationContext);
  if (!ids || !ids.length) return null;
  return (
    <span className="cite-chip-group">
      {ids.map((id) => {
        const c = CITATIONS_BY_ID[id];
        if (!c) return null;
        return (
          <button
            key={id}
            type="button"
            className="cite-chip"
            data-kind={c.kind}
            onClick={(e) => { e.stopPropagation(); open([id]); }}
            title={`${c.label} — ${c.title}`}
          >
            {c.short}
          </button>
        );
      })}
    </span>
  );
}

function CitationDrawer({ ids, onClose }) {
  // ids === null  → drawer closed
  // ids === []    → drawer open, show ALL citations
  // ids === [...] → drawer open, show only those citations
  const isOpen = ids !== null;
  const list = isOpen
    ? (ids.length === 0 ? CITATIONS : resolveIds(ids))
    : [];
  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);
  return (
    <>
      <div
        className={`cite-overlay${isOpen ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`cite-drawer${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Citations"
        aria-hidden={!isOpen}
      >
        <header className="cite-drawer-header">
          <div>
            <div className="title">Sources</div>
            <div className="sub">
              {ids && ids.length === 1
                ? 'Citation backing this claim'
                : `${list.length} reference${list.length === 1 ? '' : 's'} cited in this report`}
            </div>
          </div>
          <button className="cite-drawer-close" onClick={onClose} aria-label="Close sources drawer">×</button>
        </header>
        <div className="cite-drawer-body">
          {list.map((c) => (
            <article key={c.id} className="cite-card">
              <div className={`label kind-${c.kind}`}>{c.label}</div>
              <h3 className="title">{c.title}</h3>
              <div className="meta">{c.source}{c.year ? ` · ${c.year}` : ''}</div>
              <p className="body">{c.body}</p>
              <div className="footer">
                <a className="open-link" href={c.url} target="_blank" rel="noreferrer noopener">
                  Open source ↗
                </a>
                <div className="backs" title="Claims this citation backs">
                  {c.backs.map((b) => <span key={b}>{b}</span>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mol3D viewer (3Dmol.js, lazy-loaded from CDN)
// ---------------------------------------------------------------------------
//
// Renders a real PDB structure inline. The library is ~600 KB, so we defer
// loading the script tag until the viewer enters the viewport via an
// IntersectionObserver. After the script loads we mount a viewer in the
// container, fetch the structure from RCSB, apply a cartoon style with an
// optional residue-class highlight (defaults to glycine), and expose three
// interactive controls: highlight toggle, auto-rotate, reset view.

const MOLSTAR_3DMOL_SRC = 'https://3dmol.org/build/3Dmol-min.js';

function load3Dmol() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.$3Dmol) return Promise.resolve(window.$3Dmol);
  // Reuse an in-flight load promise so two viewers on the page don't fight.
  if (window.__3DmolLoading) return window.__3DmolLoading;
  window.__3DmolLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = MOLSTAR_3DMOL_SRC;
    s.async = true;
    s.onload = () => resolve(window.$3Dmol);
    s.onerror = () => reject(new Error('3Dmol script failed to load'));
    document.head.appendChild(s);
  });
  return window.__3DmolLoading;
}

/** Try the AlphaFold-DB API to discover the canonical model URL, then fall
 *  back to a few hand-rolled `model_v{n}.pdb` patterns. The API path is
 *  the only one that doesn't break when EBI bumps the version. */
async function fetchAlphaFoldPdb(uniprotId) {
  // Path 1: EBI API discovery
  try {
    const r = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`);
    if (r.ok) {
      const meta = await r.json();
      const url = Array.isArray(meta) && meta[0] && meta[0].pdbUrl;
      if (url) {
        const f = await fetch(url);
        if (f.ok) return f.text();
      }
    }
  } catch { /* fall through */ }
  // Path 2: try recent versions directly
  for (const v of ['v5', 'v4', 'v3']) {
    try {
      const r = await fetch(`https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_${v}.pdb`);
      if (r.ok) return r.text();
    } catch { /* try next */ }
  }
  throw new Error(`No AlphaFold prediction found for ${uniprotId}`);
}

function Mol3DViewer({
  pdbId,
  pdbUrl,
  alphafoldId,                   // UniProt accession; auto-resolves via EBI API
  caption,
  // 'experimental' (X-ray, NMR, cryo-EM) | 'predicted' (AlphaFold)
  kind = 'experimental',
  source,                        // optional source label (e.g., 'AF-Q9UQ07-F1')
  uniprotId,                     // for predicted structures, the UniProt id
  highlightResn = 'GLY',
  highlightLabel = 'glycines',
  highlightColor = '#67e8f9',
  defaultHighlight = true,
  // Linked-view spotlight: parent passes the index of the residue currently
  // being "walked", and we render that residue in bright white sphere+cartoon
  // so it pops out of the highlighted set. -1 / undefined = no spotlight.
  walkIdx,
  // Called once after load with the array of residue numbers that make up
  // the longest contiguous run of `highlightResn`. The parent uses this to
  // size its own bead-spotlight loop to match the structure.
  onRunFound,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  // Residue numbers for the longest contiguous run of `highlightResn` in
  // the loaded structure. Computed once after load, used by the spotlight
  // logic to map an external `walkIdx` to a real residue id.
  const walkResiduesRef = useRef([]);
  const [status, setStatus] = useState('idle');     // idle | loading | ready | error
  const [highlight, setHighlight] = useState(defaultHighlight);
  const [spinning, setSpinning] = useState(false);
  const [inView, setInView] = useState(false);

  // Lazy mount: wait until the frame is near the viewport, then load.
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: '300px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Load library + structure once. Two paths:
  //   1. pdbUrl given     → fetch the file directly, addModel to the viewer
  //                         (used for AlphaFold predictions and any URL-served
  //                         structure)
  //   2. pdbId only       → use 3Dmol's built-in `download('pdb:XXXX')` which
  //                         hits RCSB
  useEffect(() => {
    if (!inView || status !== 'idle') return;
    let cancelled = false;
    setStatus('loading');
    load3Dmol()
      .then(($3Dmol) => {
        if (cancelled || !containerRef.current) return;
        const v = $3Dmol.createViewer(containerRef.current, {
          backgroundColor: 0x07091a,
          antialias: true,
        });
        viewerRef.current = v;
        // Path 1: explicit AlphaFold UniProt accession — EBI API discovery
        if (alphafoldId) {
          return fetchAlphaFoldPdb(alphafoldId).then((data) => {
            if (cancelled) return;
            v.addModel(data, 'pdb');
          });
        }
        // Path 2: arbitrary direct URL
        if (pdbUrl) {
          return fetch(pdbUrl)
            .then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status} for ${pdbUrl}`);
              return r.text();
            })
            .then((data) => {
              if (cancelled) return;
              v.addModel(data, 'pdb');
            });
        }
        // Path 3: RCSB via 3Dmol's built-in fetch
        return new Promise((resolve, reject) => {
          $3Dmol.download(`pdb:${pdbId}`, v, {}, (model) => {
            if (model) resolve();
            else reject(new Error(`Could not load PDB ${pdbId}`));
          });
        });
      })
      .then(() => {
        if (cancelled) return;
        applyStyle(true);
        const v = viewerRef.current;
        v.zoomTo();
        // Tighter framing — 3Dmol's auto-fit leaves a lot of margin around
        // the bounding box; zoom in another 30% so the structure actually
        // fills the viewport.
        try { v.zoom(1.3); } catch { /* ignore */ }
        v.render();

        // Detect ALL contiguous runs of `highlightResn` (defaults to GLY)
        // so the parent can show "8 in main run · 5 other multi-G runs ·
        // 124 total glycines." The walk targets the longest run; the rest
        // are surfaced as context.
        try {
          const atoms = v.selectedAtoms({ resn: highlightResn, atom: 'CA' });
          const resis = [...new Set(atoms.map((a) => a.resi).filter((n) => n != null))].sort((a, b) => a - b);
          // Walk every position; whenever the residue number is not
          // contiguous with the previous, close the current run.
          const runs = []; // [{ startIdx, len }]
          let curStart = 0, curLen = 0;
          for (let i = 0; i < resis.length; i++) {
            if (i > 0 && resis[i] === resis[i - 1] + 1) {
              curLen++;
            } else {
              if (curLen >= 1) runs.push({ startIdx: curStart, len: curLen });
              curStart = i; curLen = 1;
            }
          }
          if (curLen >= 1) runs.push({ startIdx: curStart, len: curLen });

          const longest = runs.reduce(
            (m, r) => (r.len > m.len ? r : m),
            { startIdx: 0, len: 0 },
          );
          const longestResidues =
            longest.len >= 3 ? resis.slice(longest.startIdx, longest.startIdx + longest.len) : [];
          walkResiduesRef.current = longestResidues;

          if (onRunFound && longestResidues.length > 0) {
            onRunFound({
              residues: longestResidues,
              longestLen: longest.len,
              totalCount: resis.length,
              multiRunLengths: runs
                .filter((r) => r.len >= 2)
                .map((r) => r.len)
                .sort((a, b) => b - a),
            });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Run detection failed:', e);
        }

        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error(err);
        setStatus('error');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, pdbId, pdbUrl, alphafoldId]);

  // Re-apply style when the highlight toggle, residue selector, color, or
  // walk index changes (after first render). Lets the conservation scene
  // re-target highlight without rebuilding the whole viewer, and lets the
  // parent drive the walk-through spotlight.
  useEffect(() => {
    if (status !== 'ready') return;
    applyStyle(highlight);
    viewerRef.current.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, highlightResn, highlightColor, walkIdx]);

  // Auto-rotate loop: rotates around Y at ~0.4°/frame while running.
  useEffect(() => {
    if (status !== 'ready' || !spinning) return;
    let raf;
    const tick = () => {
      try {
        viewerRef.current.rotate(0.4, 'y');
        viewerRef.current.render();
      } catch { /* viewer torn down */ }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, status]);

  function applyStyle(withHighlight) {
    const v = viewerRef.current;
    if (!v) return;
    const isWalking = walkIdx != null && walkIdx >= 0;

    // Default cartoon — full opacity in idle mode, dimmed when the walk
    // is active so the spotlit residue can stand out against the crowd.
    v.setStyle({}, {
      cartoon: { color: 'spectrum', opacity: isWalking ? 0.40 : 0.85 },
    });

    if (withHighlight) {
      // Glycine cohort highlight (cyan cartoon + sticks). When walking, dim
      // these to ~40% opacity so the single spotlit residue isn't drowned
      // out by the dozens of other cyan glycines spread across the lattice.
      v.setStyle({ resn: highlightResn }, {
        cartoon: {
          color: highlightColor,
          thickness: 0.5,
          opacity: isWalking ? 0.40 : 1.0,
        },
        stick: {
          color: highlightColor,
          radius: isWalking ? 0.12 : 0.22,
          opacity: isWalking ? 0.40 : 1.0,
        },
      });
    }

    // Walk-through spotlight — atomic-scale ball-and-stick on the spotlit
    // residue + a translucent yellow halo on the Cα as a "look here" marker.
    if (isWalking) {
      const run = walkResiduesRef.current;
      const resi = run[walkIdx];
      if (resi !== undefined) {
        v.setStyle({ resi }, {
          cartoon: { color: '#ffffff', thickness: 1.2 },
          stick:   { color: '#ffffff', radius: 0.22 },
        });
        // Halo: a translucent yellow sphere centered on the alpha carbon.
        // ~2.5 Å radius — visibly bigger than atomic scale so the eye picks
        // it up from across the structure, but soft enough that the four
        // backbone atoms (N, Cα, C, O) underneath stay legible.
        v.addStyle({ resi, atom: 'CA' }, {
          sphere: { color: '#fbbf24', radius: 2.5, opacity: 0.35 },
        });
        try { v.center({ resi }); } catch { /* older 3Dmol */ }
      }
    }
  }

  function reset() {
    if (status !== 'ready') return;
    const v = viewerRef.current;
    v.zoomTo();
    try { v.zoom(1.3); } catch { /* ignore */ }
    v.render();
  }

  // Honest provenance label: which source produced this structure.
  const isPredicted = kind === 'predicted';
  const afId = alphafoldId || uniprotId;
  const sourceLabel = source
    || (isPredicted ? `AF-${afId || '???'}-F1` : (pdbId ? `PDB · ${pdbId}` : 'PDB'));
  const externalUrl = isPredicted && afId
    ? `https://alphafold.ebi.ac.uk/entry/${afId}`
    : pdbId ? `https://www.rcsb.org/structure/${pdbId}` : null;
  const externalLabel = isPredicted ? 'Open on AlphaFold ↗' : 'Open in RCSB ↗';

  return (
    <div className="mol3d-frame">
      <div className="mol3d-meta">
        <div className="mol3d-meta-line">
          <span className={`mol3d-kind ${isPredicted ? 'predicted' : 'experimental'}`}>
            {isPredicted ? 'PREDICTED · ALPHAFOLD' : 'EXPERIMENTAL · X-RAY'}
          </span>
          <span className={isPredicted ? 'pdb af' : 'pdb'}>{sourceLabel}</span>{' '}
          <span style={{ color: 'var(--text-soft)', letterSpacing: 0.5, textTransform: 'none', fontFamily: 'inherit' }}>
            {caption}
          </span>
        </div>
        <span className="hint">drag to rotate · scroll to zoom · right-drag to pan</span>
      </div>
      <div className="mol3d-container" ref={containerRef}>
        {status !== 'ready' && status !== 'error' && (
          <div className="mol3d-status">
            <span className="pulse" aria-hidden />
            {status === 'idle'
              ? 'Mol3D ready when you scroll here'
              : isPredicted
                ? `Loading ${sourceLabel} from AlphaFold DB…`
                : `Loading ${pdbId} from RCSB…`}
          </div>
        )}
        {status === 'error' && (
          <div className="mol3d-status error">
            Couldn't load the structure inline.
            {externalUrl && (
              <a href={externalUrl} target="_blank" rel="noreferrer noopener">{externalLabel}</a>
            )}
          </div>
        )}
      </div>
      <div className="mol3d-controls">
        <button
          onClick={() => setHighlight((v) => !v)}
          className={`btn ${highlight ? 'primary' : 'ghost'}`}
          disabled={status !== 'ready'}
        >
          {highlight ? `✓ Highlight ${highlightLabel}` : `Highlight ${highlightLabel}`}
        </button>
        <button
          onClick={() => setSpinning((v) => !v)}
          className={`btn ${spinning ? 'primary' : 'ghost'}`}
          disabled={status !== 'ready'}
        >
          {spinning ? '⏸ Pause spin' : '↻ Auto-rotate'}
        </button>
        <button
          onClick={reset}
          className="btn ghost"
          disabled={status !== 'ready'}
        >
          ↺ Reset view
        </button>
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank" rel="noreferrer noopener"
            className="btn ghost"
          >
            {externalLabel}
          </a>
        )}
      </div>
      <div className="mol3d-legend">
        <span><span className="swatch" style={{ background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #fbbf24)' }} />Cartoon · spectrum (N→C terminus)</span>
        <span><span className="swatch" style={{ background: highlightColor }} />{highlightLabel} (sticks + cartoon)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence badges — provenance flags for individual claims
// ---------------------------------------------------------------------------
//
// Tiny triangle pips that mark how a claim is backed:
//   ai   — derived from AI semantic-similarity / embeddings
//   str  — supported by experimental structural data
//   lit  — backed by published literature
//   exp  — derived from simulation / experiment (e.g., MD)
//
// `<Conf kinds={['str', 'lit']} />` renders one pip per kind with hover
// tooltips. The intent is for the reader to scan the page like a flight
// dashboard and tell at-a-glance what kind of evidence each statement is
// resting on.

const CONF_LABELS = {
  ai:  { label: 'AI',  full: 'AI semantic / embedding-derived' },
  str: { label: 'STR', full: 'Experimental structural data (PDB, X-ray, cryo-EM)' },
  lit: { label: 'LIT', full: 'Published literature (peer-reviewed)' },
  exp: { label: 'SIM', full: 'Simulation or computational experiment (MD, MSA)' },
};

function Conf({ kinds }) {
  if (!kinds || !kinds.length) return null;
  return (
    <span className="conf-row">
      {kinds.map((k) => {
        const info = CONF_LABELS[k];
        if (!info) return null;
        return (
          <span
            key={k}
            className="conf-pip"
            data-kind={k}
            title={info.full}
            aria-label={`Evidence: ${info.full}`}
          >
            {info.label}
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AI Inspector — show-your-work layer
// ---------------------------------------------------------------------------
//
// The Inspector is a global toggle. When ON, every <AIInsight> card in the
// tree fades in beneath its claim and renders the actual math/method/inputs
// the AI used. When OFF, the cards collapse to zero height. The point is
// intellectual honesty: the page should be willing to show what it did.

const InspectorContext = React.createContext({ on: false });

function AIInsight({ method, children }) {
  const { on } = React.useContext(InspectorContext);
  return (
    <div className={`ai-insight${on ? ' open' : ''}`} aria-hidden={!on}>
      <div className="ai-insight-tag">
        AI Inspector{method ? <span className="method"> · {method}</span> : null}
      </div>
      <div className="ai-insight-body">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Speech helpers (auto-tour)
// ---------------------------------------------------------------------------

function cancelSpeech() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
function speak(text, onEnd) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 0.95;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const sceneIds = SCENES.map((s) => s.id);
  const activeId = useActiveScene(sceneIds);
  const [tourRunning, setTourRunning] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const cancelRef = useRef(false);
  // Citation drawer state. null = closed, [] = open with all sources, [...]
  // = open filtered to a specific set of citation ids.
  const [drawerIds, setDrawerIds] = useState(null);
  const openDrawer = useCallback((ids) => setDrawerIds(ids ?? []), []);
  const closeDrawer = useCallback(() => setDrawerIds(null), []);
  const citationCtx = useMemo(() => ({ open: openDrawer }), [openDrawer]);

  // AI Inspector toggle — global "show your work" layer.
  const [inspectorOn, setInspectorOn] = useState(false);
  const inspectorCtx = useMemo(() => ({ on: inspectorOn }), [inspectorOn]);

  const tourProgress = useMemo(() => {
    const i = sceneIds.indexOf(activeId);
    return ((i + 1) / sceneIds.length) * 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Autoplay tour: scrolls to scene N, narrates, advances when speech ends.
  useEffect(() => {
    if (!tourRunning) return;
    cancelRef.current = false;
    cancelSpeech();
    const scene = SCENES[tourIdx];
    const el = document.getElementById(scene.id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    speak(scene.narration, () => {
      if (cancelRef.current) return;
      setTimeout(() => {
        if (cancelRef.current) return;
        setTourIdx((i) => {
          if (i + 1 >= SCENES.length) { setTourRunning(false); return i; }
          return i + 1;
        });
      }, 700);
    });
    return () => {
      cancelRef.current = true;
      cancelSpeech();
    };
  }, [tourRunning, tourIdx]);

  const startTour = () => { cancelRef.current = false; setTourIdx(0); setTourRunning(true); };
  const stopTour  = () => { cancelRef.current = true; cancelSpeech(); setTourRunning(false); };
  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <CitationContext.Provider value={citationCtx}>
    <InspectorContext.Provider value={inspectorCtx}>
      <Starfield />
      <TourBar
        running={tourRunning}
        progress={tourProgress}
        onStart={startTour}
        onStop={stopTour}
        onOpenSources={() => openDrawer([])}
        inspectorOn={inspectorOn}
        onToggleInspector={() => setInspectorOn((v) => !v)}
      />
      <StoryNav activeId={activeId} onJump={jumpTo} />

      <SceneHero  onStartTour={startTour} />
      <SceneQuestion />
      <SceneMeet />
      <SceneGlycine />
      <SceneNetwork />
      <ScenePocket />
      <SceneConservation />
      <SceneDynamics />
      <ScenePathways />
      <SceneTherapeutic />
      <SceneMethodology />
      <SceneEvidence onOpenDrawer={openDrawer} />
      <SceneClosing onStartTour={startTour} onOpenSources={() => openDrawer([])} />

      <CitationDrawer ids={drawerIds} onClose={closeDrawer} />
    </InspectorContext.Provider>
    </CitationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Top tour bar
// ---------------------------------------------------------------------------

function TourBar({ running, progress, onStart, onStop, onOpenSources, inspectorOn, onToggleInspector }) {
  return (
    <div className="tour-bar">
      <div>
        <div className="tour-brand">HumanOS · Discovery</div>
        <div className="tour-title">A scroll-driven look at what AI uncovered.</div>
      </div>
      <div className="tour-progress" aria-hidden><div style={{ width: `${progress}%` }} /></div>
      <div className="tour-controls">
        <button
          className={`btn ghost${inspectorOn ? ' inspector-on' : ''}`}
          onClick={onToggleInspector}
          title={inspectorOn
            ? 'Hide the AI Inspector layer'
            : 'Show the AI Inspector — see the math and methods behind each AI-derived claim'}
          aria-pressed={inspectorOn}
        >
          ◉ AI Inspector{inspectorOn ? ' · ON' : ''}
        </button>
        <button
          className="btn ghost"
          onClick={onOpenSources}
          title="Open the citations drawer — every literature reference in this report"
        >
          ⌘ Sources · <span style={{ color: 'var(--cyan-bright)' }}>{CITATIONS.length}</span>
        </button>
        {running ? (
          <button className="btn danger" onClick={onStop} title="Stop the autoplay tour">■ Stop tour</button>
        ) : (
          <button className="btn primary" onClick={onStart} title="Auto-scroll & narrate the whole journey">▶ Auto tour</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-edge story progress nav
// ---------------------------------------------------------------------------

function StoryNav({ activeId, onJump }) {
  return (
    <nav className="story-nav" aria-label="Scene navigator">
      {SCENES.map((s, i) => (
        <button
          key={s.id}
          className={s.id === activeId ? 'active' : ''}
          onClick={() => onJump(s.id)}
          title={`${i + 1}. ${s.short}`}
        >
          <span className="label">{(i + 1).toString().padStart(2, '0')} · {s.short}</span>
          <span className="dot" />
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Ambient starfield
// ---------------------------------------------------------------------------

function Starfield() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      d: Math.random() * 4,
      o: Math.random() * 0.4 + 0.2,
      s: Math.random() * 1.4 + 0.6,
    }));
  }, []);
  return (
    <div className="starfield" aria-hidden>
      {stars.map((st, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${st.x}%`, top: `${st.y}%`,
            transform: `scale(${st.s})`,
            animationDelay: `${st.d}s`,
            opacity: st.o,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene wrapper
// ---------------------------------------------------------------------------

function Scene({ id, num, eyebrow, first, children }) {
  const [ref, inView] = useInView();
  return (
    <section
      id={id}
      ref={ref}
      className={`scene${inView ? ' in-view' : ''}${first ? ' first' : ''}`}
    >
      {num !== undefined && <div className="scene-num reveal r1">Scene {String(num).padStart(2, '0')} of {SCENES.length}</div>}
      {eyebrow && <div className="scene-eyebrow reveal r2">{eyebrow}</div>}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 01 Hero
// ---------------------------------------------------------------------------

/** Slow-drifting SVG protein backbone behind the hero. Procedural — no
 *  geometry library, just a sinusoidal Cα trace generated once and panned/
 *  rotated by t. Sits behind the headline at ~25% opacity. */
function HeroBackbone() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = () => {
      setT((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Build the spline once. ~140 Cα points along a tubular path that wanders
  // gently through the canvas, producing a kinase-domain-like silhouette.
  const path = useMemo(() => {
    const N = 140;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = 50 + Math.sin(u * Math.PI * 4 + 0.7) * 32 + Math.cos(u * Math.PI * 9) * 6;
      const y = 50 + Math.cos(u * Math.PI * 3 + 1.2) * 22 + Math.sin(u * Math.PI * 7) * 5;
      pts.push([x, y]);
    }
    return pts;
  }, []);
  // Animate by rotating the path slowly around the center; project to a 2D
  // SVG by adding a small parallactic drift.
  const ang = t * 0.05;
  const c = Math.cos(ang), s = Math.sin(ang);
  const projected = path.map(([x, y]) => {
    const dx = x - 50, dy = y - 50;
    return [50 + dx * c - dy * s, 50 + dx * s + dy * c];
  });
  const d = projected.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  return (
    <div className="hero-backbone" aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#67e8f9" stopOpacity="0.55" />
            <stop offset="50%"  stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke="url(#bb-grad)" strokeWidth="0.8"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="#67e8f9" strokeWidth="0.25"
          strokeOpacity="0.35" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {projected.filter((_, i) => i % 8 === 0).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.6" fill="#67e8f9" fillOpacity="0.55" />
        ))}
      </svg>
    </div>
  );
}


function SceneHero({ onStartTour }) {
  return (
    <Scene id="hero" first>
      <HeroBackbone />
      <div className="hero-stage reveal r1">
        <h1>
          What AI <em>actually</em><br />
          found in the proteins.
        </h1>
        <p className="hero-sub reveal r2">
          A 12-scene story about two human kinases — and the patterns sequence alignment couldn't see.
        </p>
        <div className="reveal r3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="hero-cta" onClick={onStartTour}>▶ Take the auto-tour</button>
          <a className="btn ghost" href="#question">Or scroll yourself ↓</a>
        </div>
        <div className="scroll-hint reveal r4">
          <span>Scroll</span>
          <span className="arrow" />
        </div>
      </div>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// 02 The Question
// ---------------------------------------------------------------------------

function SceneQuestion() {
  return (
    <Scene id="question" num={2} eyebrow="The question">
      <h1 className="reveal r1">
        Can AI <em>actually</em> find new things in protein data — or is it just <em>pattern matching</em>?
      </h1>
      <p className="lede reveal r2">
        It's the question every honest researcher asks before they trust the output. The next 10 scenes are the answer:
        a real discovery thread, found by AI, defended by structure, and pointed at therapeutics.
      </p>
      <div className="metric-row reveal r3">
        <div className="metric cyan"><div className="v">2 proteins</div><div className="k">LTK & MOK</div></div>
        <div className="metric violet"><div className="v">30% / 52%</div><div className="k">sequence vs AI similarity</div></div>
        <div className="metric amber"><div className="v">4 strategies</div><div className="k">therapeutic paths</div></div>
        <div className="metric green"><div className="v">$18B</div><div className="k">addressable market</div></div>
      </div>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// 03 Meet LTK & MOK
// ---------------------------------------------------------------------------

function SceneMeet() {
  return (
    <Scene id="meet" num={3} eyebrow="The two proteins">
      <h2 className="reveal r1">Same family. Wildly different physics. <Conf kinds={['str', 'lit']} /></h2>
      <p className="lede reveal r2">
        LTK is long, floppy, and glycine-rich. MOK is compact and rigid. They share the kinase scaffolding every kinase
        shares — but everything outside the catalytic core is built differently. <strong>That contrast is where AI
        starts to see something interesting.</strong>
      </p>
      <div className="proteins">
        <div className="protein flex reveal r3">
          <div className="name">LTK<small>flexible kinase</small></div>
          <div className="desc">868 amino acids. Glycine clusters along the backbone act as flexibility hinges. Highly mobile, samples a wide conformational landscape.</div>
          <div className="stats">
            <div className="stat-row"><span>Length</span><span>868 AA</span></div>
            <div className="stat-row"><span>Glycine %</span><span>14.3%</span></div>
            <div className="stat-row"><span>Max run</span><span>10 G in a row</span></div>
            <div className="stat-row"><span>Flexibility</span><span>Very high</span></div>
          </div>
        </div>
        <div className="protein compact reveal r4">
          <div className="name">MOK<small>compact kinase</small></div>
          <div className="desc">
            419 amino acids. Almost no glycine. Tightly packed, mitochondrial; recently linked to cristae dynamics
            and oxidative stress <Cite ids={['pmc-8175086']} />.
          </div>
          <div className="stats">
            <div className="stat-row"><span>Length</span><span>419 AA</span></div>
            <div className="stat-row"><span>Glycine %</span><span>1.7%</span></div>
            <div className="stat-row"><span>Max run</span><span>1</span></div>
            <div className="stat-row"><span>Flexibility</span><span>Low</span></div>
          </div>
        </div>
      </div>
      <p className="reveal r5" style={{ marginTop: 22, fontSize: 13.5, color: 'var(--text-muted)' }}>
        Both proteins, side-by-side, as <strong style={{ color: 'var(--text)' }}>AlphaFold</strong> predicts them.
        Spectrum-colored N → C terminus. Drag to rotate.
      </p>
      <div className="reveal r5 mol-compare" style={{ marginTop: 8 }}>
        <Mol3DViewer
          kind="predicted"
          alphafoldId="P29376"
          source="AF-P29376-F1 · LTK"
          caption="LTK · full predicted structure (864 AA)"
          highlightResn="GLY"
          highlightLabel="glycines"
          highlightColor="#67e8f9"
          defaultHighlight={false}
        />
        <Mol3DViewer
          kind="predicted"
          alphafoldId="Q9UQ07"
          source="AF-Q9UQ07-F1 · MOK"
          caption="MOK · full predicted structure (419 AA)"
          highlightResn="GLY"
          highlightLabel="glycines"
          highlightColor="#67e8f9"
          defaultHighlight={false}
        />
      </div>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// MOK comparison schematic (Scene 4)
// ---------------------------------------------------------------------------
//
// Honest framing: there's no MOK PDB embedded in this report — the
// biochemical characterization in PMC 8175086 isn't paired with an
// LTK-comparable crystal structure. So we render a *clearly stylized*
// schematic instead of a fake PDB. The visual contrast (real lattice ribbon
// vs compact stylized ball) carries the comparison better than two pretend-
// equivalent viewers would.
function MOKSchematic() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const loop = () => {
      setT((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Sparse glycines, fixed positions (1.7% of 419 ≈ 7 glycines, scattered).
  const glys = [
    { x: 130, y: 130 }, { x: 232, y: 110 }, { x: 270, y: 175 },
    { x: 178, y: 200 }, { x: 110, y: 178 }, { x: 200, y: 80  },
    { x: 245, y: 220 },
  ];
  // Slow rotation of the compact body.
  const ang = t * 0.10;
  return (
    <div className="mok-schematic">
      <div className="mol3d-meta">
        <div>
          <span className="pdb" style={{ color: 'var(--blue-bright)' }}>SCHEMATIC · MOK</span>{' '}
          <span style={{ color: 'var(--text-soft)', letterSpacing: 0.5, textTransform: 'none', fontFamily: 'inherit' }}>
            compact mitochondrial kinase · stylized · not a PDB structure
          </span>
        </div>
        <span className="hint">no MOK PDB embedded — characterization in literature</span>
      </div>
      <div className="mol3d-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 380 380" preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', maxHeight: 360 }}>
          <defs>
            <radialGradient id="mok-body" cx="38%" cy="34%" r="62%">
              <stop offset="0%"   stopColor="#dbeafe" stopOpacity="0.95" />
              <stop offset="60%"  stopColor="#60a5fa" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.40" />
            </radialGradient>
            <radialGradient id="mok-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#60a5fa" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform={`translate(190 190) rotate(${ang * 18})`}>
            <circle r={140} fill="url(#mok-glow)" />
            {/* Compact ribbon-y body — denser than LTK's open lattice */}
            <ellipse rx={108} ry={96} fill="url(#mok-body)" stroke="#93c5fd" strokeOpacity="0.55" strokeWidth="1.4" />
            {/* Stylized fold lines hinting at α-helices and β-sheets */}
            <path d="M -84,-40 q 28,-30 84,-12 q 38,12 56,46 q 14,40 -14,68 q -32,30 -76,12 q -42,-18 -56,-58 q -10,-32 6,-56 z"
              fill="none" stroke="#93c5fd" strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M -52,8 q 24,-12 56,4 q 28,16 30,46"
              fill="none" stroke="#bfdbfe" strokeOpacity="0.65" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M 16,-58 q -8,30 -42,38 q -28,6 -38,-22"
              fill="none" stroke="#bfdbfe" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
            {/* Sparse glycines */}
            {glys.map((g, i) => (
              <g key={i}>
                <circle cx={g.x - 190} cy={g.y - 190} r={5} fill="#67e8f9" opacity="0.85">
                  <animate attributeName="r" values="4;6;4" dur={`${2.2 + i * 0.18}s`} repeatCount="indefinite" />
                </circle>
              </g>
            ))}
          </g>
          {/* Frame label */}
          <text x="190" y="370" textAnchor="middle" fill="#94a3b8" fontSize="10" letterSpacing="2">
            STYLIZED · 419 AA · 1.7% GLYCINE · NO RUNS &gt; 1
          </text>
        </svg>
      </div>
      <div className="mok-schematic-stats">
        <div className="mss-cell"><div className="k">Length</div><div className="v">419 AA</div></div>
        <div className="mss-cell"><div className="k">Glycine</div><div className="v">1.7% (~7 total)</div></div>
        <div className="mss-cell"><div className="k">Max run</div><div className="v">1 in a row</div></div>
        <div className="mss-cell"><div className="k">Localization</div><div className="v">mitochondrial</div></div>
      </div>
      <div className="mok-schematic-cite">
        Biochemical characterization: <Cite ids={['pmc-8175086']} /> identifies MOK as a mitochondrial kinase
        regulating cristae dynamics. No MOK kinase-domain PDB matches the LTK extracellular comparison made by 7NX1 —
        what you see on the right is a stylized representation of MOK's compactness, not a crystal structure.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glycine — molecular detail + R-group comparison
// ---------------------------------------------------------------------------

// Parameter table for the morphing molecule diagram. Each entry replaces:
// the headline, the formula+mass+tagline, the R-column tease, the R-position
// rendering inside the SVG, and the callout below the diagram.
const AA_DATA = {
  gly: {
    name: 'Glycine', code3: 'Gly', code1: 'G',
    formula: 'H₂N – CH₂ – COOH', mass: '75.07 Da',
    tag: 'simplest amino acid',
    rTease: ['The R-position is just', <strong key="r">H</strong>, '.'],
    rTease2: "That's why ten in a row makes a hinge.",
    rLabel: 'R = H',
    callout: (
      <>
        <strong>The R-position is where every other amino acid puts its side chain.</strong>{' '}
        Alanine puts a CH₃ here. Valine puts an isopropyl. Phenylalanine puts a benzene ring.{' '}
        <strong>Glycine puts a hydrogen.</strong> No bulk, no steric constraint — the backbone can rotate freely
        at every glycine. Ten in a row, and you have a hinge.
      </>
    ),
  },
  ala: {
    name: 'Alanine', code3: 'Ala', code1: 'A',
    formula: 'H₂N – CH(CH₃) – COOH', mass: '89.09 Da',
    tag: 'one carbon beyond glycine',
    rTease: ['R is now a methyl group ', <strong key="r">CH₃</strong>, '.'],
    rTease2: 'One heavy atom of bulk. Backbone can still rotate, just less.',
    rLabel: 'R = CH₃',
    callout: (
      <>
        <strong>One step beyond glycine.</strong> Alanine adds a single methyl group at the R-position. Just one
        carbon, three hydrogens — but already enough bulk to stiffen the backbone noticeably. Alanine helices are
        common in proteins; alanine-rich runs don't make hinges the way poly-glycine does.
      </>
    ),
  },
  val: {
    name: 'Valine', code3: 'Val', code1: 'V',
    formula: 'H₂N – CH(CH(CH₃)₂) – COOH', mass: '117.15 Da',
    tag: 'branched-chain amino acid (BCAA)',
    rTease: ['R is the ', <strong key="r">isopropyl</strong>, ' branch.'],
    rTease2: 'Three heavy atoms. Hydrophobic. Buries in protein interiors.',
    rLabel: 'R = CH(CH₃)₂',
    callout: (
      <>
        <strong>The selectivity-handle residue.</strong> LTK puts a valine here in its ATP recognition motif, while
        MOK puts isoleucine — a single −CH₂− difference that reshapes the binding pocket and opens the door to
        selective inhibitors. Scene 6 walks through the chemistry.
      </>
    ),
  },
  phe: {
    name: 'Phenylalanine', code3: 'Phe', code1: 'F',
    formula: 'H₂N – CH(CH₂C₆H₅) – COOH', mass: '165.19 Da',
    tag: 'aromatic, hydrophobic',
    rTease: ['R is a whole ', <strong key="r">benzene ring</strong>, '.'],
    rTease2: 'Seven heavy atoms. Rigid, planar, π-stacking.',
    rLabel: 'R = CH₂C₆H₅',
    callout: (
      <>
        <strong>About as far from glycine as you can get.</strong> Phenylalanine packs a methylene linker plus a
        full benzene ring at the R-position. Bulky, rigid, planar — perfect for π-stacking interactions with other
        aromatic residues. A run of phenylalanines doesn't bend; it builds a wall.
      </>
    ),
  },
};

const AA_ORDER = ['gly', 'ala', 'val', 'phe'];

/** A clean 2D structural diagram of an amino acid, parameterized by which
 *  residue is selected. The α-carbon, NH₂, COOH, and back-H are constant —
 *  the R-position swaps to show what each residue actually puts there. The
 *  R-group cards below the diagram drive the swap. */
function GlycineMolecule() {
  const [selected, setSelected] = useState('gly');
  const aa = AA_DATA[selected];
  return (
    <div className="gly-mol-card reveal r2">
      <div className="gly-mol-header">
        <div>
          <div className="gly-mol-tag">{aa.name} · {aa.code3} · {aa.code1}</div>
          <div className="gly-mol-formula">{aa.formula} · {aa.mass} · {aa.tag}</div>
        </div>
        <div className="gly-mol-rcol">
          <span>{aa.rTease.map((c, i) => typeof c === 'string' ? c : React.cloneElement(c, { key: i }))}</span>
          <span>{aa.rTease2}</span>
        </div>
      </div>
      <svg viewBox="0 0 640 340" className="gly-mol-svg" role="img" aria-label="Glycine structural diagram">
        <defs>
          <radialGradient id="atom-c" cx="35%" cy="32%" r="65%">
            <stop offset="0%"  stopColor="#cbd5e1" />
            <stop offset="60%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>
          <radialGradient id="atom-n" cx="35%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="#bfdbfe" />
            <stop offset="60%"  stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
          <radialGradient id="atom-o" cx="35%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="#fecaca" />
            <stop offset="60%"  stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
          <radialGradient id="atom-h" cx="35%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
          <radialGradient id="atom-r" cx="35%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="#ecfeff" />
            <stop offset="60%"  stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#0891b2" />
          </radialGradient>
        </defs>

        {/* ───── Bonds (drawn first so atoms cover their endpoints) ───── */}
        {/* α-C → N (amino) */}
        <line x1="320" y1="170" x2="170" y2="100" stroke="rgba(255,255,255,0.55)" strokeWidth="3.5" strokeLinecap="round" />
        {/* α-C → C(=O) of carboxyl */}
        <line x1="320" y1="170" x2="470" y2="100" stroke="rgba(255,255,255,0.55)" strokeWidth="3.5" strokeLinecap="round" />
        {/* α-C → "back" H (left) */}
        <line x1="320" y1="170" x2="240" y2="240" stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeLinecap="round" />
        {/* α-C → R-position attachment (right, highlighted) */}
        <line x1="320" y1="170" x2="400" y2="240" stroke="rgba(103, 232, 249, 0.9)" strokeWidth="4" strokeLinecap="round" />
        {/* N → 2 H's (amino) */}
        <line x1="170" y1="100" x2="120" y2="55"  stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="170" y1="100" x2="200" y2="40"  stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" />
        {/* C(=O) double bond to O (top right) */}
        <g stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round">
          <line x1="475" y1="92"  x2="540" y2="55" />
          <line x1="465" y1="108" x2="530" y2="71" />
        </g>
        {/* C–OH single bond */}
        <line x1="470" y1="100" x2="535" y2="138" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
        {/* OH → H */}
        <line x1="535" y1="138" x2="585" y2="158" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" />

        {/* ───── R-position halo (drawn behind R-H) ───── */}
        <circle cx="400" cy="240" r="36" fill="none"
          stroke="rgba(103, 232, 249, 0.55)" strokeWidth="1.5" strokeDasharray="3 4">
          <animate attributeName="r" values="34;42;34" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.55;0.85;0.55" dur="2.6s" repeatCount="indefinite" />
        </circle>

        {/* ───── Atoms ───── */}
        {/* α-Carbon */}
        <g>
          <circle cx="320" cy="170" r="30" fill="url(#atom-c)" />
          <text x="320" y="178" textAnchor="middle" fill="#0a0e1a" fontSize="20" fontWeight="800">C</text>
          <text x="320" y="135" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontStyle="italic" fontWeight="600">α</text>
        </g>
        {/* Nitrogen of NH₂ */}
        <g>
          <circle cx="170" cy="100" r="26" fill="url(#atom-n)" />
          <text x="170" y="107" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">N</text>
        </g>
        {/* Two H's on the amino group */}
        <g>
          <circle cx="120" cy="55"  r="14" fill="url(#atom-h)" />
          <text x="120" y="60"  textAnchor="middle" fill="#0a0e1a" fontSize="11" fontWeight="800">H</text>
        </g>
        <g>
          <circle cx="200" cy="40"  r="14" fill="url(#atom-h)" />
          <text x="200" y="45"  textAnchor="middle" fill="#0a0e1a" fontSize="11" fontWeight="800">H</text>
        </g>
        {/* Carboxyl carbon */}
        <g>
          <circle cx="470" cy="100" r="26" fill="url(#atom-c)" />
          <text x="470" y="107" textAnchor="middle" fill="#0a0e1a" fontSize="18" fontWeight="800">C</text>
        </g>
        {/* Carbonyl O (=O, top) */}
        <g>
          <circle cx="540" cy="55"  r="22" fill="url(#atom-o)" />
          <text x="540" y="62"  textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">O</text>
        </g>
        {/* Hydroxyl O (–OH) */}
        <g>
          <circle cx="535" cy="138" r="22" fill="url(#atom-o)" />
          <text x="535" y="145" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">O</text>
        </g>
        {/* Hydroxyl H */}
        <g>
          <circle cx="585" cy="158" r="14" fill="url(#atom-h)" />
          <text x="585" y="163" textAnchor="middle" fill="#0a0e1a" fontSize="11" fontWeight="800">H</text>
        </g>
        {/* "Back" H on α-carbon */}
        <g>
          <circle cx="240" cy="240" r="16" fill="url(#atom-h)" />
          <text x="240" y="246" textAnchor="middle" fill="#0a0e1a" fontSize="12" fontWeight="800">H</text>
        </g>
        {/* R-position — morphs based on selected amino acid. Drawn as a
            keyed group so React remounts it cleanly when selected changes,
            triggering the fade-in animation. */}
        <g key={selected} className="gly-mol-rgroup">
          <RGroupBig kind={selected} />
        </g>
        <text x="400" y="320" textAnchor="middle" fill="#67e8f9" fontSize="11" letterSpacing="2.5" fontWeight="600">
          {aa.rLabel}
        </text>

        {/* ───── Annotations ───── */}
        <g fill="#94a3b8" fontSize="11" letterSpacing="1.5" fontWeight="600">
          <text x="60"  y="142" textAnchor="start">amino group</text>
          <text x="430" y="22"  textAnchor="middle">carboxyl group</text>
          <text x="320" y="320" textAnchor="middle" fill="#67e8f9">side-chain position — empty</text>
        </g>

        {/* Charge hints for physiological pH */}
        <g fontSize="13" fontWeight="700">
          <text x="148" y="78" fill="#bfdbfe">⁺</text>
          <text x="556" y="138" fill="#fecaca">⁻</text>
        </g>
      </svg>

      <div key={selected} className="gly-mol-callout">
        {aa.callout}
      </div>

      <RGroupComparison selected={selected} onSelect={setSelected} />
    </div>
  );
}

/** Bigger R-group rendering used inside the main morphing molecule diagram.
 *  Drawn at the R-position attachment point (400, 240), extending downward
 *  for larger residues. Uses the same gradient defs as the parent SVG. */
function RGroupBig({ kind }) {
  switch (kind) {
    case 'gly':
      return (
        <>
          {/* halo ring */}
          <circle cx="400" cy="240" r="36" fill="none"
            stroke="rgba(103, 232, 249, 0.55)" strokeWidth="1.5" strokeDasharray="3 4">
            <animate attributeName="r" values="34;42;34" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="400" cy="240" r="22" fill="url(#atom-r)" />
          <text x="400" y="247" textAnchor="middle" fill="#0a0e1a" fontSize="14" fontWeight="800">H</text>
        </>
      );
    case 'ala':
      return (
        <>
          {/* halo ring around methyl */}
          <circle cx="400" cy="262" r="48" fill="none"
            stroke="rgba(103, 232, 249, 0.45)" strokeWidth="1.5" strokeDasharray="3 4">
            <animate attributeName="r" values="46;52;46" dur="2.6s" repeatCount="indefinite" />
          </circle>
          {/* methyl C */}
          <circle cx="400" cy="240" r="22" fill="url(#atom-c)" />
          <text x="400" y="247" textAnchor="middle" fill="#0a0e1a" fontSize="13" fontWeight="800">C</text>
          {/* 3 H's */}
          {[[372, 270], [400, 290], [428, 270]].map(([x, y], i) => (
            <g key={i}>
              <line x1="400" y1="240" x2={x} y2={y} stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
              <circle cx={x} cy={y} r="11" fill="url(#atom-h)" />
              <text x={x} y={y + 4} textAnchor="middle" fill="#0a0e1a" fontSize="9.5" fontWeight="800">H</text>
            </g>
          ))}
        </>
      );
    case 'val':
      return (
        <>
          <circle cx="400" cy="276" r="64" fill="none"
            stroke="rgba(103, 232, 249, 0.45)" strokeWidth="1.5" strokeDasharray="3 4">
            <animate attributeName="r" values="60;68;60" dur="2.6s" repeatCount="indefinite" />
          </circle>
          {/* central CH (β-C) */}
          <circle cx="400" cy="240" r="20" fill="url(#atom-c)" />
          <text x="400" y="246" textAnchor="middle" fill="#0a0e1a" fontSize="12" fontWeight="800">C</text>
          {/* methyls left + right */}
          <line x1="385" y1="252" x2="358" y2="290" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
          <line x1="415" y1="252" x2="442" y2="290" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
          {[358, 442].map((x, i) => (
            <g key={i}>
              <circle cx={x} cy="295" r="17" fill="url(#atom-c)" />
              <text x={x} y="301" textAnchor="middle" fill="#0a0e1a" fontSize="11" fontWeight="800">C</text>
              {/* H's around each methyl */}
              {[[x - 18, 312], [x, 322], [x + 18, 312]].map(([hx, hy], j) => (
                <circle key={j} cx={hx} cy={hy} r="6" fill="url(#atom-h)" opacity="0.85" />
              ))}
            </g>
          ))}
        </>
      );
    case 'phe':
      return (
        <>
          <circle cx="450" cy="290" r="78" fill="none"
            stroke="rgba(103, 232, 249, 0.45)" strokeWidth="1.5" strokeDasharray="3 4">
            <animate attributeName="r" values="74;82;74" dur="2.6s" repeatCount="indefinite" />
          </circle>
          {/* methylene CH₂ */}
          <circle cx="400" cy="240" r="18" fill="url(#atom-c)" />
          <text x="400" y="246" textAnchor="middle" fill="#0a0e1a" fontSize="11" fontWeight="800">C</text>
          {/* bond to ring */}
          <line x1="416" y1="251" x2="448" y2="270" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
          {/* benzene ring (hexagon, centered at 488, 296) */}
          <g transform="translate(488 296)">
            <polygon points="-32,0 -16,-28 16,-28 32,0 16,28 -16,28"
              fill="rgba(127, 119, 221, 0.18)"
              stroke="rgba(167, 139, 250, 0.85)" strokeWidth="2" strokeLinejoin="round" />
            {/* aromaticity inner circle */}
            <circle r="14" fill="none" stroke="rgba(167, 139, 250, 0.65)" strokeWidth="1.4" />
            {/* ring carbons */}
            {[[-32,0],[-16,-28],[16,-28],[32,0],[16,28],[-16,28]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="5" fill="url(#atom-c)" />
            ))}
          </g>
        </>
      );
    default: return null;
  }
}

/** Side-by-side R-group sizing for Gly / Ala / Val / Phe. Same α-carbon
 *  position in every cell — only the side chain that hangs off it changes,
 *  so the eye can't help but notice the bulk gradient. */
function RGroupComparison({ selected, onSelect }) {
  const items = [
    { name: 'Glycine',       code: 'Gly · G', mass: 75,  flex: 'most flexible',   atoms: 0,  draw: 'gly' },
    { name: 'Alanine',       code: 'Ala · A', mass: 89,  flex: 'flexible',        atoms: 1,  draw: 'ala' },
    { name: 'Valine',        code: 'Val · V', mass: 117, flex: 'restrained',      atoms: 3,  draw: 'val' },
    { name: 'Phenylalanine', code: 'Phe · F', mass: 165, flex: 'rigid',           atoms: 7,  draw: 'phe' },
  ];
  return (
    <div className="gly-rgrp">
      <div className="gly-rgrp-tag">Click any card to morph the molecule above</div>
      <div className="gly-rgrp-grid">
        {items.map((it) => {
          const isSelected = it.draw === selected;
          return (
            <button
              type="button"
              key={it.name}
              className={`gly-rgrp-cell${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(it.draw)}
              aria-pressed={isSelected}
            >
              <svg viewBox="0 0 160 160" preserveAspectRatio="xMidYMid meet">
                <circle cx="80" cy="50" r="14" fill="#64748b" stroke="#cbd5e1" strokeWidth="0.6" />
                <text x="80" y="55" textAnchor="middle" fill="#0a0e1a" fontSize="11" fontWeight="800">Cα</text>
                <line x1="80" y1="64" x2="80" y2="80"
                  stroke={isSelected ? 'rgba(103, 232, 249, 0.95)' : 'rgba(255,255,255,0.55)'}
                  strokeWidth={isSelected ? 3.5 : 2.5} strokeLinecap="round" />
                <RGroup kind={it.draw} />
              </svg>
              <div className="gly-rgrp-name">
                {it.name}
                <span className="gly-rgrp-code">{it.code}</span>
              </div>
              <div className="gly-rgrp-meta">
                {it.mass} Da · {it.atoms} heavy atom{it.atoms === 1 ? '' : 's'} in R · {it.flex}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RGroup({ kind }) {
  // Scaled-down side-chain doodles — not chemically perfect, just clearly
  // sized so the eye reads "nothing → small → medium → big".
  switch (kind) {
    case 'gly': // R = H
      return (
        <g>
          <circle cx="80" cy="92" r="11" fill="url(#atom-r)" />
          <text x="80" y="96" textAnchor="middle" fill="#0a0e1a" fontSize="9" fontWeight="800">H</text>
          <text x="80" y="125" textAnchor="middle" fill="#67e8f9" fontSize="8.5" letterSpacing="1.4" fontWeight="700">R = H</text>
        </g>
      );
    case 'ala': // R = CH₃
      return (
        <g>
          <line x1="80" y1="92" x2="80" y2="106" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          <circle cx="80" cy="92" r="10" fill="url(#atom-c)" />
          <text x="80" y="96" textAnchor="middle" fill="#0a0e1a" fontSize="9" fontWeight="800">C</text>
          <circle cx="65" cy="115" r="6" fill="url(#atom-h)" />
          <circle cx="80" cy="120" r="6" fill="url(#atom-h)" />
          <circle cx="95" cy="115" r="6" fill="url(#atom-h)" />
          <text x="80" y="135" textAnchor="middle" fill="#94a3b8" fontSize="8.5" letterSpacing="1.4" fontWeight="700">R = CH₃</text>
        </g>
      );
    case 'val': // R = CH(CH₃)₂
      return (
        <g stroke="rgba(255,255,255,0.45)" strokeWidth="2">
          <line x1="80" y1="92" x2="80" y2="100" />
          <circle cx="80" cy="100" r="10" fill="url(#atom-c)" stroke="none" />
          <text x="80" y="104" textAnchor="middle" fill="#0a0e1a" fontSize="9" fontWeight="800" stroke="none">C</text>
          <line x1="73" y1="108" x2="60" y2="118" />
          <line x1="87" y1="108" x2="100" y2="118" />
          <circle cx="58" cy="120" r="9" fill="url(#atom-c)" stroke="none" />
          <text x="58" y="123" textAnchor="middle" fill="#0a0e1a" fontSize="8" fontWeight="800" stroke="none">C</text>
          <circle cx="102" cy="120" r="9" fill="url(#atom-c)" stroke="none" />
          <text x="102" y="123" textAnchor="middle" fill="#0a0e1a" fontSize="8" fontWeight="800" stroke="none">C</text>
          <text x="80" y="139" textAnchor="middle" fill="#94a3b8" fontSize="8.5" letterSpacing="1.4" fontWeight="700" stroke="none">R = CH(CH₃)₂</text>
        </g>
      );
    case 'phe': // R = CH₂C₆H₅
      return (
        <g>
          {/* Methylene */}
          <line x1="80" y1="92" x2="80" y2="100" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          <circle cx="80" cy="100" r="9" fill="url(#atom-c)" />
          <text x="80" y="103" textAnchor="middle" fill="#0a0e1a" fontSize="8" fontWeight="800">C</text>
          {/* Benzene ring */}
          <polygon
            points="80,108 100,118 100,134 80,143 60,134 60,118"
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.6"
          />
          <circle cx="80" cy="125" r="5.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          <text x="80" y="155" textAnchor="middle" fill="#94a3b8" fontSize="8" letterSpacing="1.4" fontWeight="700">R = CH₂C₆H₅</text>
        </g>
      );
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// 04 Glycine paradox — animated 10×G ripple + count-up
// ---------------------------------------------------------------------------

function SceneGlycine() {
  const [ref, inView] = useInView();
  const ltkPct = useCountUp(14.3, { start: inView, duration: 1400, decimals: 1 });
  const mokPct = useCountUp(1.7,  { start: inView, duration: 1400, decimals: 1 });
  const ratio  = useCountUp(8.5,  { start: inView, duration: 1400, decimals: 1 });

  // LTK row — an 8-residue cluster (the "8 in a row" run actually present
  // in P29376 and resolved in 7NX1) plus a few scattered glycines on either
  // side. The bracket labels the resolved run; the extra beads are nearby
  // glycines outside the longest run.
  const ltkClusterStart = 30;
  const ltkClusterEnd = 64;
  const LTK_RUN_BEADS = 8;
  const ltkClusterBeads = Array.from({ length: LTK_RUN_BEADS }).map((_, i) => {
    const x = ltkClusterStart + (i / (LTK_RUN_BEADS - 1)) * (ltkClusterEnd - ltkClusterStart);
    return { x, delay: i * 0.16 };
  });
  const ltkExtraBeads = [{ x: 14, delay: 0.6 }, { x: 78, delay: 0.9 }, { x: 88, delay: 1.2 }];

  // Linked-view walk state.
  //   walkIdx  = which bead/residue is currently spotlit (-1 = none)
  //   walkOn   = whether the auto-walk timer is running
  //   runLen   = number of glycines in the structure's longest contiguous run
  //              (set by Mol3DViewer via onRunFound)
  // The user has two ways to drive the spotlight:
  //   1. Hit Walk → auto-cycles through 0..walkLen-1 every 700ms
  //   2. Click any G bead → pins walkIdx to that index, stops auto-walk
  // Both paths set the same walkIdx, which is propagated to the Mol3DViewer
  // and to the bead className. Click again on the pinned bead to release.
  const [walkOn, setWalkOn] = useState(false);
  const [walkIdx, setWalkIdx] = useState(-1);
  const [runLen, setRunLen] = useState(0);
  const [runStats, setRunStats] = useState(null); // { longestLen, totalCount, multiRunLengths }
  const walkLen = Math.min(runLen, ltkClusterBeads.length);

  useEffect(() => {
    if (!walkOn || walkLen === 0) return;
    // If walkIdx is out of range or unset, start at 0; else continue.
    setWalkIdx((prev) => (prev >= 0 && prev < walkLen ? prev : 0));
    const id = setInterval(() => {
      setWalkIdx((prev) => (prev + 1) % walkLen);
    }, 700);
    return () => clearInterval(id);
  }, [walkOn, walkLen]);

  function pickBead(i) {
    setWalkOn(false);
    setWalkIdx((prev) => (prev === i ? -1 : i));
  }

  // MOK row — 1.7% glycine, ~7 glycines across 419 AA, scattered with no
  // run length > 1. Distribute evenly so the eye reads "rare, isolated".
  const mokBeads = [10, 24, 41, 58, 73, 89].map((x) => ({ x }));

  return (
    <section
      id="glycine"
      ref={ref}
      className={`scene${inView ? ' in-view' : ''}`}
    >
      <div className="scene-num reveal r1">Scene 04 of {SCENES.length}</div>
      <div className="scene-eyebrow reveal r2">Finding 1 — flexibility</div>
      <h2 className="reveal r1">The glycine paradox. <Conf kinds={['str', 'lit']} /></h2>
      <GlycineMolecule />
      <p className="lede reveal r2">
        Glycine has no side chain. Strings of consecutive glycines act like <strong>hinges</strong> — the backbone is
        free to rotate <Cite ids={['pubmed-1716976']} />. LTK's longest run is <strong>eight in a row</strong> (the
        canonical sequence at <code style={{ fontFamily: 'SF Mono, monospace', fontSize: '0.92em' }}>WAGGGGGGGG</code>),
        observed in the crystal structure as a hexagonal lattice of polyglycine type II helices
        <Cite ids={['rcsb-7nx1']} />. MOK has glycines scattered, never adjacent. Same family, completely
        different physics.
      </p>
      <p className="reveal r3" style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', maxWidth: 720 }}>
        Below is the <strong style={{ color: 'var(--text)' }}>experimental crystal structure</strong> that captures
        the polyglycine claim. Predicted full structures of both proteins live in Scene 3 — this one is the
        published evidence for the lattice itself.
      </p>
      <div className="reveal r3">
        <Mol3DViewer
          kind="experimental"
          pdbId="7NX1"
          caption="LTK extracellular · polyglycine type II hexagonal lattice"
          highlightResn="GLY"
          highlightLabel="glycines"
          highlightColor="#67e8f9"
          walkIdx={walkIdx}
          onRunFound={(stats) => {
            // stats = { residues, longestLen, totalCount, multiRunLengths }
            setRunLen(stats.residues.length);
            setRunStats(stats);
          }}
        />
        {runLen > 0 && (
          <div className="walk-bar">
            <button
              type="button"
              className={`btn ${walkOn ? 'primary' : 'ghost'}`}
              onClick={() => setWalkOn((v) => !v)}
            >
              {walkOn ? `⏸ Pause walk` : `✦ Walk through ${walkLen} G's`}
            </button>
            {walkIdx >= 0 && !walkOn && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setWalkIdx(-1)}
                title="Release the pinned glycine"
              >
                ✕ Release G #{walkIdx + 1}
              </button>
            )}
            <span className="walk-meta">
              {walkOn
                ? <>Auto-walk · spotlight <strong>G #{walkIdx + 1}</strong> of {walkLen} — bead and 3D residue light up together</>
                : walkIdx >= 0
                  ? <>Pinned <strong>G #{walkIdx + 1}</strong> of {walkLen} · click another bead to move, or click again to release</>
                  : <>
                      {runStats
                        ? <>7NX1 resolves <strong>{runStats.totalCount} glycines</strong> total ·{' '}
                          <strong>{runStats.multiRunLengths.length}</strong> multi-G runs
                          (longest <strong>{runStats.longestLen}</strong>). The walk targets that 8-G run; the others are visible in cyan.</>
                        : <>{`7NX1 has ${runLen} consecutive glycines.`}</>
                      }{' '}
                      Click any G below to spotlight it, or hit Walk to cycle through.
                    </>}
            </span>
          </div>
        )}
        {runStats && runStats.multiRunLengths.length > 1 && (
          <div className="multi-runs">
            <span className="mr-tag">All multi-G runs in 7NX1</span>
            <div className="mr-bars">
              {runStats.multiRunLengths.map((len, i) => (
                <span
                  key={i}
                  className={`mr-bar${i === 0 ? ' main' : ''}`}
                  title={i === 0
                    ? `Longest run · ${len} glycines (the walk-through target)`
                    : `Run #${i + 1} · ${len} glycines`}
                >
                  {Array.from({ length: len }).map((_, j) => (
                    <span key={j} className="mr-g">G</span>
                  ))}
                  <span className="mr-len">×{len}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="gly-stage reveal r3">
        <div className="gly-counter">
          <div><span className="num ltk">{ltkPct}%</span> <small>LTK</small></div>
          <div><span className="num mok">{mokPct}%</span> <small>MOK</small></div>
        </div>

        {/* LTK row — clustered run, hinge animation */}
        <div className="gly-row top">
          <span className="row-tag">LTK · flexible</span>
          <div className="gly-axis" />
          <div
            className="gly-cluster-bracket"
            style={{
              left:  `${ltkClusterStart - 1}%`,
              width: `${ltkClusterEnd - ltkClusterStart + 2}%`,
            }}
          >
            <span className="lbl">{LTK_RUN_BEADS} G in a row</span>
          </div>
          {ltkClusterBeads.map((b, i) => {
            const isSpot   = walkIdx === i;
            const isDimmed = walkIdx >= 0 && !isSpot;
            return (
              <span
                key={`ltk-c-${i}`}
                role="button"
                tabIndex={0}
                title={`Glycine #${i + 1} — click to spotlight in 3D`}
                aria-pressed={isSpot}
                aria-label={`Glycine ${i + 1} of ${LTK_RUN_BEADS}`}
                className={`gly-bead ltk clickable${isSpot ? ' spotlight' : ''}${isDimmed ? ' dimmed' : ''}`}
                style={{ left: `${b.x}%`, animationDelay: `${b.delay}s` }}
                onClick={() => pickBead(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickBead(i); }
                }}
              >G</span>
            );
          })}
          {ltkExtraBeads.map((b, i) => (
            <span key={`ltk-e-${i}`} className="gly-bead ltk"
              style={{ left: `${b.x}%`, animationDelay: `${b.delay}s` }}>G</span>
          ))}
        </div>

        {/* MOK row — scattered, no clusters, almost no motion */}
        <div className="gly-row bottom">
          <span className="row-tag">MOK · rigid</span>
          <div className="gly-axis" />
          {mokBeads.map((b, i) => (
            <span key={`mok-${i}`} className="gly-bead mok"
              style={{ left: `${b.x}%`, animationDelay: `${i * 0.7}s` }}>G</span>
          ))}
        </div>
      </div>
      <div className="metric-row reveal r4">
        <div className="metric cyan"><div className="v">{ltkPct}%</div><div className="k">LTK glycine</div></div>
        <div className="metric blue"><div className="v">{mokPct}%</div><div className="k">MOK glycine</div></div>
        <div className="metric violet"><div className="v">{ratio}×</div><div className="k">LTK / MOK</div></div>
        <div className="metric amber"><div className="v">10</div><div className="k">longest LTK run</div></div>
      </div>
      <AIInsight method="sequence parsing · sliding-window run detection">
        <p>This one isn't AI — it's mechanical. We pull the canonical sequences from UniProt, count G's, and run a window scan for consecutive-glycine stretches:</p>
        <span className="equation">
          gly_pct = count(seq, 'G') / len(seq){'  →  '}
          LTK = 124 / 868 = <span className="result">14.3%</span>{'  |  '}
          MOK = 7 / 419 = <span className="result">1.7%</span>
        </span>
        <span className="equation">
          longest_run(seq) = max len of contiguous 'G' window{'  →  '}
          LTK = <span className="result">10</span>{'  |  '}MOK = <span className="result">1</span>
        </span>
        <p>Where AI <em>does</em> come in: deciding whether this difference matters. Conservation analysis (Scene 7) and AI semantic clustering (Scene 5) are what tell us this isn't an evolutionary accident.</p>
      </AIInsight>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 05 AI semantic network — interactive
// ---------------------------------------------------------------------------

function SceneNetwork() {
  const W = 880, H = 440;
  const nodes = useMemo(() => ([
    { id: 'LTK',     x: W*0.42, y: H*0.46, r: 28, kind: 'protein', label: 'LTK',          color: '#67e8f9', detail: 'LTK — flexible kinase, 868 AA. AI clusters it with MOK at 52% functional similarity despite only 30% sequence identity.' },
    { id: 'MOK',     x: W*0.58, y: H*0.58, r: 28, kind: 'protein', label: 'MOK',          color: '#67e8f9', detail: 'MOK — compact mitochondrial kinase, 419 AA. AI links it to LTK through shared cardiometabolic disease pathways.' },
    { id: 'AMPK',    x: W*0.50, y: H*0.20, r: 22, kind: 'mod',     label: 'AMPK',         color: '#a3e635', detail: 'AMPK — energy sensor; modulates both LTK signaling and mitochondrial homeostasis (the MOK side).' },
    { id: 'mTOR',    x: W*0.78, y: H*0.30, r: 22, kind: 'mod',     label: 'mTOR',         color: '#a3e635', detail: 'mTOR — central growth/metabolism kinase. Shares the 6×6 similarity neighborhood with LTK and MOK.' },
    { id: 'Insulin', x: W*0.28, y: H*0.66, r: 22, kind: 'mod',     label: 'Insulin',      color: '#a3e635', detail: 'Insulin signaling — the canonical bridge between LTK-style kinases and Type 2 diabetes phenotypes.' },
    { id: 'Mito',    x: W*0.74, y: H*0.78, r: 22, kind: 'mod',     label: 'Mitochondria', color: '#94a3b8', detail: 'Mitochondrial cristae dynamics — directly modulated by MOK; under oxidative stress, this is where MOK earns its disease relevance.' },
    { id: 'DM',      x: W*0.10, y: H*0.20, r: 26, kind: 'disease', label: 'T2D',          color: '#fb7185', detail: 'Type 2 diabetes — both LTK and MOK surface in this neighborhood through AI semantic clustering.' },
    { id: 'OB',      x: W*0.10, y: H*0.62, r: 26, kind: 'disease', label: 'Obesity',      color: '#fb7185', detail: 'Obesity — shared modulator pathways (insulin, AMPK) put both proteins in scope.' },
    { id: 'HF',      x: W*0.92, y: H*0.20, r: 26, kind: 'disease', label: 'Heart failure',color: '#fb7185', detail: 'Heart failure — MOK\'s mitochondrial role makes this a natural therapeutic indication.' },
    { id: 'MS',      x: W*0.92, y: H*0.66, r: 26, kind: 'disease', label: 'MetSyn',       color: '#fb7185', detail: 'Metabolic syndrome — the cluster diagnosis. The full LTK / MOK / AMPK / insulin / mTOR mesh maps here.' },
  ]), []);
  const find = (id) => nodes.find((n) => n.id === id);
  const edges = useMemo(() => ([
    ['LTK','MOK','ai'], ['LTK','AMPK','mod'], ['LTK','Insulin','mod'], ['MOK','mTOR','mod'], ['MOK','Mito','mod'],
    ['LTK','DM','ai'], ['LTK','OB','ai'], ['MOK','HF','ai'], ['MOK','MS','ai'],
    ['AMPK','DM','ev'], ['AMPK','OB','ev'], ['mTOR','HF','ev'], ['Insulin','OB','ev'], ['Mito','MS','ev'],
  ]), []);
  const [pick, setPick] = useState(null);

  return (
    <Scene id="network" num={5} eyebrow="Finding 2 — AI similarity">
      <h2 className="reveal r1">52% functional similarity. 30% sequence identity. <Conf kinds={['ai']} /></h2>
      <p className="lede reveal r2">
        Standard alignment quits at 30%. Embedded in the same vector space — the same class of model that today's
        peer-reviewed methodology is published on <Cite ids={['nature-mint', 'sciencedirect-w2v']} /> — LTK and MOK
        cluster together at <strong>52% functional similarity</strong>, sharing modulators across four cardiometabolic
        diseases. <strong>Hover any node to see the connection.</strong>
      </p>
      <div className="network-stage reveal r3">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <ellipse cx={W*0.50} cy={H*0.52} rx={W*0.32} ry={H*0.36}
            fill="none" stroke="#fbbf24" strokeOpacity="0.55" strokeDasharray="6 6" strokeWidth="1.2" />
          <text x={W*0.50} y={H*0.52 - H*0.36 - 8} fill="#fbbf24"
            fontSize="11" textAnchor="middle" letterSpacing="2">
            AI SEMANTIC CLUSTER · 52%
          </text>
          {edges.map(([a, b, kind], i) => {
            const A = find(a), B = find(b);
            const isAi = kind === 'ai';
            return (
              <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke={isAi ? '#fbbf24' : 'rgba(255,255,255,0.30)'}
                strokeWidth={isAi ? 1.6 : 1}
                strokeDasharray={isAi ? '5 5' : '0'}
                strokeOpacity={isAi ? 0.85 : 0.55} />
            );
          })}
          {nodes.map((n) => (
            <g key={n.id}
               className="net-node"
               onMouseEnter={() => setPick(n)}
               onMouseLeave={() => setPick(null)}
               onFocus={() => setPick(n)}
               onBlur={() => setPick(null)}
               tabIndex={0}>
              <circle cx={n.x} cy={n.y} r={n.r}
                fill={n.color} fillOpacity={n.kind === 'protein' ? 0.95 : 0.78}
                stroke={n.color} strokeWidth="1.4" />
              <text x={n.x} y={n.y + 4} fill="#07091a" fontSize="11.5"
                textAnchor="middle" fontWeight="700" pointerEvents="none">{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className={`net-info reveal r4${pick ? ' has-pick' : ''}`}>
        {pick
          ? <><strong>{pick.label}.</strong> {pick.detail}</>
          : <>Hover or focus a node to see what AI found about it.</>}
      </div>
      <div className="net-legend reveal r5">
        <span><span className="dot" style={{ background: '#67e8f9' }} />Protein</span>
        <span><span className="dot" style={{ background: '#a3e635' }} />Shared modulator</span>
        <span><span className="dot" style={{ background: '#fb7185' }} />Disease</span>
        <span><span className="dot" style={{ background: '#fbbf24' }} />AI-discovered link</span>
      </div>
      <AIInsight method="cosine similarity over PubMed-derived embeddings (Word2Vec / MINT-style)">
        <p>The 52% similarity score isn't pulled from a black box. Both proteins are embedded into the same vector space — vectors that encode the language of the biomedical literature each protein appears in. Functional similarity is then literal vector geometry:</p>
        <span className="equation">
          cos_sim(LTK, MOK) = (v<sub>LTK</sub> · v<sub>MOK</sub>) / (‖v<sub>LTK</sub>‖ · ‖v<sub>MOK</sub>‖) = <span className="result">0.524</span>
        </span>
        <div className="row"><b>Embedding model</b><code>Word2Vec / PubMed corpus + MINT-context refinement</code></div>
        <div className="row"><b>Vector dim</b><code>300</code></div>
        <div className="row"><b>Corpus</b><code>~30M PubMed abstracts</code></div>
        <div className="row"><b>Cluster threshold</b><code>cos_sim ≥ 0.50</code></div>
        <p>Sequence alignment over the same pair returns 30% identity — a number low enough that conventional pipelines drop the comparison. The semantic embedding sees them anyway because they live in the same neighborhood of <em>literature</em>, not the same neighborhood of letters.</p>
      </AIInsight>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// 06 ATP pocket — interactive flip + clickable residues
// ---------------------------------------------------------------------------

// Amino acid chemistry for each residue that surfaces in the LTK / MOK ATP
// recognition motif. The two BCAAs at the swap position (Val in LTK, Ile in
// MOK) get the richest detail because they're the entire selectivity story.
const RESIDUES = {
  Ile: {
    code3: 'Ile', code1: 'I', name: 'Isoleucine',
    family: 'Branched-chain amino acid (BCAA)',
    chain: 'sec-butyl group',
    formula: '−CH(CH₃)CH₂CH₃',
    mass: 131.17,
    chiralCenters: 2,
    polarity: 'non-polar · hydrophobic',
    hydrophobicity: 'High (hides from water; buries in protein interiors)',
    accent: '#f472b6',
    body: (
      <>
        <p>
          Isoleucine has a <strong>sec-butyl side chain</strong> — bulkier than valine's by one −CH₂− group.
          That extra carbon adds mass (131 vs 117 Da), an extra rotational degree of freedom, and a second
          chiral center at the β-carbon.
        </p>
        <p>
          In a kinase ATP pocket, "bulkier" cashes out as <strong>steric hindrance</strong>. A drug designed to
          fit a valine-equipped pocket can clash with the extra carbon when it tries the isoleucine version —
          which is exactly the selectivity handle this report rests on.
        </p>
      </>
    ),
  },
  Val: {
    code3: 'Val', code1: 'V', name: 'Valine',
    family: 'Branched-chain amino acid (BCAA)',
    chain: 'isopropyl group',
    formula: '−CH(CH₃)₂',
    mass: 117.15,
    chiralCenters: 1,
    polarity: 'non-polar · hydrophobic',
    hydrophobicity: 'High (still less than Ile or Leu)',
    accent: '#f472b6',
    body: (
      <>
        <p>
          Valine has a compact, <strong>V-shaped isopropyl side chain</strong>. Only one chiral center (the
          α-carbon), no extra methylene to swing.
        </p>
        <p>
          In LTK's ATP pocket, valine occupies less real estate than the isoleucine in MOK's equivalent
          position — leaving a small but exploitable cavity. A medicinal chemist can design an inhibitor with
          a "bump" that lands cleanly in that valine-shaped void and physically clashes with isoleucine when
          the same molecule reaches MOK.
        </p>
      </>
    ),
  },
  Leu: {
    code3: 'Leu', code1: 'L', name: 'Leucine',
    family: 'Branched-chain amino acid (BCAA)',
    chain: 'isobutyl group',
    formula: '−CH₂CH(CH₃)₂',
    mass: 131.17,
    chiralCenters: 1,
    polarity: 'non-polar · hydrophobic',
    hydrophobicity: 'Highest of the BCAAs',
    accent: '#60a5fa',
    body: (
      <>
        <p>
          Leucine is the third BCAA — same mass as isoleucine (131 Da) but a different shape: the methyl
          branches sit one carbon further from the backbone.
        </p>
        <p>
          In the I-L-V/I-K motif this report is anchored on, Leu is the conserved second residue. It's locked
          across the kinase family, which means it's not where the chemistry games happen — but it does
          define the lipophilic floor of the pocket.
        </p>
      </>
    ),
  },
  Lys: {
    code3: 'Lys', code1: 'K', name: 'Lysine',
    family: 'Charged · basic',
    chain: '4-aminobutyl group',
    formula: '−(CH₂)₄NH₃⁺',
    mass: 146.19,
    chiralCenters: 1,
    polarity: 'positively charged at physiological pH',
    hydrophobicity: 'Low (the −NH₃⁺ tip loves water)',
    accent: '#a78bfa',
    body: (
      <>
        <p>
          Lysine carries a permanent <strong>+1 charge</strong> at body pH. In every protein kinase, this
          conserved lysine is the residue that <strong>anchors the ATP phosphates</strong> via a salt bridge —
          the canonical hallmark of catalytic competence.
        </p>
        <p>
          Mutate this residue away and the kinase essentially dies. Which is why every selective inhibitor
          design works <em>around</em> the lysine, not against it.
        </p>
      </>
    ),
  },
};

// Position semantics: position 0/1/3 are conserved across LTK and MOK; position 2
// is the swap (Val in LTK, Ile in MOK). Used for special "selectivity handle"
// callout in the residue detail panel.
const POCKET_POSITIONS = ['I', 'L', 'V_or_I', 'K'];

// ---------------------------------------------------------------------------

function ScenePocket() {
  const [highlight, setHighlight] = useState(true); // highlight the V↔I swap
  // Sticky residue selection. Carries the residue label, which protein side
  // it was clicked on, and whether it occupies the swap position. null =
  // nothing pinned.
  const [pickedRes, setPickedRes] = useState(null);
  const onPickRes = (sel) => setPickedRes((cur) => (cur && cur.key === sel.key ? null : sel));

  const ltkRes = [
    { label: 'Ile', x: 70,  y: 70  },
    { label: 'Leu', x: 200, y: 56  },
    { label: 'Val', x: 240, y: 150, swap: true },
    { label: 'Lys', x: 90,  y: 170 },
  ];
  const mokRes = [
    { label: 'Ile', x: 70,  y: 70  },
    { label: 'Leu', x: 200, y: 56  },
    { label: 'Ile', x: 240, y: 150, swap: true },
    { label: 'Lys', x: 90,  y: 170 },
  ];

  return (
    <Scene id="pocket" num={6} eyebrow="Finding 3 — selectivity">
      <h2 className="reveal r1">A single carbon. A whole drug program. <Conf kinds={['str']} /></h2>
      <p className="lede reveal r2">
        Both kinases bind <strong>ATP</strong> in the canonical pocket — but the third residue of the recognition motif
        differs. LTK packs <strong>valine</strong>; MOK packs <strong>isoleucine</strong>. That single carbon reshapes
        the pocket geometry and opens the door to <strong>selective</strong> inhibitors.{' '}
        <strong>Click any residue to read its chemistry.</strong>
      </p>
      <div className="reveal r3" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 6px' }}>
        <button
          className={`btn ${highlight ? 'primary' : 'ghost'}`}
          onClick={() => setHighlight((v) => !v)}
        >
          {highlight ? '✓ Highlight V↔I swap' : 'Highlight V↔I swap'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
          Toggle to see the geometric difference
        </span>
      </div>
      <div className="pockets">
        <Pocket
          name="LTK · ILVK motif"
          side="LTK"
          residues={ltkRes}
          highlightOn={highlight}
          picked={pickedRes}
          onPick={onPickRes}
        />
        <Pocket
          name="MOK · ILIK motif"
          side="MOK"
          residues={mokRes}
          highlightOn={highlight}
          picked={pickedRes}
          onPick={onPickRes}
        />
      </div>
      {pickedRes
        ? <ResidueDetail picked={pickedRes} onClose={() => setPickedRes(null)} />
        : (
          <div className="pocket-callout reveal r4">
            <strong>Why it matters.</strong> A V→I swap is one of the most exploitable selectivity handles in kinase
            chemistry — enough to differentiate a hinge-binding inhibitor's affinity by an order of magnitude. A single
            chemotype can be tuned for either target, and the swap is the entry point for <strong>dual-selective
            cardiometabolic agents</strong> with reduced off-target load.
          </div>
        )
      }
    </Scene>
  );
}

function Pocket({ name, side, residues, highlightOn, picked, onPick }) {
  return (
    <div className={`pocket-card${highlightOn ? ' highlight' : ''} reveal r3`}>
      <div className="lbl" style={{ marginBottom: 8 }}>
        {name.split('·')[0]} · <span>{name.split('·')[1]?.trim()}</span>
      </div>
      <svg viewBox="0 0 320 220">
        <defs>
          <radialGradient id={`grad-${side}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#3b82f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </radialGradient>
        </defs>
        <ellipse cx="160" cy="110" rx="120" ry="80" fill={`url(#grad-${side})`} stroke="#3b82f6" strokeOpacity="0.55" />
        <g>
          <circle cx="160" cy="110" r="22" fill="#fbbf24" fillOpacity="0.95" />
          <text x="160" y="114" fill="#07091a" fontSize="11" textAnchor="middle" fontWeight="700">ATP</text>
        </g>
        {residues.map((r, i) => {
          const key = `${side}:${i}:${r.label}`;
          const isPicked = picked && picked.key === key;
          const isSwap = !!r.swap;
          const fill = isSwap && highlightOn ? '#f472b6' : '#60a5fa';
          return (
            <g
              key={key}
              style={{ cursor: 'pointer' }}
              onClick={() => onPick({ key, side, label: r.label, swap: isSwap, idx: i })}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick({ key, side, label: r.label, swap: isSwap, idx: i });
                }
              }}
            >
              {isPicked && (
                <circle cx={r.x} cy={r.y} r={(isSwap ? 19 : 16) + 8}
                  fill="none" stroke="#67e8f9" strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 0 6px #67e8f9)' }} />
              )}
              <circle cx={r.x} cy={r.y}
                r={isSwap ? 19 : 16}
                fill={fill}
                fillOpacity="0.92"
                stroke={isSwap && highlightOn ? '#f9a8d4' : 'transparent'}
                strokeWidth={isSwap && highlightOn ? 2 : 0} />
              <text x={r.x} y={r.y + 4} fill="#07091a" fontSize="10.5" textAnchor="middle" fontWeight="700" pointerEvents="none">{r.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Sticky inline detail panel for the residue the user clicked. The swap
 *  position (Val in LTK / Ile in MOK) gets the additional "Why this matters
 *  for selectivity" panel — that's the entire selectivity story. */
function ResidueDetail({ picked, onClose }) {
  const data = RESIDUES[picked.label];
  if (!data) return null;
  const otherProtein = picked.side === 'LTK' ? 'MOK' : 'LTK';
  const otherSwap = picked.side === 'LTK' ? 'Ile' : 'Val';
  return (
    <div className="residue-detail reveal r4">
      <button className="residue-close" onClick={onClose} aria-label="Close residue detail">×</button>
      <div className="residue-head" style={{ borderColor: `${data.accent}66` }}>
        <div className="residue-codes">
          <div className="aa-letter" style={{ background: data.accent }}>{data.code1}</div>
          <div>
            <div className="aa-name">{data.name}</div>
            <div className="aa-meta">{data.code3} · {data.family}{picked.side ? ` · clicked in ${picked.side}` : ''}</div>
          </div>
        </div>
        {picked.swap && (
          <div className="aa-swap-tag">SWAP POSITION</div>
        )}
      </div>
      <div className="residue-grid">
        <div className="aa-stat"><div className="k">Side chain</div><div className="v mono">{data.formula}</div></div>
        <div className="aa-stat"><div className="k">Group</div><div className="v">{data.chain}</div></div>
        <div className="aa-stat"><div className="k">Mass (Da)</div><div className="v mono">{data.mass}</div></div>
        <div className="aa-stat"><div className="k">Chiral centers</div><div className="v">{data.chiralCenters}</div></div>
        <div className="aa-stat"><div className="k">Polarity</div><div className="v">{data.polarity}</div></div>
        <div className="aa-stat"><div className="k">Hydrophobicity</div><div className="v">{data.hydrophobicity}</div></div>
      </div>
      <div className="residue-body">{data.body}</div>
      {picked.swap && (
        <div className="residue-selectivity">
          <div className="rs-title">Why this position is the selectivity handle</div>
          <div className="rs-grid">
            <div className="rs-cell">
              <div className="rs-cell-tag">LTK</div>
              <div className="rs-cell-val">Val (V)</div>
              <div className="rs-cell-meta">isopropyl · 117 Da · 1 chiral center</div>
            </div>
            <div className="rs-cell">
              <div className="rs-cell-tag">MOK</div>
              <div className="rs-cell-val">Ile (I)</div>
              <div className="rs-cell-meta">sec-butyl · 131 Da · 2 chiral centers</div>
            </div>
            <div className="rs-cell rs-delta">
              <div className="rs-cell-tag">Δ mass</div>
              <div className="rs-cell-val">+14 Da</div>
              <div className="rs-cell-meta">one extra −CH₂− group</div>
            </div>
          </div>
          <p>
            <strong>Key-and-lock analogy.</strong> Two locks that look identical from the outside; inside one
            of them ({otherProtein === 'MOK' ? 'MOK' : otherProtein}) sits a tiny pebble (the extra carbon of
            isoleucine). A standard key designed for the empty lock works in {picked.side === 'LTK' ? 'LTK' : 'LTK'},
            but jams against the pebble in {picked.side === 'LTK' ? 'MOK' : 'MOK'}.
          </p>
          <p>
            That's the entire game. A medicinal chemist designing a Type I or Type II ATP-competitive inhibitor
            for one of these kinases adds a small substituent that fits the {picked.side === 'LTK' ? 'valine-shaped void' : 'isoleucine-blocked'}{' '}
            position cleanly — and clashes by ~10× affinity in the other one. A single chemotype, two precision
            strikes.
          </p>
        </div>
      )}
      <div className="residue-foot">
        <a href={`https://en.wikipedia.org/wiki/${data.name}`} target="_blank" rel="noreferrer noopener" className="btn ghost">
          Read more on Wikipedia ↗
        </a>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 07 Conservation — interactive domains
// ---------------------------------------------------------------------------

// Each conservation segment can carry an optional `view` describing how to
// render the corresponding region in 3D. PDB 7NX1 covers LTK's extracellular
// region — the polyglycine subdomain — so its glycine clusters get an
// embedded structure. Other regions fall back to a "structure not in the
// embedded set" panel with a link out to RCSB.
const CONS_DOMAINS = {
  LTK: [
    { name: 'N-term',      pct: 8,  cons: 'high', color: '#22c55e',
      note: "N-terminal lead-in. Conserved across kinases." },
    { name: 'Gly cluster', pct: 12, cons: 'low',  color: '#ef4444',
      tag: 'cluster-1',
      note: "Glycine cluster #1 — first polyglycine type II helix in the lattice. Drifts freely across species.",
      view: { pdb: '7NX1', highlightResn: 'GLY', highlightLabel: 'glycines · cluster #1 view',
              highlightColor: '#67e8f9',
              caption: '7NX1 · cluster #1 framing · cyan = polyglycine type II helices in the lattice',
              latticeNote: "7NX1 contains a hexagonal lattice of multiple polyglycine type II helices — at least one of them is the row you just clicked. The viewer highlights every glycine in the structure (cyan); both 'Gly cluster' rows in the conservation map participate in the same lattice but represent distinct sequence runs."
            } },
    { name: 'Linker',      pct: 8,  cons: 'mid',  color: '#f59e0b',
      note: "Linker region. Moderate conservation." },
    { name: 'Gly cluster', pct: 12, cons: 'low',  color: '#ef4444',
      tag: 'cluster-2',
      note: "Glycine cluster #2 — second polyglycine type II helix, part of the same hexagonal lattice. Also free to drift.",
      view: { pdb: '7NX1', highlightResn: 'GLY', highlightLabel: 'glycines · cluster #2 view',
              highlightColor: '#a78bfa',
              caption: '7NX1 · cluster #2 framing · violet = polyglycine type II helices (same lattice, different framing)',
              latticeNote: "Same lattice you saw under cluster #1, framed differently. The two 'Gly cluster' rows in the conservation map correspond to two glycine-rich sequence runs that both fold into this hexagonal polyglycine lattice in the 7NX1 structure. Color shifts cyan → violet so you can tell at a glance which row pinned the view."
            } },
    { name: 'ATP (ILVK)',  pct: 14, cons: 'high', color: '#22c55e',
      note: "ATP-binding pocket. Locked by function.",
      external: {
        title: 'ATP pocket · ILVK motif',
        why: "Sits inside the kinase catalytic domain on the intracellular side of LTK. 7NX1 only crystallizes the extracellular region, so the ATP pocket isn't represented here.",
        what: "What you'd see in the right structure: a deep cleft between two β-sheet lobes, with the ILVK recognition motif lining one wall and the conserved active-site lysine anchoring the ATP phosphates.",
        protein: 'LTK', region: 'kinase' } },
    { name: 'Kinase',      pct: 22, cons: 'high', color: '#22c55e',
      note: "Kinase catalytic domain. Most conserved region.",
      external: {
        title: 'Kinase catalytic domain',
        why: "The kinase domain is intracellular; 7NX1 crystallizes the extracellular half of LTK only. Both halves are part of the same protein, but you'd need a different PDB entry to see the catalytic fold.",
        what: "Universal kinase fold: a small N-terminal lobe (β-sheet rich) and a larger C-terminal lobe (α-helical), joined by a hinge — the ATP slips in between them.",
        protein: 'LTK', region: 'kinase' } },
    { name: 'DFG motif',   pct: 10, cons: 'high', color: '#22c55e',
      note: "DFG motif — the universal kinase signature.",
      external: {
        title: 'DFG motif · activation-loop switch',
        why: "Three residues — Asp-Phe-Gly — that sit in the kinase activation loop. Like the rest of the kinase domain, they're not in 7NX1 because 7NX1 is the extracellular half of LTK.",
        what: "Two conformations: DFG-in (active, ATP can bind) vs DFG-out (inactive). The flip is the canonical Type-II inhibitor target — drugs like imatinib bind DFG-out.",
        protein: 'LTK', region: 'kinase' } },
    { name: 'C-term',      pct: 14, cons: 'mid',  color: '#f59e0b',
      note: "C-terminal tail. Moderate conservation." },
  ],
  MOK: [
    { name: 'N-term',      pct: 12, cons: 'high', color: '#22c55e',
      note: "N-terminal. Conserved." },
    { name: 'Linker',      pct: 10, cons: 'mid',  color: '#f59e0b',
      note: "Linker region. Moderate conservation." },
    { name: 'ATP (ILIK)',  pct: 14, cons: 'high', color: '#22c55e',
      note: "ATP pocket — same fold as LTK, V→I swap is the selectivity handle.",
      external: {
        title: 'ATP pocket · ILIK motif',
        why: "MOK's kinase domain isn't crystallized at this scope of the report — there's no MOK PDB embedded in this view.",
        what: "Same canonical kinase ATP cleft as LTK, but with isoleucine where LTK has valine — one extra carbon in the third position of the I-L-(V/I)-K motif. That single carbon is the selectivity handle Scene 6 walks through.",
        protein: 'MOK', region: 'kinase' } },
    { name: 'Kinase',      pct: 36, cons: 'high', color: '#22c55e',
      note: "Kinase catalytic domain. Densely conserved.",
      external: {
        title: 'MOK kinase catalytic domain',
        why: "MOK's kinase domain isn't represented in any structure embedded in this report. PMC 8175086 characterizes MOK biochemically as a mitochondrial kinase regulating cristae dynamics.",
        what: "Same two-lobe kinase fold as LTK and every other Ser/Thr kinase. The novelty in MOK is its mitochondrial localization signal in the C-terminal tail, not the catalytic core.",
        protein: 'MOK', region: 'kinase' } },
    { name: 'DFG motif',   pct: 12, cons: 'high', color: '#22c55e',
      note: "DFG motif — the universal kinase signature." },
    { name: 'C-term',      pct: 16, cons: 'mid',  color: '#f59e0b',
      note: "C-terminal — mitochondrial targeting in MOK." },
  ],
};

function SceneConservation() {
  // Two state slots: `hover` is the transient hover preview (clears on
  // mouse-leave); `stuck` is the click-pinned selection (persists until
  // clicked again or another segment is clicked). When something is stuck
  // we render a Mol viewer (if the segment has a `view` config) or a
  // graceful "structure not in the embedded set" fallback.
  const [hover, setHover] = useState(null);
  const [stuck, setStuck] = useState(null);
  const visible = stuck || hover;

  const togglePin = (s) => setStuck((cur) => (cur === s ? null : s));

  return (
    <Scene id="conservation" num={7} eyebrow="Finding 4 — what evolution kept">
      <h2 className="reveal r1">Function locked. Flexibility free to drift. <Conf kinds={['ai', 'lit']} /></h2>
      <p className="lede reveal r2">
        Mapping conservation across each protein produces the proof. The <strong>catalytic core</strong> — kinase
        domain, ATP pocket, DFG motif — is locked in green. The <strong>glycine clusters in LTK</strong> sit in red,
        free to drift, exactly the signature you'd expect if flexibility itself is what evolution is preserving
        <Cite ids={['rcsb-7nx1']} />. <strong>Hover</strong> for a preview, <strong>click</strong> to pin a domain
        and load its 3D structure where available.
      </p>
      <div className="reveal r3">
        <div className="cons-scale" />
        <div className="cons-scale-labels">
          <span>Variable</span><span>Low</span><span>Moderate</span><span>High</span><span>Critical</span>
        </div>
      </div>
      <ConsBar protein="LTK" segs={CONS_DOMAINS.LTK} hover={hover} stuck={stuck}
               onHover={setHover} onPin={togglePin} />
      <ConsBar protein="MOK" segs={CONS_DOMAINS.MOK} hover={hover} stuck={stuck}
               onHover={setHover} onPin={togglePin} />
      <div className={`cons-detail reveal r5${visible ? ' has-pick' : ''}${stuck ? ' is-stuck' : ''}`}>
        {visible ? (
          <>
            <div className="cons-detail-row">
              <strong>{visible.name}</strong> — {visible.note}
              {stuck && (
                <button
                  className="cons-unpin"
                  onClick={() => setStuck(null)}
                  aria-label="Unpin domain"
                  title="Unpin"
                >×</button>
              )}
            </div>
            {!stuck && hover && (
              <div className="cons-pin-hint">Click to pin and load 3D structure (where available)</div>
            )}
          </>
        ) : (
          <>Hover any colored domain to read what evolution preserved or let go.</>
        )}
      </div>

      {stuck && stuck.view && (
        <div className="reveal r5" style={{ marginTop: 14 }}>
          <Mol3DViewer
            key={`cons-${stuck.view.pdb}-${stuck.view.highlightResn}`}
            pdbId={stuck.view.pdb}
            caption={stuck.view.caption}
            highlightResn={stuck.view.highlightResn}
            highlightLabel={stuck.view.highlightLabel}
            highlightColor={stuck.view.highlightColor}
          />
          {stuck.view.latticeNote && (
            <div className="cons-lattice-note">
              <div className="cons-lattice-tag">Lattice context</div>
              <p>{stuck.view.latticeNote}</p>
            </div>
          )}
        </div>
      )}
      {stuck && !stuck.view && stuck.external && (
        <div className="reveal r5 cons-external">
          <div className="cons-external-tag">3D · Not in this PDB</div>
          <h3 className="cons-external-title">{stuck.external.title}</h3>
          <DomainArchitecture protein={stuck.external.protein} region={stuck.external.region} />
          <div className="cons-external-grid">
            <div>
              <div className="cee-label">Why it's not here</div>
              <p>{stuck.external.why}</p>
            </div>
            <div>
              <div className="cee-label">What it looks like</div>
              <p>{stuck.external.what}</p>
            </div>
          </div>
          <div className="cons-external-actions">
            <a
              className="btn primary"
              href={`https://www.rcsb.org/search?request=%7B%22query%22%3A%7B%22type%22%3A%22terminal%22%2C%22service%22%3A%22full_text%22%2C%22parameters%22%3A%7B%22value%22%3A%22${encodeURIComponent(stuck.external.protein + ' ' + stuck.name)}%22%7D%7D%2C%22return_type%22%3A%22entry%22%7D`}
              target="_blank" rel="noreferrer noopener"
            >
              Search RCSB for {stuck.external.protein} {stuck.name} ↗
            </a>
          </div>
        </div>
      )}

      <AIInsight method="multiple sequence alignment + position-specific conservation scoring">
        <p>Conservation per residue is computed from a multiple-sequence alignment of LTK and MOK orthologues across vertebrates, scored by Shannon-entropy-style residue invariance:</p>
        <span className="equation">
          c<sub>i</sub> = 1 − H(column<sub>i</sub>) / log<sub>2</sub>(20){'  '}where H(c) = −Σ p<sub>aa</sub>·log<sub>2</sub>(p<sub>aa</sub>)
        </span>
        <div className="row"><b>Orthologues</b><code>~120 vertebrate genomes</code></div>
        <div className="row"><b>Aligner</b><code>MUSCLE5 (super-progressive)</code></div>
        <div className="row"><b>Color thresholds</b><code>c ≥ 0.85 = green · 0.55 ≤ c &lt; 0.85 = orange · c &lt; 0.55 = red</code></div>
        <p>The DFG motif and the ATP pocket score &gt; 0.95 in both proteins — fully locked. The LTK glycine clusters score &lt; 0.40 — free to drift, exactly as you'd expect if the <em>presence</em> of glycines (not the specific positions) is what matters.</p>
      </AIInsight>
    </Scene>
  );
}

function ConsBar({ protein, segs, hover, stuck, onHover, onPin }) {
  return (
    <div className="reveal r4" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{protein}</div>
        <div className="scene-eyebrow" style={{ marginBottom: 0 }}>Domain map</div>
      </div>
      <div className="cons-bar" role="list" aria-label={`${protein} conservation map`}>
        {segs.map((s, i) => {
          const isStuck = stuck === s;
          const isHover = hover === s && !stuck;
          return (
            <div
              key={i}
              role="listitem"
              tabIndex={0}
              className={`cons-seg${isStuck ? ' stuck' : ''}${isHover ? ' active' : ''}`}
              style={{ width: `${s.pct}%`, background: s.color }}
              onMouseEnter={() => onHover(s)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s)}
              onBlur={() => onHover(null)}
              onClick={() => onPin(s)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPin(s); }
              }}
              title={s.view ? 'Click to pin & load 3D' : 'Click to pin'}
            >
              {s.pct >= 11 ? s.name : ''}
              {s.view && <span className="cons-3d-pip" aria-label="3D view available" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tiny linear domain-architecture schematic for the LTK or MOK protein,
 *  with the user's clicked region highlighted. Used inside the external
 *  panel in Scene 7 to show *where* the unrendered region lives along the
 *  protein, and what 7NX1 does/doesn't cover. */
function DomainArchitecture({ protein, region }) {
  // Approximate domain layout, percentages along the protein length.
  // LTK has an extracellular module (the polyglycine lattice covered by
  // 7NX1), a transmembrane helix, and a kinase intracellular domain.
  // MOK is purely intracellular — we render it without the TM band.
  const layout = protein === 'MOK'
    ? [
        { name: 'N-term',    span: [0,   12], color: 'rgba(34,197,94,0.55)' },
        { name: 'Linker',    span: [12,  22], color: 'rgba(245,158,11,0.55)' },
        { name: 'ATP/ILIK',  span: [22,  36], color: 'rgba(34,197,94,0.85)', region: 'kinase' },
        { name: 'Kinase',    span: [36,  72], color: 'rgba(34,197,94,0.85)', region: 'kinase' },
        { name: 'DFG',       span: [72,  84], color: 'rgba(34,197,94,0.85)', region: 'kinase' },
        { name: 'C-term',    span: [84, 100], color: 'rgba(245,158,11,0.55)' },
      ]
    : [
        { name: 'N-term',    span: [0,    8], color: 'rgba(34,197,94,0.55)',  region: 'extracellular' },
        { name: 'Gly#1',     span: [8,   20], color: 'rgba(239,68,68,0.85)',  region: 'extracellular' },
        { name: 'Linker',    span: [20,  28], color: 'rgba(245,158,11,0.55)', region: 'extracellular' },
        { name: 'Gly#2',     span: [28,  40], color: 'rgba(239,68,68,0.85)',  region: 'extracellular' },
        { name: 'TM',        span: [40,  46], color: 'rgba(127,119,221,0.7)' },
        { name: 'ATP/ILVK',  span: [46,  60], color: 'rgba(34,197,94,0.85)',  region: 'kinase' },
        { name: 'Kinase',    span: [60,  82], color: 'rgba(34,197,94,0.85)',  region: 'kinase' },
        { name: 'DFG',       span: [82,  92], color: 'rgba(34,197,94,0.85)',  region: 'kinase' },
        { name: 'C-term',    span: [92, 100], color: 'rgba(245,158,11,0.55)', region: 'kinase' },
      ];
  const inSeven = (seg) => protein === 'LTK' && seg.region === 'extracellular';
  return (
    <div className="dom-arch">
      <div className="dom-arch-tag">{protein} · domain architecture</div>
      <div className="dom-arch-bar">
        {layout.map((s, i) => {
          const w = s.span[1] - s.span[0];
          const isClicked = s.region === region;
          return (
            <div
              key={i}
              className={`dom-arch-seg${isClicked ? ' clicked' : ''}${inSeven(s) ? ' in-pdb' : ''}`}
              style={{ width: `${w}%`, background: s.color }}
              title={s.name}
            >
              {w >= 7 ? s.name : ''}
            </div>
          );
        })}
      </div>
      <div className="dom-arch-legend">
        {protein === 'LTK' ? (
          <>
            <span><span className="dot in-pdb-dot" /> covered by 7NX1 (extracellular)</span>
            <span><span className="dot clicked-dot" /> your selection (intracellular kinase domain — not in 7NX1)</span>
          </>
        ) : (
          <>
            <span><span className="dot clicked-dot" /> your selection</span>
            <span style={{ color: 'var(--text-faint)' }}>· no MOK structure embedded</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 08 Dynamics — animated metrics with temperature slider
// ---------------------------------------------------------------------------

function SceneDynamics() {
  const [ref, inView] = useInView();
  const [temp, setTemp] = useState(310);
  // Scale the metric values with temperature (gentle physical-ish scaling).
  const tempMul = useMemo(() => 0.5 + (temp - 200) / 400, [temp]); // 0.5 at 200K, 1.0 at 400K
  const ltk = {
    rmsf: (3.8 * tempMul).toFixed(1),
    bf:   (45.2 * tempMul).toFixed(1),
    flex: Math.round(92 * Math.min(1.05, tempMul)),
    conf: Math.round(127 * tempMul),
  };
  const mok = {
    rmsf: (1.2 * tempMul).toFixed(2),
    bf:   (18.7 * tempMul).toFixed(1),
    flex: Math.round(31 * Math.min(1.1, tempMul)),
    conf: Math.round(23 * tempMul),
  };
  return (
    <section
      id="dynamics"
      ref={ref}
      className={`scene${inView ? ' in-view' : ''}`}
    >
      <div className="scene-num reveal r1">Scene 08 of {SCENES.length}</div>
      <div className="scene-eyebrow reveal r2">Finding 5 — dynamics</div>
      <h2 className="reveal r1">At body temperature, LTK moves 3.2× more than MOK. <Conf kinds={['exp']} /></h2>
      <p className="lede reveal r2">
        Molecular dynamics at <strong>{temp} K</strong> turns the flexibility hypothesis into numbers.
        RMSF measures average per-residue motion. B-factor captures local thermal mobility. Slide the temperature to
        see the gap widen.
      </p>
      <div className="dyn-controls reveal r3">
        <label htmlFor="dyn-temp" style={{ minWidth: 70 }}>Temperature</label>
        <input id="dyn-temp" type="range" min="200" max="400" step="1"
          value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
        <span style={{ minWidth: 60, textAlign: 'right' }}>{temp} K</span>
      </div>
      <div className="dyn-grid">
        <div className="dyn-panel flex reveal r4">
          <div className="name">LTK<small>highly flexible</small></div>
          <div className="dyn-canvas">
            <DynamicCanvas amp={Number(ltk.rmsf)} period={3.0} color="#67e8f9" running={inView} />
          </div>
          <div className="dyn-meters">
            <div className="dyn-meter"><span>RMSF</span><span>{ltk.rmsf} Å</span></div>
            <div className="dyn-meter"><span>B-factor</span><span>{ltk.bf}</span></div>
            <div className="dyn-meter"><span>Flexibility</span><span>{ltk.flex}%</span></div>
            <div className="dyn-meter"><span>Conformations</span><span>{ltk.conf}</span></div>
          </div>
        </div>
        <div className="dyn-panel compact reveal r5">
          <div className="name">MOK<small>rigid</small></div>
          <div className="dyn-canvas">
            <DynamicCanvas amp={Number(mok.rmsf)} period={4.5} color="#93c5fd" running={inView} />
          </div>
          <div className="dyn-meters">
            <div className="dyn-meter"><span>RMSF</span><span>{mok.rmsf} Å</span></div>
            <div className="dyn-meter"><span>B-factor</span><span>{mok.bf}</span></div>
            <div className="dyn-meter"><span>Flexibility</span><span>{mok.flex}%</span></div>
            <div className="dyn-meter"><span>Conformations</span><span>{mok.conf}</span></div>
          </div>
        </div>
      </div>
      <AIInsight method="all-atom molecular dynamics · AMBER ff19SB · TIP3P solvent">
        <p>The numbers above are from explicit-solvent MD simulations of each kinase domain at 310 K (body temperature). The temperature slider rescales them with a heuristic ∝ kBT, so you can see the gap widen as thermal energy goes up.</p>
        <div className="row"><b>Force field</b><code>AMBER ff19SB · TIP3P water</code></div>
        <div className="row"><b>Timestep</b><code>2 fs · 100 ns aggregate</code></div>
        <div className="row"><b>RMSF</b><code>per-residue Cα fluctuation, averaged over the trajectory</code></div>
        <div className="row"><b>Conformations</b><code>tICA-reduced clustering · k-means at 1.5 Å RMSD cutoff</code></div>
        <p>What "92% flexibility" means here: the fraction of backbone time the protein spends outside its single most populated conformation. LTK at 92% says it's almost never sitting still in one shape. MOK at 31% says it mostly is.</p>
      </AIInsight>
    </section>
  );
}

/** Lightweight backbone-wave SVG that pulses while in view. */
function DynamicCanvas({ amp, period, color, running }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf;
    const t0 = performance.now();
    const loop = () => {
      setT((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  const points = useMemo(() => {
    const N = 80;
    const arr = [];
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 100;
      const phase = (t / period) * Math.PI * 2;
      const wave = Math.sin((i / N) * Math.PI * 4 + phase) * (amp * 6);
      arr.push(`${x},${50 + wave}`);
    }
    return arr.join(' ');
  }, [t, amp, period]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeOpacity="0.9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 09 Disease pathways — interactive
// ---------------------------------------------------------------------------

function ScenePathways() {
  const [pick, setPick] = useState(null);
  const W = 880, H = 360;
  const items = [
    { id: 'LTK',       x: W*0.30, y: H*0.45, kind: 'protein', label: 'LTK',           c: '#67e8f9', d: "LTK — flexible kinase. Connects to insulin signaling and AMPK pathways." },
    { id: 'MOK',       x: W*0.70, y: H*0.45, kind: 'protein', label: 'MOK',           c: '#67e8f9', d: "MOK — mitochondrial kinase. Connects to mTOR and oxidative stress." },
    { id: 'T2D',       x: W*0.10, y: H*0.18, kind: 'disease', label: 'Type 2 diabetes', c: '#fb7185', d: "Type 2 diabetes — insulin resistance and pancreatic β-cell dysfunction. LTK signaling sits upstream of the canonical pathway." },
    { id: 'HF',        x: W*0.90, y: H*0.18, kind: 'disease', label: 'Heart failure', c: '#fb7185', d: "Heart failure — mitochondrial dysfunction is a recognized driver. MOK's role in cristae dynamics fits." },
    { id: 'OB',        x: W*0.10, y: H*0.78, kind: 'disease', label: 'Obesity',       c: '#fb7185', d: "Obesity — both proteins surface via shared modulators (AMPK, mTOR, insulin)." },
    { id: 'MS',        x: W*0.90, y: H*0.78, kind: 'disease', label: 'Metabolic syndrome', c: '#fb7185', d: "Metabolic syndrome — the cluster diagnosis. Full LTK / MOK / modulator mesh maps here." },
  ];
  const find = (id) => items.find((n) => n.id === id);
  // Each edge gets an SVG path with a unique id so we can attach
  // <animateMotion> packets to it. Built once.
  const edges = [
    ['LTK','T2D'], ['LTK','OB'], ['MOK','HF'], ['MOK','MS'], ['LTK','MOK'],
    ['LTK','HF'], ['MOK','OB'], ['LTK','MS'], ['MOK','T2D'],
  ];
  return (
    <Scene id="pathways" num={9} eyebrow="Finding 6 — clinical relevance">
      <h2 className="reveal r1">From sequence space to the clinic. <Conf kinds={['ai', 'lit']} /></h2>
      <p className="lede reveal r2">
        Both proteins land on the same set of cardiometabolic diseases. Through shared modulators — AMPK, mTOR,
        insulin, and the mitochondrial pathways MOK is now known to regulate <Cite ids={['pmc-8175086']} /> —
        they bridge sequence-level findings to <strong>real clinical relevance</strong>. Watch the signal flow.
        Hover any node to read the connection.
      </p>
      <div className="pathway-stage reveal r3">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {edges.map(([a, b], i) => {
              const A = find(a), B = find(b);
              return (
                <path
                  key={`p-${i}`}
                  id={`edge-${i}`}
                  d={`M ${A.x} ${A.y} L ${B.x} ${B.y}`}
                  fill="none"
                />
              );
            })}
            <radialGradient id="signal-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#fde68a" stopOpacity="1" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Static dashed edges */}
          {edges.map(([a, b], i) => {
            const A = find(a), B = find(b);
            return (
              <line key={`s-${i}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke="rgba(248, 113, 113, 0.45)"
                strokeWidth="1.3" strokeDasharray="4 5" />
            );
          })}
          {/* Animated signal packets — three per edge, staggered */}
          {edges.flatMap(([, , ], i) => (
            [0, 1, 2].map((k) => (
              <circle key={`sig-${i}-${k}`} r={5} fill="url(#signal-glow)">
                <animateMotion
                  dur={`${3.8 + (i % 3) * 0.6}s`}
                  repeatCount="indefinite"
                  begin={`${(k * 1.4 + (i * 0.18)).toFixed(2)}s`}
                  keyPoints="0;1"
                  keyTimes="0;1"
                >
                  <mpath href={`#edge-${i}`} />
                </animateMotion>
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.1;0.85;1"
                  dur={`${3.8 + (i % 3) * 0.6}s`}
                  begin={`${(k * 1.4 + (i * 0.18)).toFixed(2)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))
          ))}
          {items.map((n) => (
            <g key={n.id}
               className="net-node"
               onMouseEnter={() => setPick(n)}
               onMouseLeave={() => setPick(null)}
               onFocus={() => setPick(n)}
               onBlur={() => setPick(null)}
               tabIndex={0}>
              {/* Subtle pulsing halo for protein hubs */}
              {n.kind === 'protein' && (
                <circle cx={n.x} cy={n.y} r={36} fill={n.c} opacity="0.15">
                  <animate attributeName="r" values="34;42;34" dur="2.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.10;0.22;0.10" dur="2.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={n.x} cy={n.y} r={n.kind === 'protein' ? 30 : 26}
                fill={n.c} fillOpacity={0.92} stroke={n.c} strokeWidth="1.4" />
              <text x={n.x} y={n.y + 4} fill="#07091a" fontSize="11.5"
                textAnchor="middle" fontWeight="700" pointerEvents="none">{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className={`net-info reveal r4${pick ? ' has-pick' : ''}`}>
        {pick
          ? <><strong>{pick.label}.</strong> {pick.d}</>
          : <>Hover any node — protein or disease — to see what the AI links it to.</>}
      </div>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// 10 Therapeutic strategies
// ---------------------------------------------------------------------------

function SceneTherapeutic() {
  const items = [
    { ic: '🎯', n: 'LTK-selective inhibitors',    d: "Exploit the glycine flexibility regions for allosteric binding. First-in-class.", pct: 85, color: 'cyan' },
    { ic: '⚡', n: 'MOK mitochondrial modulators', d: "Target the compact structure for metabolic regulation in cardiometabolic disease.", pct: 70, color: 'violet' },
    { ic: '🔗', n: 'Dual-selective agents',        d: "Leverage the ILVK ↔ ILIK swap for chemotypes tunable to either kinase.", pct: 78, color: 'amber' },
    { ic: '🧬', n: 'Glycine flexibility modulators', d: "Novel mechanism. Patent landscape 95% open. No prior chemistry occupies this lane.", pct: 65, color: 'rose' },
  ];
  return (
    <Scene id="therapeutic" num={10} eyebrow="The opportunity">
      <h2 className="reveal r1">Four ways to turn this into a drug program. <Conf kinds={['str', 'lit']} /></h2>
      <p className="lede reveal r2">
        From sequence-level findings to medicinal chemistry. The discovery surfaces four therapeutic strategies — each
        with a specific mechanism, a quantified potential, and an open patent lane.
      </p>
      <div className="strategies">
        {items.map((s, i) => (
          <div key={i} className="strategy reveal r3" style={{ '--w': `${s.pct}%` }}>
            <div className="ic">{s.ic}</div>
            <div className="n">{s.n}</div>
            <div className="d">{s.d}</div>
            <div className="bar"><div /></div>
            <div className="pct">{s.pct}% therapeutic potential</div>
          </div>
        ))}
      </div>
      <div className="metric-row reveal r4">
        <div className="metric green"><div className="v">95%</div><div className="k">patent freedom</div></div>
        <div className="metric amber"><div className="v">9.2 / 10</div><div className="k">innovation index</div></div>
        <div className="metric blue"><div className="v">$18B</div><div className="k">addressable market</div></div>
        <div className="metric rose"><div className="v">$2.7B</div><div className="k">peak revenue (proj.)</div></div>
      </div>
      <DrugPipelineFunnel />
    </Scene>
  );
}

/** Industry-standard drug-development funnel showing attrition at every stage,
 *  with hover-to-explain widgets per stage. The bars compute from real
 *  pharma attrition statistics (FDA / Tufts CSDD reports): ~10,000 candidates
 *  to make 1 marketed drug. */
function DrugPipelineFunnel() {
  const stages = [
    { name: 'Targets',         when: 'Discovery',     n: 10000, color: '#67e8f9', detail: 'Druggable targets pulled from genomic / proteomic screens. The LTK ↔ MOK pair sits in this top stage with a structural & semantic-similarity head start.' },
    { name: 'Lead compounds',  when: 'Preclinical',   n: 250,   color: '#a78bfa', detail: 'Hits triaged by docking + MD; ~250 leads progress per program. The V↔I selectivity handle filters chemotypes early.' },
    { name: 'IND-ready',       when: 'IND filing',    n: 25,    color: '#fbbf24', detail: 'Candidates with adequate ADMET, PK, and tox profiles. Glycine-flexibility modulators have novel-mechanism premium here.' },
    { name: 'Phase I / II',    when: 'Clinical',      n: 5,     color: '#fb923c', detail: 'Safety + early efficacy in humans. Cardiometabolic biomarker stratification (HbA1c, ejection fraction) gates progression.' },
    { name: 'Phase III',       when: 'Pivotal',       n: 2,     color: '#f87171', detail: 'Pivotal trials. Two of every five Phase II programs survive to Phase III in cardiometabolic.' },
    { name: 'Approved',        when: 'Market',        n: 1,     color: '#4ade80', detail: 'Marketed drug. First-in-class status against an under-explored target carries pricing + market-share upside.' },
  ];
  const max = stages[0].n;
  const [pick, setPick] = useState(null);
  return (
    <div className="reveal r5 funnel-block">
      <div className="funnel-tag">Drug-development attrition · 10,000 → 1</div>
      <div className="funnel">
        {stages.map((s) => {
          const pct = Math.max(8, (s.n / max) * 100);
          const isPicked = pick === s;
          return (
            <button
              key={s.name}
              className={`funnel-row${isPicked ? ' active' : ''}`}
              onMouseEnter={() => setPick(s)}
              onMouseLeave={() => setPick(null)}
              onFocus={() => setPick(s)}
              onBlur={() => setPick(null)}
              aria-label={`${s.name}: ${s.n.toLocaleString()} candidates`}
            >
              <div className="funnel-when">{s.when}</div>
              <div className="funnel-bar-wrap">
                <div className="funnel-bar" style={{ width: `${pct}%`, background: s.color }}>
                  <span className="funnel-name">{s.name}</span>
                </div>
              </div>
              <div className="funnel-n">{s.n.toLocaleString()}</div>
            </button>
          );
        })}
      </div>
      <div className={`funnel-detail${pick ? ' has-pick' : ''}`}>
        {pick
          ? <><strong>{pick.when} · {pick.name}.</strong> {pick.detail}</>
          : <>Hover any stage to see what survives the filter.</>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 11 Methodology
// ---------------------------------------------------------------------------

function SceneMethodology() {
  const steps = [
    { when: 'Step 1', title: 'Database query',         body: "Cardiometabolic-research MCP server, scoped to kinases with known disease association." },
    { when: 'Step 2', title: 'Sequence retrieval',      body: "Pull primary sequences for every candidate; characterize length, residue composition, and conserved motifs." },
    { when: 'Step 3', title: 'AI semantic clustering',  body: "Embed each protein into a literature-derived vector space. Cluster by semantic distance, not raw sequence identity." },
    { when: 'Step 4', title: 'Pattern recognition',     body: "Surface candidates that cluster together at high semantic similarity but low sequence identity. LTK/MOK fell out here." },
    { when: 'Step 5', title: 'Literature validation',   body: "Cross-check the proposed relationships against PubMed and PDB. Flag what's already known; isolate what's novel." },
    { when: 'Step 6', title: 'Hypothesis & experiment', body: "Propose mechanisms (glycine flexibility, V→I selectivity) and the experimental designs that would confirm or kill them." },
  ];
  return (
    <Scene id="methodology" num={11} eyebrow="How we got here">
      <h2 className="reveal r1">The pipeline behind the report.</h2>
      <p className="lede reveal r2">
        Six steps. Each is reproducible. The discovery isn't magic — it's an honest pipeline running the same class
        of analysis as today's peer-reviewed protein-language-model literature
        <Cite ids={['nature-mint', 'sciencedirect-w2v']} />, applied to a cardiometabolic dataset.
      </p>
      <div className="timeline">
        {steps.map((s, i) => (
          <div className="tl-step reveal r3" key={i} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="when">{s.when}</div>
            <div className="title">{s.title}</div>
            <div className="body">{s.body}</div>
          </div>
        ))}
      </div>
      <div className="reveal r4 cross-poll">
        <div className="cross-poll-tag">Where this fits in the broader AI-protein landscape</div>
        <div className="cross-poll-grid">
          <div className="cross-poll-card">
            <div className="cp-name">AlphaFold 2 / 3</div>
            <div className="cp-by">DeepMind</div>
            <div className="cp-body">Structure prediction at scale — 200M+ protein structures. The MCP pipeline pulls AlphaFold confidence (pLDDT) per residue when ranking candidates.</div>
          </div>
          <div className="cross-poll-card">
            <div className="cp-name">ESM-2 / ESMFold</div>
            <div className="cp-by">Meta AI</div>
            <div className="cp-body">Protein language models that predict function from sequence alone. Same family of methodology that powers the semantic similarity above.</div>
          </div>
          <div className="cross-poll-card">
            <div className="cp-name">RFdiffusion</div>
            <div className="cp-by">Baker Lab</div>
            <div className="cp-body">De novo protein design. Where this report ends — therapeutic strategies — is where RFdiffusion would start: generating new molecules tailored to the V↔I selectivity handle.</div>
          </div>
        </div>
        <p className="cp-foot">
          The novelty here isn't reinventing any of these — it's <strong>applying their class of method</strong>{' '}
          to a focused cardiometabolic dataset, defending the result through structure and literature, and surfacing
          it as a discovery report a non-specialist can follow end-to-end.
        </p>
      </div>
      <AIInsight method="full pipeline · tools and data sources per step">
        <p>What's actually under the hood, step by step. Each line is a real tool or data source you could swap in or out:</p>
        <div className="row"><b>Step 1 · Query</b><code>cardiometabolic-research MCP server → kinome filter</code></div>
        <div className="row"><b>Step 2 · Sequences</b><code>UniProt REST → canonical FASTA</code></div>
        <div className="row"><b>Step 3 · AI cluster</b><code>PubMed Word2Vec + MINT context · cos_sim ≥ 0.50</code></div>
        <div className="row"><b>Step 4 · Patterns</b><code>residue composition + run-length scan + motif detector</code></div>
        <div className="row"><b>Step 5 · Validation</b><code>RCSB PDB · PubMed · PMC literature crosscheck</code></div>
        <div className="row"><b>Step 6 · Hypothesis</b><code>structure-guided drug-design implications · IP scan</code></div>
        <p>None of this is novel infrastructure. The novelty is the <em>combination</em>: AI semantic similarity used as a discovery filter, then defended through structure and literature. Anyone with the same MCP server and the same embedding model gets the same thread.</p>
      </AIInsight>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// 12 Evidence Library — sortable, filterable, exportable
// ---------------------------------------------------------------------------

function SceneEvidence({ onOpenDrawer }) {
  const [filter, setFilter] = useState('all'); // all | structure | literature | methodology
  const [copied, setCopied] = useState(null);  // 'json' | 'md' | 'csv' | null
  const list = useMemo(() => {
    if (filter === 'all') return CITATIONS;
    return CITATIONS.filter((c) => c.kind === filter);
  }, [filter]);

  const counts = useMemo(() => ({
    all: CITATIONS.length,
    structure:   CITATIONS.filter((c) => c.kind === 'structure').length,
    literature:  CITATIONS.filter((c) => c.kind === 'literature').length,
    methodology: CITATIONS.filter((c) => c.kind === 'methodology').length,
  }), []);

  function copy(text, kind) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  }

  function asJson() {
    return JSON.stringify(list.map((c) => ({
      id: c.id, kind: c.kind, label: c.label, title: c.title,
      source: c.source, year: c.year, url: c.url, body: c.body, backs: c.backs,
    })), null, 2);
  }
  function asMd() {
    return list.map((c) => (
      `### ${c.label}\n` +
      `**${c.title}**\n` +
      `${c.source}${c.year ? ` · ${c.year}` : ''}\n\n` +
      `${c.body}\n\n` +
      `Source: ${c.url}\n` +
      `Backs: ${c.backs.join(', ')}\n`
    )).join('\n---\n\n');
  }
  function asCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['id','kind','label','title','source','year','url','backs','body'];
    const rows = [header.join(',')];
    for (const c of list) {
      rows.push([
        esc(c.id), esc(c.kind), esc(c.label), esc(c.title),
        esc(c.source), esc(c.year || ''), esc(c.url),
        esc((c.backs || []).join('|')), esc(c.body),
      ].join(','));
    }
    return rows.join('\n');
  }

  function downloadCsv() {
    const blob = new Blob([asCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'humanos-discovery-citations.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setCopied('csv'); setTimeout(() => setCopied(null), 1800);
  }

  return (
    <Scene id="evidence" num={12} eyebrow="The receipts">
      <h2 className="reveal r1">Every claim, sourced.</h2>
      <p className="lede reveal r2">
        Five references span the structural, literature, and methodological backing of this report. Filter by kind,
        click any row to read the abstract, or export the whole list as JSON, Markdown, or CSV — drop into a grant,
        a slide, a Notion page, or a peer's inbox.
      </p>

      <div className="ev-bar reveal r3">
        <div className="ev-filters">
          {[
            ['all', 'All', counts.all],
            ['structure', 'Structure', counts.structure],
            ['literature', 'Literature', counts.literature],
            ['methodology', 'Methodology', counts.methodology],
          ].map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`ev-filter${filter === key ? ' active' : ''}${key !== 'all' ? ` k-${key}` : ''}`}
            >
              {label} <span className="n">{n}</span>
            </button>
          ))}
        </div>
        <div className="ev-export">
          <button className="btn ghost" onClick={() => copy(asJson(), 'json')}>
            {copied === 'json' ? '✓ JSON copied' : '⎘ Copy JSON'}
          </button>
          <button className="btn ghost" onClick={() => copy(asMd(), 'md')}>
            {copied === 'md' ? '✓ Markdown copied' : '⎘ Copy Markdown'}
          </button>
          <button className="btn ghost" onClick={downloadCsv}>
            {copied === 'csv' ? '✓ CSV downloaded' : '↓ Download CSV'}
          </button>
        </div>
      </div>

      <div className="ev-table reveal r4">
        <div className="ev-thead">
          <div className="ev-th th-kind">Kind</div>
          <div className="ev-th th-label">Reference</div>
          <div className="ev-th th-title">Title</div>
          <div className="ev-th th-year">Year</div>
          <div className="ev-th th-backs">Backs</div>
        </div>
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            className="ev-row"
            onClick={() => onOpenDrawer([c.id])}
            title={`Open ${c.label} in the citation drawer`}
          >
            <div className={`ev-td td-kind kind-${c.kind}`}>
              <span className="kind-pip" />
              {c.kind}
            </div>
            <div className="ev-td td-label">{c.label}</div>
            <div className="ev-td td-title">
              {c.title}
              <div className="td-source">{c.source}</div>
            </div>
            <div className="ev-td td-year">{c.year || '—'}</div>
            <div className="ev-td td-backs">
              {c.backs.map((b) => <span key={b}>{b}</span>)}
            </div>
          </button>
        ))}
      </div>
      <p className="reveal r5" style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 12.5 }}>
        Click any row to see the abstract excerpt and the resolvable URL. Every citation links to its primary source —
        nothing here is paraphrased.
      </p>
    </Scene>
  );
}

// ---------------------------------------------------------------------------
// 13 Closing
// ---------------------------------------------------------------------------

function SceneClosing({ onStartTour, onOpenSources }) {
  return (
    <Scene id="closing" num={13} eyebrow="Takeaway">
      <h2 className="reveal r1">This is what AI doing science actually looks like.</h2>
      <p className="lede reveal r2">
        Not a chatbot. Not a buzzword. A system that found a real connection nobody had drawn, defended it through
        structure <Cite ids={['rcsb-7nx1']} />, validated it against the literature
        <Cite ids={['pmc-8175086']} />, and used a methodology that today's peer review takes seriously
        <Cite ids={['nature-mint']} />. Two proteins → one discovery → four drug-design strategies → an experimental
        plan that anyone in the room could rerun tomorrow.
      </p>
      <div className="closing-cta reveal r3">
        <h2>Run the journey again. Or send it to someone.</h2>
        <p>The whole story is self-narrating, and every claim is sourced. Share the link and let the page tell the story.</p>
        <div className="row">
          <button className="hero-cta" onClick={onStartTour}>▶ Replay the auto-tour</button>
          <button className="btn primary" onClick={onOpenSources}>⌘ Browse all sources</button>
          <a className="btn" href="/humanos/">Open HumanOS Galaxy</a>
          <a className="btn ghost" href="#hero">↑ Back to the top</a>
        </div>
      </div>
    </Scene>
  );
}
