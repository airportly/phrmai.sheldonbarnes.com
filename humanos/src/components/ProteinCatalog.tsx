import React, { useMemo, useState } from 'react';
import type { Protein, OrganKey } from '@/lib/protein-mapper';
import {
  getAllEnrichedProteins,
  type EnrichedProtein,
  type FunctionClass,
  type GeneFamily,
  type PlddtBand,
  type VariantBurdenBand,
} from '@/lib/protein-classify';
import SankeyFlow from './SankeyFlow';

/**
 * ProteinCatalog - Non-body-centric view: every protein in the snapshot as a
 * sortable, filterable table. Filters at the top (function class, gene family,
 * organ, pLDDT band, variant burden, drug-target). Search input. Sort by gene,
 * association score, pLDDT, or variant count. Click a row to load the protein.
 *
 * Selected protein highlights inline so you can keep scanning the catalog
 * while the side cards refresh.
 */

interface Props {
  selectedProtein: Protein | null;
  onSelectProtein: (p: Protein) => void;
}

type SortKey = 'gene' | 'score' | 'plddt' | 'variants';

const FUNCTION_CLASSES: FunctionClass[] = [
  'Ion channel', 'Receptor', 'Kinase', 'Transcription factor',
  'Apolipoprotein', 'Coagulation', 'Enzyme', 'Transporter', 'Other',
];
const PLDDT_BANDS: PlddtBand[] = ['Very high', 'Confident', 'Low', 'Very low', 'No structure'];
const BURDEN_BANDS: VariantBurdenBand[] = ['High burden', 'Moderate', 'Low', 'No data'];
const ORGANS: OrganKey[] = ['brain', 'heart', 'liver', 'pancreas', 'kidneys', 'adipose'];
const FAMILIES: GeneFamily[] = [
  'KCN (K+ channels)', 'SCN (Na+ channels)', 'APO (apolipoproteins)',
  'F (coagulation factors)', 'HNF (HNF transcription factors)', 'Other',
];

interface FilterState {
  search: string;
  functionClasses: Set<FunctionClass>;
  geneFamilies: Set<GeneFamily>;
  organs: Set<OrganKey>;
  plddtBands: Set<PlddtBand>;
  burdens: Set<VariantBurdenBand>;
  drugTargetOnly: boolean;
  sort: SortKey;
}

function emptyFilters(): FilterState {
  return {
    search: '',
    functionClasses: new Set(),
    geneFamilies: new Set(),
    organs: new Set(),
    plddtBands: new Set(),
    burdens: new Set(),
    drugTargetOnly: false,
    sort: 'score',
  };
}

export default function ProteinCatalog({ selectedProtein, onSelectProtein }: Props) {
  const all = useMemo(() => getAllEnrichedProteins(), []);
  const [f, setF] = useState<FilterState>(emptyFilters);
  const [showFlow, setShowFlow] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches) {
        setShowFlow(false);
        setShowFilters(false);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const filtered = useMemo(() => {
    const q = f.search.trim().toLowerCase();
    let rows = all.filter((p) => {
      if (q) {
        const hay = `${p.gene} ${p.uniprot} ${p.name} ${p.function}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.functionClasses.size > 0 && !f.functionClasses.has(p.functionClass)) return false;
      if (f.geneFamilies.size > 0 && !f.geneFamilies.has(p.geneFamily)) return false;
      if (f.organs.size > 0 && !f.organs.has(p.organ)) return false;
      if (f.plddtBands.size > 0 && !f.plddtBands.has(p.plddtBand)) return false;
      if (f.burdens.size > 0 && !f.burdens.has(p.variantBurden)) return false;
      if (f.drugTargetOnly && !p.isDrugTarget) return false;
      return true;
    });
    rows.sort((a, b) => {
      switch (f.sort) {
        case 'gene':     return a.gene.localeCompare(b.gene);
        case 'score':    return b.score - a.score;
        case 'plddt':    return (b.plddt ?? -1) - (a.plddt ?? -1);
        case 'variants': return (b.variantCount ?? 0) - (a.variantCount ?? 0);
      }
    });
    return rows;
  }, [all, f]);

  const totalCount = all.length;
  const filteredCount = filtered.length;

  return (
    <div className="text-white/85 w-full">
      <div className="mb-4">
        <div className="text-[10px] tracking-[2.5px] text-cyan-300/70 font-medium uppercase">Catalog</div>
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mt-1 gap-2">
          <div className="min-w-0">
            <div className="text-[18px] sm:text-[24px] tracking-wide font-light">All proteins</div>
            <div className="text-[11px] text-white/45 mt-0.5">
              {filteredCount === totalCount
                ? `${totalCount} proteins · cardiometabolic v1.0`
                : `${filteredCount} of ${totalCount} proteins · filtered`}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="sm:hidden rounded-full px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition"
              style={{
                background: showFilters ? 'rgba(45, 212, 191, 0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showFilters ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: showFilters ? '#5eead4' : 'rgba(255,255,255,0.55)',
              }}
            >
              {showFilters ? '✓' : '○'} Filters
            </button>
            <button
              onClick={() => setShowFlow((s) => !s)}
              className="rounded-full px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition"
              style={{
                background: showFlow ? 'rgba(45, 212, 191, 0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showFlow ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: showFlow ? '#5eead4' : 'rgba(255,255,255,0.55)',
              }}
              title="Toggle the function → organ flow chart"
            >
              {showFlow ? '✓' : '○'} Flow
            </button>
            <input
              value={f.search}
              onChange={(e) => setF({ ...f, search: e.target.value })}
              placeholder="Search gene, accession, function…"
              className="bg-white/5 border border-white/10 text-white placeholder-white/35 text-[12px] tracking-wide outline-none focus:border-cyan-500/50 rounded-full px-4 py-1.5 w-full sm:w-[260px]"
            />
          </div>
        </div>
      </div>

      {showFlow && (
        <div className="mb-4">
          <SankeyFlow height={180} />
        </div>
      )}

      <div className={`space-y-2 mb-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
        <FilterRow
          label="Function"
          options={FUNCTION_CLASSES.map((c) => ({ value: c, label: c }))}
          selected={f.functionClasses}
          onChange={(set) => setF({ ...f, functionClasses: set as Set<FunctionClass> })}
        />
        <FilterRow
          label="Family"
          options={FAMILIES.map((c) => ({ value: c, label: c.replace(/ \(.*$/, '') }))}
          selected={f.geneFamilies}
          onChange={(set) => setF({ ...f, geneFamilies: set as Set<GeneFamily> })}
        />
        <FilterRow
          label="Organ"
          options={ORGANS.map((o) => ({ value: o, label: capitalize(o) }))}
          selected={f.organs}
          onChange={(set) => setF({ ...f, organs: set as Set<OrganKey> })}
        />
        <FilterRow
          label="Confidence"
          options={PLDDT_BANDS.map((b) => ({ value: b, label: b }))}
          selected={f.plddtBands}
          onChange={(set) => setF({ ...f, plddtBands: set as Set<PlddtBand> })}
        />
        <FilterRow
          label="Variant burden"
          options={BURDEN_BANDS.map((b) => ({ value: b, label: b }))}
          selected={f.burdens}
          onChange={(set) => setF({ ...f, burdens: set as Set<VariantBurdenBand> })}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setF({ ...f, drugTargetOnly: !f.drugTargetOnly })}
            className="rounded-full px-3 py-1 text-[10.5px] tracking-[1.5px] uppercase transition"
            style={{
              background: f.drugTargetOnly ? 'rgba(45, 212, 191, 0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${f.drugTargetOnly ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.08)'}`,
              color: f.drugTargetOnly ? '#5eead4' : 'rgba(255,255,255,0.55)',
            }}
          >
            {f.drugTargetOnly ? '✓' : '○'} Drug target only
          </button>
          {(f.functionClasses.size + f.geneFamilies.size + f.organs.size + f.plddtBands.size + f.burdens.size > 0
            || f.drugTargetOnly || f.search.length > 0) && (
            <button
              onClick={() => setF(emptyFilters())}
              className="text-[10.5px] tracking-[1.5px] uppercase text-white/40 hover:text-white/80 transition border-b border-white/10 hover:border-white/40 pb-px"
            >
              ✕ Clear all filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase">Sort</span>
            {(['score', 'gene', 'plddt', 'variants'] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setF({ ...f, sort: k })}
                className="rounded-full px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition"
                style={{
                  background: f.sort === k ? 'rgba(45, 212, 191, 0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${f.sort === k ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.08)'}`,
                  color: f.sort === k ? '#5eead4' : 'rgba(255,255,255,0.55)',
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="hidden sm:grid grid-cols-[80px_1fr_120px_70px_70px_60px] gap-3 px-4 py-2.5 text-[9.5px] tracking-[2px] text-white/40 uppercase border-b border-white/5">
          <div>Gene</div>
          <div>Function</div>
          <div>Organ · Family</div>
          <div className="text-right">Score</div>
          <div className="text-right">pLDDT</div>
          <div className="text-right">Variants</div>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-[12px] text-white/40 italic px-4 py-6 text-center">
              No proteins match these filters.
            </div>
          )}
          {filtered.map((p) => {
            const isSelected = selectedProtein?.gene === p.gene;
            return (
              <button
                key={`${p.gene}:${p.organ}`}
                onClick={() => onSelectProtein(p)}
                className="w-full text-left grid grid-cols-[1fr_auto] sm:grid-cols-[80px_1fr_120px_70px_70px_60px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-2 transition border-b border-white/3"
                style={{
                  background: isSelected ? `${p.organColor}1A` : 'transparent',
                  borderLeftWidth: isSelected ? '2px' : '0',
                  borderLeftColor: p.organColor,
                  borderLeftStyle: 'solid',
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-[12.5px] font-medium tracking-wide">{p.gene}</span>
                    <span className="hidden sm:inline text-[9.5px] text-white/35 font-mono">{p.uniprot}</span>
                  </div>
                  <div className="text-[9.5px] text-white/35 font-mono sm:hidden">{p.uniprot}</div>
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="text-[12px] text-white/75 truncate">{p.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Pill text={p.functionClass} color="#94a3b8" />
                    {p.isDrugTarget && <Pill text="Drug target" color="#2dd4bf" />}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1 text-[10.5px] text-white/55">
                    <span className="rounded-full" style={{ width: 5, height: 5, background: p.organColor }} />
                    {p.organLabel}
                  </div>
                  <div className="text-[9.5px] text-white/35 mt-0.5 truncate">{p.geneFamily.replace(/ \(.*$/, '')}</div>
                </div>
                <div className="text-right flex items-center gap-3 sm:block sm:gap-0">
                  <div className="sm:hidden flex items-center gap-1 text-[10px] text-white/55">
                    <span className="rounded-full" style={{ width: 5, height: 5, background: p.organColor }} />
                    {p.organLabel}
                  </div>
                  <div className="font-mono text-[12px] text-white/85">{p.score.toFixed(2)}</div>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="font-mono text-[12px]" style={{ color: plddtColor(p.plddtBand) }}>
                    {p.plddt != null ? p.plddt.toFixed(1) : '—'}
                  </div>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="font-mono text-[12px] text-white/85">
                    {p.variantCount != null ? (p.variantCount >= 500 ? '500+' : p.variantCount.toString()) : '—'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterRow<T extends string>({
  label, options, selected, onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: Set<T>;
  onChange: (set: Set<T>) => void;
}) {
  const toggle = (v: T) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] tracking-[1.5px] text-white/40 uppercase w-24">{label}</span>
      {options.map((o) => {
        const active = selected.has(o.value);
        return (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            className="rounded-full px-2.5 py-0.5 text-[10.5px] tracking-[0.5px] transition"
            style={{
              background: active ? 'rgba(45, 212, 191, 0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.08)'}`,
              color: active ? '#5eead4' : 'rgba(255,255,255,0.55)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[9px] tracking-[0.5px]"
      style={{ background: `${color}1A`, border: `1px solid ${color}33`, color: `${color}D9` }}
    >
      {text}
    </span>
  );
}

function plddtColor(band: PlddtBand): string {
  switch (band) {
    case 'Very high':    return '#34d399';
    case 'Confident':    return '#a3e635';
    case 'Low':          return '#facc15';
    case 'Very low':     return '#f87171';
    case 'No structure': return 'rgba(255,255,255,0.30)';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface EnrichedProteinForExport extends EnrichedProtein {}
export type { EnrichedProteinForExport };
