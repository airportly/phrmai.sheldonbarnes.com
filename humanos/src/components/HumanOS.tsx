import React, { useState, useCallback, useEffect } from 'react';
import HumanBody, { FRAMING_OPTIONS, type FramingPreset } from './HumanBody';
import ContextPanel from './ContextPanel';
import ChatPanel from './ChatPanel';
import VoicePanel from './VoicePanel';
import ComplexityMeter from './ComplexityMeter';
import DeepDiveOverlay from './deep-dives/DeepDiveOverlay';
import ConnectorLines from './ConnectorLines';
import ProteinChips from './ProteinChips';
import Onboarding from './Onboarding';
import DemoMode from './DemoMode';
import CommandPalette from './CommandPalette';
import KeyboardShortcuts from './KeyboardShortcuts';
import { apiPath } from '@/lib/base-path';
import ProteinCatalog from './ProteinCatalog';
import ConstellationMap from './ConstellationMap';
import GalaxyView from './GalaxyView';
import { proteinMapper, type Protein, type OrganKey } from '@/lib/protein-mapper';

/**
 * HumanOS - Top level component.
 *
 * Composes the body figure, eight context cards (4L/4R), complexity meter,
 * voice and chat panels into the full Table of Context interface. Owns the
 * global selection state (active organ, selected protein) and the conversation
 * history that flows through /api/chat to the Claude reasoning layer.
 *
 * If ANTHROPIC_API_KEY is configured the chat goes through Claude and the MCP
 * server. If not, queries fall back to local keyword matching against the
 * static protein dataset.
 */

type ConversationTurn = { role: 'user' | 'assistant'; content: string };
const HISTORY_CAP = 20;

export default function HumanOS() {
  const [selectedOrgan, setSelectedOrgan] = useState<OrganKey | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<Protein | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [aiReachable, setAiReachable] = useState<boolean | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedDisease, setExpandedDisease] = useState<string | null>(null);
  const [framing, setFraming] = useState<FramingPreset>('full');
  const [model, setModel] = useState<'neutral' | 'male' | 'female'>('neutral');
  const [injectedChat, setInjectedChat] = useState<{ text: string; key: number } | null>(null);
  const [viewMode, setViewMode] = useState<'body' | 'catalog' | 'constellation' | 'galaxy'>('body');
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [galaxyDiseaseFocus, setGalaxyDiseaseFocus] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Default the side panels to hidden on mobile so the central view gets the
  // whole viewport. The toggle still works to bring them back per session.
  // Only forces the default on the first mobile-match per mount; the user can
  // override by clicking the toggle.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    let appliedOnce = false;
    const update = () => {
      setIsMobile(mq.matches);
      if (mq.matches && !appliedOnce) {
        setPanelsVisible(false);
        appliedOnce = true;
      }
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Universal "select this protein" event so any deep-dive can offer a button
  // that routes back to the top-level selection state without prop drilling.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ gene?: string }>).detail;
      if (!detail?.gene) return;
      const protein = proteinMapper.findProteinByQuery(detail.gene);
      if (!protein) return;
      setSelectedProtein(protein);
      const organ = proteinMapper.getOrganForProtein(protein);
      if (organ) setSelectedOrgan(organ);
    };
    window.addEventListener('human-os:select-protein', onPick as EventListener);

    // Open a specific deep-dive card from anywhere (e.g. galaxy info card).
    const onOpenDeepDive = (e: Event) => {
      const detail = (e as CustomEvent<{ cardTitle?: string }>).detail;
      if (detail?.cardTitle) setExpandedCard(detail.cardTitle);
    };
    window.addEventListener('human-os:open-deep-dive', onOpenDeepDive as EventListener);

    return () => {
      window.removeEventListener('human-os:select-protein', onPick as EventListener);
      window.removeEventListener('human-os:open-deep-dive', onOpenDeepDive as EventListener);
    };
  }, []);

  // Probe /api/chat once on mount to know whether the live Claude path is wired up.
  useEffect(() => {
    let cancelled = false;
    fetch(apiPath('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], mode: 'text' }),
    })
      .then((r) => { if (!cancelled) setAiReachable(r.ok); })
      .catch(() => { if (!cancelled) setAiReachable(false); });
    return () => { cancelled = true; };
  }, []);

  // Restore selection from URL hash first, fall back to localStorage if no hash.
  // Hash supports: protein=GENE, organ=KEY, view=body|catalog|constellation|galaxy,
  // disease=DISEASE_KEY, panels=on|off.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);

    const apply = (proteinName: string | null, organName: string | null) => {
      if (proteinName) {
        const protein = proteinMapper.findProteinByQuery(proteinName);
        if (protein) {
          setSelectedProtein(protein);
          const organForProtein = proteinMapper.getOrganForProtein(protein);
          if (organForProtein) setSelectedOrgan(organForProtein);
          return true;
        }
      }
      if (organName) {
        const data = proteinMapper.getOrganData(organName as OrganKey);
        if (data) {
          setSelectedOrgan(organName as OrganKey);
          if (data.proteins.length > 0) setSelectedProtein(data.proteins[0]);
          return true;
        }
      }
      return false;
    };

    if (hash) {
      const params = new URLSearchParams(hash);
      const v = params.get('view');
      if (v === 'body' || v === 'catalog' || v === 'constellation' || v === 'galaxy') setViewMode(v);
      const d = params.get('disease');
      if (d) setGalaxyDiseaseFocus(d);
      const panels = params.get('panels');
      if (panels === 'off') setPanelsVisible(false);
      if (panels === 'on') setPanelsVisible(true);
      if (apply(params.get('protein'), params.get('organ'))) return;
      if (v || d) return; // Don't fall through to localStorage if a view-only deep link.
    }
    try {
      const saved = localStorage.getItem('human-os.last-selection.v1');
      if (saved) {
        const parsed = JSON.parse(saved) as { protein?: string; organ?: string };
        apply(parsed.protein ?? null, parsed.organ ?? null);
      }
    } catch {/* ignore */}
  }, []);

  // Mirror current selection into the URL hash and localStorage. The hash is
  // the canonical share/deep-link format. localStorage covers return visits
  // without an explicit hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (viewMode !== 'body') params.set('view', viewMode);
    if (galaxyDiseaseFocus && viewMode === 'galaxy') params.set('disease', galaxyDiseaseFocus);
    if (!panelsVisible) params.set('panels', 'off');
    if (selectedProtein) params.set('protein', selectedProtein.gene);
    else if (selectedOrgan) params.set('organ', selectedOrgan);
    const hash = params.toString();
    const target = hash ? `#${hash}` : '#';
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${target === '#' ? '' : target}`);
    }
    try {
      const payload = {
        protein: selectedProtein?.gene ?? null,
        organ: selectedOrgan ?? null,
      };
      if (payload.protein || payload.organ) {
        localStorage.setItem('human-os.last-selection.v1', JSON.stringify(payload));
      } else {
        localStorage.removeItem('human-os.last-selection.v1');
      }
    } catch {/* ignore quota / private mode */}
  }, [selectedProtein, selectedOrgan, viewMode, galaxyDiseaseFocus, panelsVisible]);

  const handleOrganClick = useCallback((organ: OrganKey) => {
    setSelectedOrgan((current) => {
      if (current === organ) {
        setSelectedProtein(null);
        return null;
      }
      const proteins = proteinMapper.getProteinsByOrgan(organ);
      setSelectedProtein(proteins.length > 0 ? proteins[0] : null);
      return organ;
    });
  }, []);

  const clearFilter = useCallback(() => {
    setSelectedOrgan(null);
    setSelectedProtein(null);
  }, []);

  const handleQuery = useCallback(async (query: string, mode: 'text' | 'voice' = 'text'): Promise<string> => {
    // Optimistic local state update so cards refresh while the AI call is in flight.
    const localProtein = proteinMapper.findProteinByQuery(query);
    if (localProtein) {
      setSelectedProtein(localProtein);
      const organ = proteinMapper.getOrganForProtein(localProtein);
      if (organ) setSelectedOrgan(organ);
    } else {
      const localOrgan = proteinMapper.findOrganByQuery(query);
      if (localOrgan) handleOrganClick(localOrgan);
    }

    const newHistory: ConversationTurn[] = [...conversation, { role: 'user', content: query }];

    try {
      const response = await fetch(apiPath('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory.slice(-HISTORY_CAP), mode }),
      });
      if (!response.ok) throw new Error(`api ${response.status}`);
      const data = await response.json();
      const text: string = (data.text || '').trim() || localFallbackResponse(query, localProtein);
      setConversation([...newHistory, { role: 'assistant' as const, content: text }].slice(-HISTORY_CAP));
      setAiReachable(true);
      return text;
    } catch {
      const text = localFallbackResponse(query, localProtein);
      setConversation([...newHistory, { role: 'assistant' as const, content: text }].slice(-HISTORY_CAP));
      setAiReachable(false);
      return text;
    }
  }, [conversation, handleOrganClick]);

  const complexity = selectedProtein ? proteinMapper.computeComplexity(selectedProtein) : 0;

  const resolveProtein = useCallback((organ: OrganKey, gene: string): Protein | null => {
    const proteins = proteinMapper.getProteinsByOrgan(organ);
    return proteins.find((p) => p.gene === gene) ?? null;
  }, []);

  const appendChat = useCallback((line: string) => {
    setConversation((c) => [...c, { role: 'assistant' as const, content: line }].slice(-HISTORY_CAP));
    setInjectedChat({ text: line, key: Date.now() });
  }, []);

  return (
    <div className="bg-[#070b20] rounded-2xl px-3 pt-4 pb-5 sm:px-7 sm:pt-6 sm:pb-7 relative overflow-hidden min-h-[640px] sm:min-h-[820px] max-w-[1480px] mx-auto"
         style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.4), inset 0 0 120px rgba(20,184,166,0.04)' }}>
      <BackgroundFX />

      <header className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-4 sm:mb-5">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[3.5px] text-white/40 font-light">TABLE OF CONTEXT</div>
          <div className="text-[18px] sm:text-[22px] tracking-[2px] text-white font-light mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            DRUG DISCOVERY
            <span className="text-[10px] tracking-[2px] text-cyan-300/60 font-medium">CARDIOMETABOLIC v1.0</span>
          </div>
          <ScopeLine selectedOrgan={selectedOrgan} onClear={clearFilter} />
        </div>
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:justify-end">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <PanelsToggle value={panelsVisible} onChange={setPanelsVisible} />
          <ReasoningStatus reachable={aiReachable} />
          <DemoMode
            setSelectedOrgan={setSelectedOrgan}
            setSelectedProtein={setSelectedProtein}
            setExpandedCard={setExpandedCard}
            resolveProtein={resolveProtein}
            appendChat={appendChat}
          />
          <VoicePanel onQuery={(q) => handleQuery(q, 'voice')} />
          {viewMode === 'body' && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className="bg-white/5 border border-white/10 text-white/60 px-3 py-2 rounded-full text-[11px] tracking-wide hover:bg-white/10 transition"
            >
              Auto-rotate {autoRotate ? '●' : '○'}
            </button>
          )}
        </div>
      </header>

      <div
        ref={gridRef}
        className={`relative z-10 grid gap-3 md:gap-5 items-start ${panelsVisible ? 'grid-cols-1 md:grid-cols-[200px_1fr_200px] lg:grid-cols-[240px_1fr_240px]' : 'grid-cols-[1fr]'}`}
      >
        {viewMode === 'body' && panelsVisible && !isMobile && (
          <ConnectorLines
            containerRef={gridRef}
            bodyYRange={{ top: 0, bottom: 540 }}
          />
        )}
        {panelsVisible && (
          <ContextPanel side="left" protein={selectedProtein} onCardClick={setExpandedCard} />
        )}
        <div className="flex flex-col items-center w-full min-h-[420px] sm:min-h-[540px]">
          {viewMode === 'body' ? (
            <>
              <HumanBody
                selectedOrgan={selectedOrgan}
                autoRotate={autoRotate}
                framing={framing}
                onOrganClick={handleOrganClick}
              />
              <BodyControls
                framing={framing}
                onFramingChange={setFraming}
                model={model}
                onModelChange={setModel}
              />
              <ProteinChips
                organ={selectedOrgan}
                selected={selectedProtein}
                onSelect={setSelectedProtein}
              />
              {selectedProtein && (
                <div className="mt-3 text-center">
                  <div className="text-[10px] tracking-[2px] text-white/40">SELECTED</div>
                  <div className="text-white text-base mt-0.5 font-medium tracking-wide">{selectedProtein.gene}</div>
                  <div className="text-[11px] text-white/45 mt-0.5">
                    {selectedProtein.uniprot} · {selectedProtein.name}
                  </div>
                </div>
              )}
            </>
          ) : viewMode === 'catalog' ? (
            <ProteinCatalog
              selectedProtein={selectedProtein}
              onSelectProtein={(p) => {
                setSelectedProtein(p);
                const organ = proteinMapper.getOrganForProtein(p);
                if (organ) setSelectedOrgan(organ);
              }}
            />
          ) : viewMode === 'constellation' ? (
            <ConstellationMap selectedProtein={selectedProtein} />
          ) : (
            <GalaxyView
              selectedProtein={selectedProtein}
              onSelectProtein={(gene) => {
                window.dispatchEvent(new CustomEvent('human-os:select-protein', { detail: { gene } }));
              }}
              targetDiseaseKey={galaxyDiseaseFocus}
              onDiseaseFocus={setGalaxyDiseaseFocus}
              onNarrate={appendChat}
            />
          )}
        </div>
        {panelsVisible && (
          <ContextPanel side="right" protein={selectedProtein} onCardClick={setExpandedCard} />
        )}
      </div>

      <div className="relative z-10 mt-6">
        <ComplexityMeter protein={selectedProtein} value={complexity} />
      </div>

      <div className="relative z-10 mt-5">
        <ChatPanel
          onQuery={(q) => handleQuery(q, 'text')}
          selectedProtein={selectedProtein}
          selectedOrgan={selectedOrgan}
          injected={injectedChat}
        />
      </div>

      <DeepDiveOverlay
        cardTitle={expandedCard}
        protein={selectedProtein}
        diseaseKey={expandedDisease}
        onSelectProtein={(p) => {
          setSelectedProtein(p);
          const organ = proteinMapper.getOrganForProtein(p);
          if (organ) setSelectedOrgan(organ);
        }}
        onSelectDisease={(key) => { setExpandedCard(null); setExpandedDisease(key); }}
        onClose={() => { setExpandedCard(null); setExpandedDisease(null); }}
      />

      <Onboarding alreadyHasSelection={selectedProtein != null || selectedOrgan != null} />
      <CommandPalette
        onSelectProtein={(p) => {
          setSelectedProtein(p);
          const organ = proteinMapper.getOrganForProtein(p);
          if (organ) setSelectedOrgan(organ);
        }}
        onSelectOrgan={(o) => handleOrganClick(o)}
        onSelectDisease={(key) => setExpandedDisease(key)}
      />
      <KeyboardShortcuts
        onSelectOrgan={handleOrganClick}
        onClearFilter={clearFilter}
      />
    </div>
  );
}

function localFallbackResponse(query: string, localProtein: Protein | null): string {
  if (localProtein) {
    return `${localProtein.gene}. ${localProtein.function}. ${localProtein.notes ?? ''}`.trim();
  }
  const organ = proteinMapper.findOrganByQuery(query);
  if (organ) {
    const proteins = proteinMapper.getProteinsByOrgan(organ);
    return `${proteinMapper.getOrganLabel(organ)}. ${proteins.length} proteins in scope.`;
  }
  return 'I did not catch that. Try a gene symbol like PCSK9 or an organ name like liver.';
}

function ScopeLine({ selectedOrgan, onClear }: { selectedOrgan: OrganKey | null; onClear: () => void }) {
  const [copied, setCopied] = useState(false);

  const share = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {/* ignore */});
    }
  };

  if (!selectedOrgan) {
    return (
      <div className="text-[10px] tracking-[1.5px] text-white/30 mt-1">
        13 diseases · 1,903 proteins · grounded in the cardiometabolic-research MCP
      </div>
    );
  }
  const data = proteinMapper.getOrganData(selectedOrgan);
  if (!data) return null;
  const diseasePhrase = data.diseases.length === 1 ? '1 disease' : `${data.diseases.length} diseases`;
  const proteinPhrase = data.proteins.length === 1 ? '1 protein' : `${data.proteins.length} proteins`;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <button
        onClick={onClear}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-[1.5px] uppercase transition hover:opacity-80"
        style={{
          background: `${data.color}1A`,
          border: `1px solid ${data.color}55`,
          color: data.color,
        }}
        title="Click to clear this filter"
      >
        <span className="rounded-full" style={{ width: 5, height: 5, background: data.color, boxShadow: `0 0 5px ${data.color}` }} />
        Filtered: {data.label}
        <span className="ml-1 opacity-60">✕</span>
      </button>
      <div className="text-[10px] tracking-[1.5px] text-white/55">
        {diseasePhrase} · {proteinPhrase}
      </div>
      <button
        onClick={share}
        className="text-[10px] tracking-[1.5px] text-white/40 hover:text-cyan-300/90 uppercase pb-px transition"
        title="Copy a deep link to this view"
      >
        {copied ? '✓ Copied' : 'Share'}
      </button>
      <button
        onClick={onClear}
        className="text-[10px] tracking-[1.5px] text-white/40 hover:text-white/80 uppercase border-b border-white/10 hover:border-white/40 transition pb-px"
      >
        Clear
      </button>
    </div>
  );
}

function PanelsToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="px-2.5 py-1.5 rounded-full text-[10px] tracking-[1.5px] uppercase transition flex items-center gap-1.5"
      style={{
        background: value ? 'rgba(255,255,255,0.04)' : 'rgba(45, 212, 191, 0.10)',
        border: `1px solid ${value ? 'rgba(255,255,255,0.10)' : 'rgba(45, 212, 191, 0.40)'}`,
        color: value ? 'rgba(255,255,255,0.55)' : '#5eead4',
      }}
      title={value ? 'Hide side panels for a wider view' : 'Show side panels'}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        {value ? (
          <>
            <rect x="1" y="2" width="3" height="12" rx="0.5" />
            <rect x="12" y="2" width="3" height="12" rx="0.5" />
            <rect x="6" y="2" width="4" height="12" rx="0.5" opacity="0.4" />
          </>
        ) : (
          <>
            <rect x="1" y="2" width="14" height="12" rx="0.5" opacity="0.4" />
            <path d="M5 8 L11 8" />
          </>
        )}
      </svg>
      {value ? 'Panels' : 'Wide'}
    </button>
  );
}

function ViewModeToggle({ value, onChange }: { value: 'body' | 'catalog' | 'constellation' | 'galaxy'; onChange: (v: 'body' | 'catalog' | 'constellation' | 'galaxy') => void }) {
  const labels: Record<'body' | 'catalog' | 'constellation' | 'galaxy', string> = {
    body: 'Body',
    catalog: 'Catalog',
    constellation: 'Constellation',
    galaxy: 'Galaxy',
  };
  const tips: Record<'body' | 'catalog' | 'constellation' | 'galaxy', string> = {
    body: 'Holographic body figure with clickable organs',
    catalog: 'Sortable, filterable table of all proteins',
    constellation: '2D star map of every protein, grouped by function class',
    galaxy: '3D universe of disease solar systems with click-to-fly travel',
  };
  return (
    <div className="flex rounded-full p-0.5"
         style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {(['body', 'catalog', 'constellation', 'galaxy'] as const).map((v) => {
        const active = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="px-2.5 py-1 rounded-full text-[10px] tracking-[1.5px] uppercase transition"
            style={{
              background: active ? 'rgba(45, 212, 191, 0.18)' : 'transparent',
              color: active ? '#2dd4bf' : 'rgba(255,255,255,0.55)',
            }}
            title={tips[v]}
          >
            {labels[v]}
          </button>
        );
      })}
    </div>
  );
}

function BodyControls({
  framing,
  onFramingChange,
  model,
  onModelChange,
}: {
  framing: FramingPreset;
  onFramingChange: (f: FramingPreset) => void;
  model: 'neutral' | 'male' | 'female';
  onModelChange: (m: 'neutral' | 'male' | 'female') => void;
}) {
  return (
    <div className="mt-2 flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-1">
        {FRAMING_OPTIONS.map((opt) => {
          const active = opt.key === framing;
          return (
            <button
              key={opt.key}
              onClick={() => onFramingChange(opt.key)}
              className="px-2.5 py-1 rounded-full text-[10px] tracking-[1.2px] uppercase transition"
              style={{
                background: active ? 'rgba(45, 212, 191, 0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#5eead4' : 'rgba(255,255,255,0.55)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {(['neutral', 'male', 'female'] as const).map((m) => {
            const active = m === model;
            const disabled = m === 'female';
            return (
              <button
                key={m}
                onClick={() => !disabled && onModelChange(m)}
                disabled={disabled}
                title={disabled ? 'Female model requires a separately licensed dataset (Visible Human Project, MakeHuman-derived, or commercial). Z-Anatomy ships male-only. Not in v1.' : `Use ${m} reference model`}
                className="px-2.5 py-1 rounded-full text-[9.5px] tracking-[1.5px] uppercase transition disabled:cursor-not-allowed"
                style={{
                  background: active ? 'rgba(127, 119, 221, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(127, 119, 221, 0.45)' : 'rgba(255,255,255,0.07)'}`,
                  color: disabled ? 'rgba(255,255,255,0.20)' : active ? '#a3a1ed' : 'rgba(255,255,255,0.45)',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
        <div className="text-[9px] tracking-[1.5px] text-white/30 uppercase">Drag · Scroll · Click organ</div>
      </div>
    </div>
  );
}

function ReasoningStatus({ reachable }: { reachable: boolean | null }) {
  const [showHelp, setShowHelp] = useState(false);
  if (reachable === null) return null;
  const live = reachable === true;
  return (
    <div className="relative">
      <button
        onClick={() => !live && setShowHelp((s) => !s)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9.5px] tracking-[1.5px] uppercase transition"
        style={{
          background: live ? 'rgba(45, 212, 191, 0.10)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${live ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255,255,255,0.10)'}`,
          color: live ? '#2dd4bf' : 'rgba(255,255,255,0.45)',
          cursor: live ? 'default' : 'pointer',
        }}
        title={live ? 'Claude API reachable; queries route through MCP-attached Claude.' : 'Click for setup instructions.'}
      >
        <span
          className="rounded-full"
          style={{
            width: '5px',
            height: '5px',
            background: live ? '#2dd4bf' : 'rgba(255,255,255,0.4)',
            boxShadow: live ? '0 0 6px #2dd4bf' : 'none',
          }}
        />
        <span>{live ? 'AI live' : 'AI offline'}</span>
      </button>
      {showHelp && !live && (
        <div
          className="absolute right-0 top-full mt-2 w-[300px] rounded-lg p-3.5 z-50"
          style={{
            background: 'rgba(10, 14, 39, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-1.5">Enable live Claude</div>
          <ol className="text-[11.5px] text-white/75 leading-relaxed space-y-1.5 list-decimal pl-4">
            <li>Get an API key at console.anthropic.com</li>
            <li>In the project root: <code className="text-cyan-300/85 font-mono text-[10.5px]">cp .env.local.example .env.local</code></li>
            <li>Add <code className="text-cyan-300/85 font-mono text-[10.5px]">ANTHROPIC_API_KEY=…</code> in <code className="text-cyan-300/85 font-mono text-[10.5px]">.env.local</code></li>
            <li>Restart dev server: <code className="text-cyan-300/85 font-mono text-[10.5px]">pkill -f &quot;next dev&quot; &amp;&amp; npm run dev</code></li>
          </ol>
          <div className="text-[10px] text-white/35 mt-2 leading-snug">
            Until then, queries fall back to local keyword matching against the static dataset.
          </div>
        </div>
      )}
    </div>
  );
}

function BackgroundFX() {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(20, 184, 166, 0.10) 0%, transparent 70%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 50% 30% at 50% 100%, rgba(127, 119, 221, 0.08) 0%, transparent 70%)',
      }} />
      <StarField />
    </>
  );
}

function StarField() {
  const stars = React.useMemo(() => {
    return Array.from({ length: 120 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.6 + 0.4,
      opacity: Math.random() * 0.6 + 0.15,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute bg-white rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}
