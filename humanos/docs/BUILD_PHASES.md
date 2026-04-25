# Build Phases

This document defines the execution sequence for Human OS. Each phase ships a usable artifact. You can demo at the end of any phase.

## Phase 1: Static prototype with anatomical body

**Goal**: A rotating 3D body model loads, six organs are clickable, clicking an organ surfaces hardcoded protein data, clicking a protein populates all eight context cards.

**Success criteria**:
- Next.js project initialized with TypeScript and Tailwind
- BodyParts3D meshes downloaded and converted to GLB
- Three.js scene loads the GLB body model in under 3 seconds
- Holographic shader applied (translucent cyan emissive shell, wireframe overlay)
- Six organs (brain, heart, liver, pancreas, kidneys, adipose) rendered as colored emissive meshes
- Hover-to-highlight works on each organ
- Click-to-select surfaces the protein list from `src/data/fma-protein-mapping.json`
- Eight context cards render with appropriate colors and dot ratings
- Context complexity meter computes a real value from the protein data
- Auto-rotate toggle works
- Visual style matches the reference screenshot at roughly 70% fidelity

**Files to produce**:
- `src/components/HumanBody.tsx` - Three.js scene with the body model
- `src/components/ContextCard.tsx` - Single card component with title, value, dots
- `src/components/ContextPanel.tsx` - Layout for the eight cards plus complexity meter
- `src/components/ChatPanel.tsx` - Text chat interface (voice comes in Phase 3)
- `src/components/HumanOS.tsx` - Top-level component composing all the pieces
- `src/lib/protein-mapper.ts` - Maps clicked organs to protein lists
- `src/data/fma-protein-mapping.json` - Hardcoded data for v1 (replace in Phase 2)
- `src/data/disease-metadata.json` - Disease names, colors, descriptions
- `pages/index.tsx` - Next.js entry point

**Estimated effort**: 2 to 3 days for one engineer comfortable with Three.js and React.

## Phase 2: Live MCP integration

**Goal**: All hardcoded data is replaced with live calls to the cardiometabolic-research MCP server. The interface works against the actual database in real time.

**Success criteria**:
- MCP client wrapper in `src/lib/mcp-client.ts` exposes typed functions for `search_proteins_by_disease`, `get_protein_details`, `get_pathogenic_variants`, `search_similar_proteins_semantic`
- Clicking an organ triggers a `search_proteins_by_disease` call for each disease associated with that organ
- Clicking a protein triggers a `get_protein_details` call
- The Patient Population Variance card pulls live variant counts from `get_pathogenic_variants`
- The Protein Binding card optionally pulls semantic neighbors from `search_similar_proteins_semantic`
- All cache appropriately so repeated queries are fast
- Loading states are visible while queries are in flight (no blank cards)
- Error handling for MCP server unavailable, including a fallback to last-known data

**Files to produce or update**:
- `src/lib/mcp-client.ts` - Typed MCP wrapper
- `src/lib/cache.ts` - Simple in-memory cache for MCP responses
- All Phase 1 components updated to consume from MCP rather than static JSON
- `src/data/fma-disease-mapping.json` - Maps FMA IDs to disease names that the MCP server understands

**Estimated effort**: 2 to 3 days. The MCP wrapper is straightforward. The harder part is graceful degradation when the server is slow or unavailable.

## Phase 3: Voice and Claude API integration

**Goal**: Users can ask questions in natural language by voice or text. Claude interprets the query, calls the relevant MCP tools, and responds in natural language. The response is spoken back to the user.

**Success criteria**:
- Web Speech API is wired for input. User clicks the mic, speaks a query, the transcript appears in the chat.
- The transcript is sent to a backend route that calls the Anthropic API with the cardiometabolic-research MCP server attached
- Claude reasons over the query, calls the appropriate MCP tools, and produces a response
- The response is rendered in the chat panel as text
- The text is also spoken back via SpeechSynthesis API
- The interface state updates appropriately. If Claude mentions PCSK9, the cards populate with PCSK9 data.
- A typed-text fallback is always available for users without voice support
- The Claude API call uses the prompt template in `src/lib/prompts.ts` which constrains responses to grounded data only

**Files to produce**:
- `src/components/VoicePanel.tsx` - Mic button and listening state
- `src/lib/voice.ts` - Web Speech API wrapper
- `src/lib/claude-client.ts` - Anthropic API wrapper with MCP attached
- `src/lib/prompts.ts` - System prompt for the Human OS persona
- `pages/api/chat.ts` - Backend route that calls Claude with MCP

**Estimated effort**: 3 to 4 days. The voice integration is straightforward. The Claude-with-MCP integration is the harder part because the prompt design and the response parsing both need care.

## Phase 4: First card deep-dive

**Goal**: At least one context card has a fully functional deep-dive view. The Patient Population Variance card is the recommended starting point because the data is rich and the visualization is well-defined.

**Success criteria**:
- Clicking the Patient Population Variance card opens a panel showing per-residue pathogenic variant density for the currently selected protein
- The panel renders a residue-level heatmap with positions on the x-axis and variant count on the y-axis
- Hotspots are highlighted (positions with multiple distinct pathogenic substitutions)
- Hovering a position shows the specific variants at that position
- The data comes from `get_pathogenic_variants` for the selected UniProt accession
- The panel can be closed to return to the main interface
- Other cards have placeholder deep-dive panels that say "coming soon" rather than being missing

**Files to produce**:
- `src/components/VariantDeepDive.tsx` - Residue-level heatmap
- `src/lib/variant-analysis.ts` - Hotspot detection logic
- Other card placeholder panels in `src/components/deep-dives/`

**Estimated effort**: 2 to 3 days. The variant heatmap is the main work. Other cards can be stubbed.

## Phase 5: Visual polish to match the reference screenshot

**Goal**: The interface visually matches the reference screenshot at 90%+ fidelity. This is the polish phase, not the functional phase.

**Success criteria**:
- Molecular floaters orbit the body figure (small spinning SVG molecules drifting in slow orbits)
- Dashed connector lines link each context card to its corresponding body region
- Post-processing effects: subtle bloom on emissive surfaces, very subtle chromatic aberration on wireframe edges
- Star field background with proper depth and parallax
- Smooth transitions between organ selections (camera ease, opacity fade on cards)
- Loading states that fit the holographic aesthetic (not generic spinners)
- Typography refined to match the screenshot (look at letter-spacing and font weights specifically)
- Color palette tuned to match the reference exactly (use a color picker on the screenshot to verify)

**Files to produce or update**:
- `src/components/MolecularFloaters.tsx` - SVG-based orbiting molecules
- `src/components/ConnectorLines.tsx` - SVG dashed lines between cards and body
- `src/lib/postprocessing.ts` - Three.js EffectComposer setup for bloom and chromatic aberration
- All component styling updated for the polished aesthetic

**Estimated effort**: 3 to 5 days. Polish is open-ended. Set a hard deadline.

## Optional Phase 6: Z-Anatomy upgrade

**Goal**: Replace BodyParts3D with the Z-Anatomy meshes for higher visual quality and more anatomical accuracy.

**Decision criteria**: Only do this if the Phase 5 polish is complete and the visual quality is still not where you want it. The BodyParts3D meshes are sufficient for v1 and the Z-Anatomy upgrade is a several-day effort with diminishing returns once the lighting and shaders are tuned correctly.

**Estimated effort**: 3 to 4 days, but only if needed.

## Total timeline

Sequential: 12 to 18 days for one engineer working full-time. Realistic with normal interruptions: 4 to 6 weeks. Demo-quality after Phase 1 (2-3 days). Internal-tool quality after Phase 3 (1-2 weeks). Pitch-quality after Phase 5 (4-6 weeks).

## Recommended sequencing if time is tight

If you need to demo in 1 week, do Phases 1 and 2. The hardcoded-to-live transition is the architectural argument; the visual polish is presentation.

If you need to demo in 2 weeks, add Phase 3. The voice interaction is the moment that makes stakeholders lean forward.

If you have 4 to 6 weeks, do all five phases. Phase 5 is what makes the difference between "interesting prototype" and "this looks like a product."
