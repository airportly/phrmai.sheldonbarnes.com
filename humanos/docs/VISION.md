# Human OS Vision Document

## Strategic context

Human OS is the user-facing layer of a Clinical AI Center of Excellence platform being developed at Barnes Organization LLC-S, PhrmAI Series. The platform sits at the intersection of three professional initiatives: the PhrmAI Clinical AI and Automation Center of Excellence, the Prediction Stack framework for AI in drug discovery (Target Selection, Molecule Behavior, Clinical Outcomes), and the Clinical One enterprise AI platform vision documented in the technical book in progress.

The platform is grounded in a curated Cardiometabolic Disease database (v1.0) covering 13 diseases: diabetes mellitus, obesity, metabolic syndrome, non-alcoholic fatty liver disease, coronary artery disease, myocardial infarction, heart failure, hypertension, dyslipidemia, atherosclerosis, atrial fibrillation, stroke, and familial hypercholesterolemia. The database loads roughly 2,365 proteins with AlphaFold v6 structural confidence, AlphaMissense pathogenic variant data, OpenTargets disease association scores, and semantic embeddings for functional similarity searches.

Human OS is the interface that makes this database usable by clinical researchers, medicinal chemists, and pharma R&D leaders without requiring them to write database queries or interpret raw protein lists. The body figure becomes the navigation primitive because pharma stakeholders think in tissues and patients, not in genes and embeddings.

## What Human OS is

A web-based interactive interface with five core elements:

A rotating 3D anatomical body figure rendered with Three.js, using BodyParts3D meshes (or Z-Anatomy if the upgrade is taken) with a holographic shader treatment (translucent cyan emissive shell, colored emissive organs, wireframe overlay).

Eight context cards arranged around the body, four on each side, each surfacing one dimension of context for the currently selected protein: Molecular Structure, Protein Binding, Signaling Pathways, ADME Profile, Patient Population Variance, Dark Proteome and Gaps, Toxicity and Safety Signals, Unknown Unknowns.

A context complexity meter at the bottom, showing how many of the eight context dimensions have data for the selected protein. Real number, computed from data presence, not a placeholder.

A chat panel for text and voice interaction. Users can click organs and proteins, but they can also ask "tell me about PCSK9" or "what proteins should I worry about for someone with both diabetes and atherosclerosis" and receive grounded answers.

A voice interface using the Web Speech API for input and the SpeechSynthesis API for output, with the option to route queries through the Claude API for natural language understanding and response generation grounded in MCP data.

## Why this design

The body figure as navigation is the central design decision. Most pharma software starts from molecules or pathways. Clinicians and pharma R&D leaders think in tissues and diseases. Putting the body at the center matches their mental model and makes the tool feel native to clinical reasoning rather than to bioinformatics.

The eight context cards are derived from the Table of Context concept image referenced during the chat conversation. They map cleanly to the Prediction Stack framework: Target Selection happens at the protein search and disease association layer, Molecule Behavior happens at the structure and binding layers, Clinical Outcomes happens at the patient variance and toxicity layers.

Voice interaction is not decoration. It is what makes the interface work in clinical settings where the user has their hands on a model or a sample. The voice layer also creates a natural integration point for Claude reasoning: the user speaks, Claude interprets the query, MCP retrieves the data, Claude synthesizes the response, and the speech synthesis layer reads it back.

The grounded retrieval architecture is the technical core. Every fact shown to the user must trace to a specific tool call against the cardiometabolic-research MCP server. No training-time recall. No confabulation. This is the property that distinguishes Human OS from a general-purpose chatbot wrapper.

## Scope of the v1 build

Six organs in the body figure: brain, heart, liver, pancreas, kidneys, adipose. These cover all 13 cardiometabolic diseases through their primary tissue associations.

Roughly 25 to 30 proteins surfaced through the organ navigation, drawn from the highest-association-score proteins for each disease. The full database has more, but the v1 navigation focuses on the most clinically relevant.

Six of eight context cards populated with live data. ADME and full Toxicity require external integrations (DrugBank, FAERS) that are out of scope for v1 but trivial to add later.

Web Speech API for voice, with a stub interface to the Anthropic API for the conversational reasoning layer. The Claude API integration is part of v1 because it is what makes the interface feel intelligent rather than just searchable.

Single-user, no auth, no persistence. This is a demo and internal tool, not a multi-tenant platform. Auth and persistence come later if the Center of Excellence pitch lands and the tool gets formal funding.

## Out of scope for v1

Mobile responsiveness. The interface assumes a desktop or laptop screen with at least 1280x720 resolution. Mobile is a future concern.

Internationalization. English only.

Multi-protein selection and comparison views. The v1 interface shows one protein at a time. Comparison features are a v2 enhancement.

Treatment timeline or longitudinal patient data. The interface is cross-sectional. Adding temporal data is a major architectural extension that should be scoped separately.

Direct integration with experimental wet-lab systems. The interface is a query and decision-support tool. It does not directly trigger experiments.

## Success criteria

Phase 1: A rotating 3D body model loads in under 3 seconds, six organs are clickable with hover highlighting, clicking an organ surfaces its associated proteins from a static dataset, clicking a protein populates all eight cards with hardcoded data, the context complexity meter updates correctly.

Phase 2: All hardcoded data is replaced with live MCP calls. The interface works against the live cardiometabolic-research server. Protein lists, pLDDT values, disease scores, and variant counts come from the database in real time. Latency under 1 second for any single query.

Phase 3: The voice interface is functional. Users can ask "tell me about PCSK9" and receive a spoken response grounded in MCP data. The Claude API integration handles natural language understanding and response generation.

Phase 4: At least one context card has a deep-dive view. The Patient Population Variance card opens a residue-level pathogenic variant heatmap when clicked. Other cards have placeholders for future deep-dives.

Phase 5: The visual polish matches the reference screenshot. Molecular floaters orbit the body. Dashed connector lines link cards to body regions. Post-processing effects (subtle bloom on emissive surfaces, chromatic aberration on wireframe edges) elevate the holographic feel.

## Reference materials

- The reference screenshot showing the Table of Context aesthetic is the primary visual target. Every design decision should be benchmarked against whether it moves closer to or further from that screenshot.
- The chat conversation that produced this vision document contains the architectural reasoning, the MCP tool exploration, and the working prototype that demonstrates the navigation pattern. Treat the prototype as a low-fidelity proof of concept; this build replaces it with a high-fidelity production version.
- The cardiometabolic-research MCP server is the data layer. Tool reference is in `docs/MCP_INTEGRATION.md`.
- BodyParts3D download and licensing reference is in `docs/ANATOMICAL_ASSETS.md`.
- Claude API integration reference is in `docs/CLAUDE_API.md`.

## Constraints worth knowing

The cardiometabolic-research database is scoped to 13 diseases. Queries outside that scope will return empty results. This is a feature, not a bug. The Human OS interface should make this scope visible to the user (a small "Cardiometabolic v1.0" label somewhere in the chrome) rather than pretending to be a general-purpose tool.

The AlphaFold v6 pLDDT data is per-residue. The mean pLDDT shown in the Molecular Structure card is computed from the per-residue distribution. For deep-dive views that show structural confidence regions, pull the per-residue data and render it as a colored ribbon.

The AlphaMissense data is filtered to the pathogenic class only. Benign and ambiguous variants are not loaded. The Patient Population Variance card should make this explicit ("pathogenic variants only") so users do not draw incorrect conclusions about variant landscapes.

The semantic embedding tool returns proteins ranked by cosine similarity to a query text. It is useful for the shadow protein discovery workflow but should not be presented as a drop-in replacement for OpenTargets disease association. The two signals are complementary, not equivalent.

## Architectural philosophy

Build the data layer right and the visual layer becomes straightforward. The cardiometabolic-research MCP server is the data layer. Three.js plus React is the rendering layer. Claude API is the reasoning layer. The Web Speech API is the input/output layer. Each layer has a single clear responsibility, and the architecture is readable to any engineer who has worked with modern web stacks.

The Prediction Stack framework maps onto the layers: Target Selection lives in the MCP queries, Molecule Behavior lives in the structure and binding views, Clinical Outcomes lives in the variance and toxicity views. The book in progress can use Human OS as the worked example for each chapter, with the architecture diagrams in the book mirroring the file organization in this project.

Voice and natural language interaction are not future features. They are part of v1. The interface should feel like a conversation with the database, not a query form bolted onto a 3D viewer. Claude is the conversational layer. MCP is the truth layer. The integration of the two is what makes Human OS work.
