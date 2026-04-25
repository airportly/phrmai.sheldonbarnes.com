# Handoff to Claude Code

This is a project handoff document. It tells Claude Code (or any engineer) exactly how to consume this project and execute the build.

## What this project is

Human OS is a holographic, voice-interactive clinical AI interface for cardiometabolic drug discovery. It is the user-facing layer of a Clinical AI Center of Excellence vision being developed by Sheldon Barnes within the PhrmAI Series at Barnes Organization LLC-S.

The full vision is in `docs/VISION.md`. The visual target is captured in the reference screenshot the user shared in the originating chat conversation, showing a Table of Context interface with a holographic body figure surrounded by eight context cards on a deep space background.

## How this project was created

This project was prepared by Claude (the chat instance) during a long conversation with Sheldon Barnes that explored the cardiometabolic-research MCP server, validated the architectural pattern with working prototypes, and culminated in a request to write a comprehensive handoff package for execution by Claude Code.

The chat could not run Blender, could not download anatomical assets, and could not deploy code. Those steps are for Claude Code to execute.

## What is in the handoff

### Documentation (in `docs/`)

- `VISION.md` - Strategic context, what Human OS is, scope, success criteria
- `BUILD_PHASES.md` - Five-phase execution sequence with effort estimates
- `DESIGN_SPEC.md` - Visual language: colors, typography, layout, animations
- `MCP_INTEGRATION.md` - Cardiometabolic-research MCP server tools and usage
- `ANATOMICAL_ASSETS.md` - BodyParts3D and Z-Anatomy sourcing and conversion
- `CLAUDE_API.md` - Claude API integration architecture for the voice layer
- `LICENSING.md` - Attribution requirements for third-party assets

### Code stubs (in `src/`)

- `src/components/HumanOS.tsx` - Top-level component composing all the pieces
- `src/components/HumanBody.tsx` - Three.js scene with rotating body and clickable organs
- `src/components/ContextCard.tsx` - Single context card with title, value, dot rating
- `src/components/ContextPanel.tsx` - Layout of four cards on left or right
- `src/components/ChatPanel.tsx` - Text chat interface
- `src/components/VoicePanel.tsx` - Mic button and voice input handling
- `src/lib/protein-mapper.ts` - Organ-to-protein lookup logic
- `src/lib/mcp-client.ts` - MCP server wrapper (with static fallback for Phase 1)
- `src/lib/claude-client.ts` - Anthropic SDK wrapper for Phase 3
- `src/lib/prompts.ts` - System prompts for the Human OS persona
- `src/lib/voice.ts` - Web Speech API wrapper hook
- `src/data/fma-protein-mapping.json` - Live protein data for 6 organs from MCP
- `src/data/disease-metadata.json` - All 13 cardiometabolic diseases with EFO IDs

### Build scripts (in `scripts/`)

- `setup.sh` - Initialize Next.js project with all dependencies
- `download-bodyparts3d.sh` - Fetch BodyParts3D archive from DBCLS Japan
- `convert-meshes.py` - Run Blender headless to convert OBJ to GLB
- `README.md` - Documentation for the script sequence

## How Claude Code should execute this

### Step 1: Verify the environment

Check that Node.js 18+, npm, Python 3.7+, and Blender are installed. If any are missing, install them or guide the user through installation.

### Step 2: Run the setup script

```bash
cd /Users/sheldonbarnes/code/human-os
bash scripts/setup.sh
```

This initializes the Next.js project with all dependencies and configuration files. After this, the project should run in dev mode (`npm run dev`) even without anatomical assets, falling back to procedural geometry.

### Step 3: Download and convert anatomical assets

```bash
bash scripts/download-bodyparts3d.sh
python3 scripts/convert-meshes.py
```

This produces GLB files in `public/assets/anatomy/`. Total time: 5 to 15 minutes.

### Step 4: Run the dev server and verify Phase 1

```bash
npm run dev
```

Open http://localhost:3000 in a browser. Verify:
- Body figure loads and rotates
- Organs are visible and clickable
- Clicking an organ surfaces protein data
- Clicking a protein populates all eight cards
- Voice button works (in Chrome or Edge)
- Chat interface accepts text input

If any of these fail, debug iteratively. The code stubs are designed to work but may need adjustments based on actual Three.js, Next.js, or browser behavior.

### Step 5: Phase 2 (live MCP integration)

Configure `.env.local` with the MCP server URL. The `src/lib/mcp-client.ts` module automatically switches to live mode when `MCP_SERVER_URL` is set.

### Step 6: Phase 3 (Claude API voice integration)

Configure `.env.local` with the Anthropic API key. The `pages/api/chat.ts` route handles the server-side Claude calls. The frontend `ChatPanel.tsx` and `VoicePanel.tsx` need to be updated to POST to `/api/chat` instead of using local keyword matching.

### Step 7: Phase 4 and Phase 5

Build out the deep-dive panels and visual polish per `docs/BUILD_PHASES.md`.

## Important constraints

The user has specific writing preferences captured throughout the documentation. They never use dashes (em, en, or hyphens as sentence connectors). All copy in the interface and documentation should follow this convention. The system prompt in `src/lib/prompts.ts` instructs Claude to follow this rule when generating responses.

The cardiometabolic-research MCP server is scoped to 13 diseases. Queries outside this scope return empty results. The interface should make this scope visible (the "Cardiometabolic v1.0" label in the header is the current implementation).

The reference screenshot is the visual target. Every design decision should be benchmarked against whether it moves closer to or further from that screenshot.

## What the user wants out of this

A working, beautiful, voice-interactive clinical AI interface that can be demoed to senior pharma stakeholders to communicate the Clinical AI Center of Excellence vision. The interface should feel like a product, not a prototype. It should be grounded in real data from the cardiometabolic database. It should respond to voice queries with natural conversational answers.

The user is a sophisticated technical leader who is also writing two books that this project will inform. The project deserves engineering work of the same quality as a production internal tool, not throwaway demo code.

## Where to ask questions

The originating chat conversation contains all the architectural reasoning, the working prototype that demonstrates the navigation pattern, and the live database exploration that produced the protein data in `src/data/fma-protein-mapping.json`. If clarification is needed on any design decision, refer back to that conversation.

For decisions not covered in the documentation, prefer:
- Real data over mock data (call the MCP server)
- Prose over bullets in user-facing content
- Performance over visual flourish (the body figure must load fast)
- Working code over speculative architecture

## Final note

This handoff was assembled by Claude during a conversation. The chat could not execute the actual build. Claude Code can. The relationship is: chat designs and validates the architecture, Code executes the implementation. Both instances are running on the same underlying model, with different tool access patterns.

Treat this handoff as a strong starting point and iterate from there based on what you find when you actually run the code. The architectural decisions are sound, but implementation details may surprise you. That is expected. Adjust as needed.
