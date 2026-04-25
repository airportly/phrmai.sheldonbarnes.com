# Design Specification

This document defines the visual language of Human OS. The reference is the Table of Context screenshot showing a holographic body figure surrounded by eight context cards on a deep space background. Every design decision should be benchmarked against that reference.

## Core aesthetic

The interface should feel like a clinical command center on a research vessel. Holographic, premium, slightly futuristic, but never cartoonish or video-game-like. The references that capture the right tone are the heads-up displays in serious science fiction (Interstellar, The Expanse) rather than action games. Clinical authority, not gaming pizzazz.

## Color palette

**Background**: Deep space navy, hex `#0a0e27` for the primary surface. Add a subtle radial gradient with cyan at center fading to pure navy at edges, opacity around 8%.

**Star field**: Pure white dots at varying opacities (0.2 to 0.9) and sizes (0.5px to 2.5px). Sparse density, around 80 stars per 1000x1000 viewport area.

**Body shell**: Cyan emissive, hex `#2dd4bf`, with translucent fill at 12% opacity and wireframe overlay at 25% opacity. The body should glow softly without overwhelming the organs inside.

**Organ colors** (matching the screenshot's category palette):
- Brain: Purple `#7F77DD`
- Heart: Coral `#D85A30`
- Liver: Amber `#BA7517`
- Pancreas: Teal/green `#1D9E75`
- Kidneys: Blue `#185FA5` (or a slightly desaturated `#378ADD`)
- Adipose: Pink `#993556` (or `#D4537E` if too dark)

**Card colors** (per the screenshot legend):
- Molecular Structure: Emerald green `#10b981`
- Protein Binding: Purple `#a78bfa`
- Variants: Cyan `#22d3ee`
- Toxicity: Amber `#fbbf24`
- Signaling: Light purple `#c084fc`
- Patient Population: Yellow `#facc15`
- Dark Proteome: Mint `#34d399`
- Unknown Unknowns: Red `#f87171`

**Accent**: Cyan `#2dd4bf` for primary actions, amber `#fbbf24` for warnings or context complexity at high values, red `#f87171` only for errors.

**Text**:
- Primary: Pure white `#ffffff`
- Secondary: White at 70% opacity
- Tertiary: White at 50% opacity
- Hint: White at 35% opacity

## Typography

**Font family**: System font stack. SF Pro on macOS, Segoe UI on Windows, Inter as a webfont fallback. Do not use a decorative or futuristic display font. The interface should feel premium, not gimmicky.

**Sizes**:
- Card title (uppercase, letterspaced): 9px, letter-spacing 1.5px, weight 500
- Card main value: 13px, weight 500
- Card subtitle: 11px, weight 400
- Section heading: 18px, weight 500
- Body text: 13px, weight 400
- Chat messages: 13px, weight 400, line-height 1.6
- Tiny labels (CONTEXT COMPLEXITY etc): 10px, letter-spacing 2px

**Sentence case** for body text. **UPPERCASE** for tiny section labels with letter-spacing. Never title case.

## Layout

**Viewport target**: 1280x720 minimum, optimized for 1440x900 and 1920x1080.

**Grid**: Three-column layout with the body figure in the center column.
- Left column: 220px wide, four context cards stacked vertically with 10px gaps
- Center column: Flexible, contains the 3D body canvas (480px tall) and the context complexity meter
- Right column: 220px wide, four context cards stacked vertically with 10px gaps

**Below the body**: Chat panel spanning the full width. Up to 200px tall with internal scroll. Expandable to fullscreen if the user wants a longer conversation.

**Above the body**: Header with the Human OS branding, a "Cardiometabolic v1.0" scope label, the mic button, and the auto-rotate toggle.

## 3D body figure

**Camera**: Perspective camera at 40 degrees field of view. Position at (0, 0.2, 4.2) so the body fills most of the canvas vertically with a small amount of headroom and footroom. Looking at the origin.

**Lighting**:
- Ambient light: Soft blue `#4a6da7` at 60% intensity for fill
- Key light: Cyan `#2dd4bf` point light at (0, 1, 3), intensity 1.2, range 10
- Rim light: Purple `#7F77DD` point light at (-3, 0, -1), intensity 0.6, range 10

**Body shell shader**:
- Material: MeshPhongMaterial with color `#2dd4bf`, opacity 0.12, shininess 80, specular `#2dd4bf`
- Wireframe overlay: MeshBasicMaterial with same color, wireframe true, opacity 0.25

**Organ materials**:
- MeshPhongMaterial with the organ color, opacity 0.7, emissive same as color, emissiveIntensity 0.5
- Halo glow: Larger sphere around each organ, MeshBasicMaterial, opacity 0.15, scale 1.4x the organ
- Pulsing animation: emissiveIntensity oscillates between 0.3 and 0.7 with sine wave at 0.002 Hz

**Hover state**: Organ emissiveIntensity ramps to 1.0 over 200ms. Halo opacity ramps to 0.3. Cursor changes to pointer.

**Selected state**: Organ stays at high emissive, halo pulses faster, the rest of the body shell dims slightly to draw focus.

**Auto-rotation**: 0.004 radians per frame around the Y axis, equivalent to one full rotation per 26 seconds at 60fps. Toggleable.

**Grid floor**: Plane geometry 8x8 with 20x20 subdivisions, wireframe material at `#2dd4bf` with opacity 0.2. Positioned at y=-2.4. This is the cyan grid floor visible in the reference screenshot.

## Context cards

**Container**: 
- Background: `rgba(255, 255, 255, 0.04)` for a barely-visible glassy fill
- Border: 1px solid in the card's accent color at 25% opacity
- Border radius: 10px
- Padding: 10px 12px
- Backdrop filter: blur(10px) for a frosted-glass effect
- Width: 220px, height auto (typically 100-120px)

**Internal layout**:
- Title row: 9px uppercase title in card accent color, letter-spaced 1.5px
- Main value: 13px white, weight 500, max one line
- Subtitle: 11px white at 55% opacity, max one line  
- Dot rating: Five 5px dots at 4px gaps, filled in card accent color or `rgba(255,255,255,0.15)` for empty

**Empty state**: When no protein is selected, all cards show "—" with empty dots. The cards are still visible to convey the structure of the interface.

**Hover state**: Card border opacity ramps from 25% to 60%. Background opacity ramps from 4% to 8%. Cursor changes to pointer.

**Click state**: Opens a deep-dive panel (Phase 4 feature, placeholder for v1).

## Context complexity meter

**Track**: 4px tall, full width, background `rgba(255,255,255,0.08)`, border-radius 2px

**Fill**: 4px tall, width animated to the percentage, background gradient from `#2dd4bf` at 0% to `#fbbf24` at 100%, transition 600ms ease

**Label row above**: 
- Left: "CONTEXT COMPLEXITY" in 10px white at 50% opacity, letter-spaced 2px
- Right: Percentage value in 10px amber (`#fbbf24`)

**Computation**: For v1, weighted average of normalized values across the protein's available data dimensions. Specifically: 30% structural confidence (pLDDT/100), 40% disease association strength (top score), 30% variant burden (capped at 200 variants). The formula is in `src/lib/protein-mapper.ts`.

## Chat panel

**Container**:
- Background: `rgba(255,255,255,0.03)`
- Border: 1px solid `rgba(255,255,255,0.08)`
- Border radius: 12px
- Padding: 14px

**Message style**:
- Each message has a small label (SYSTEM, YOU, HUMAN OS) in 11px letterspaced, colored by role
- Message body in 13px white at 85% opacity
- Messages separated by 12px margin and a 1px top border at 5% opacity

**Input row**:
- Text input: 80% width, glassy fill, 1px border at 10% opacity, padding 8px 12px, border-radius 18px
- Send button: 20% width, cyan `rgba(45, 212, 191, 0.2)` background, cyan border at 40% opacity, border-radius 18px

**Voice state**:
- Mic button in header changes from cyan to red when listening
- Label changes from "Tap to talk" to "Listening..."
- Visual indicator (pulsing ring or waveform) optional but nice

## Animation timing

- Hover transitions: 150ms ease-out
- Click feedback: 100ms ease-out, slight scale down to 0.98 then back
- Card data updates: 400ms ease-in-out for opacity fade and value transition
- Body rotation: continuous at 0.004 rad/frame
- Organ pulses: 2 second sine wave cycle
- Camera transitions when selecting an organ: 600ms ease-in-out

## Accessibility

- All interactive elements have keyboard equivalents (Tab to navigate, Enter to select, Esc to deselect)
- Voice input has a typed-text fallback always visible
- Color is never the only encoding for state. Hover and selection use both color and brightness change.
- Aria labels on the canvas describing the current state ("Body figure rotating, six organs available, click to select")
- Sufficient color contrast on text (WCAG AA minimum)
- Reduced motion preference respected: auto-rotate stops, organ pulses become static, transitions become instant

## Responsive behavior (out of scope for v1, but plan for it)

The current design is desktop-first. For a future mobile version:
- Body figure becomes a sticky header
- Cards stack into a scrollable list below
- Voice becomes the primary input
- Deep-dives become full-screen overlays

Do not optimize for mobile in v1. The cardiometabolic research workflow is desktop-first by user habit.

## What this design is not

Not a video game. No particle effects, no lens flares, no animated UI flourishes that exist for their own sake.

Not a generic dashboard. Every visual element should reinforce the holographic clinical-AI metaphor.

Not a chatbot wrapper. The body figure is the primary interaction. The chat is supplementary.

Not a research paper visualization. The aesthetic is product-grade, not academic.
