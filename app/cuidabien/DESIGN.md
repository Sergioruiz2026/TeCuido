---
name: TeCuido
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434652'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737783'
  outline-variant: '#c3c6d4'
  surface-tint: '#2b5bb5'
  primary: '#003178'
  on-primary: '#ffffff'
  primary-container: '#0d47a1'
  on-primary-container: '#a1bbff'
  inverse-primary: '#b0c6ff'
  secondary: '#006d30'
  on-secondary: '#ffffff'
  secondary-container: '#92f5a4'
  on-secondary-container: '#007233'
  tertiary: '#651b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#8c2900'
  on-tertiary-container: '#ffa689'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00429c'
  secondary-fixed: '#95f8a7'
  secondary-fixed-dim: '#79db8d'
  on-secondary-fixed: '#00210a'
  on-secondary-fixed-variant: '#005323'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59d'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832600'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 40px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 32px
  body-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 26px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 1.75rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is tailored for elderly adults, caregivers, and users with low digital literacy managing medications, clinical appointments, and routine health tasks. The core philosophy centers on cognitive clarity, radical legibility, and dignity in interaction. The experience avoids technical jargon, transient UI micro-patterns, unlabelled iconography, and high-cognitive-load layouts. 

The aesthetic style merges **Warm Corporate Clarity** with **High-Contrast Tactile Usability**. Visual anchors are grounded, friendly, and reassuring. Critical paths prioritize reassurance over compactness, employing generous white space, explicit borders for hit-target recognition, and tangible, reassuring feedback states. Interfaces communicate dependability, warmth, and absolute safety.

## Colors

Color strategy is anchored strictly in WCAG AAA compliance (contrast ratios exceeding 7:1 for body copy and 4.5:1 for oversized interactive targets). 

- **Primary (`#0D47A1` - Deep Clinical Blue):** Drives primary navigation, active states, key interactive appointments, and trusted primary buttons. Emits authority, calm, and medical stability without clinical sterility.
- **Secondary (`#15803D` - Restorative Forest Green):** Reserved for positive confirmation, completed doses, medication adherence logs, and success states. Deepened deliberately from typical light emeralds to secure contrast on light surfaces.
- **Tertiary (`#C2410C` - Alert Amber/Rust):** Applied specifically to time-sensitive notifications, missed doses, medication countdown alerts, and schedule changes.
- **Neutral Base (`#0F172A` - Midnight Slate):** Used for primary typography and core outlines. Avoids pure `#000000` to mitigate optical vibration while maintaining maximum contrast against `#FFFFFF` and `#F8FAFC`.
- **Surface Canvas (`#F8FAFC` to `#FFFFFF`):** Warm, soft paper-like backgrounds that reduce eye fatigue while creating distinct contrast against elevated cards.

Never rely solely on color to convey vital health statuses: combine color fills with structural icons and explicit textual tags.

## Typography

The type hierarchy uses **Plus Jakarta Sans** across all roles. Its open counters, tall x-height, and clean geometric terminals maintain optimal legibility even at reduced eyesight acuity.

- **Baseline Floor:** The absolute minimum text size allowed across any user-facing screen is **16px** (strictly limited to secondary meta-labels); general body content never drops below **18px**.
- **Line Heights:** Set generously between 1.5x and 1.6x the font size to prevent overlapping lines and visual crowding.
- **Letter Spacing:** Maintained at standard or slightly expanded values (`0` to `0.01em`) on labels for enhanced glyph separation.
- **Weight Strategy:** Restrict font weights to **500 (Medium)**, **700 (Bold)**, and **800 (Extra Bold)**. Light and thin weights (100–300) are banned across the system to eliminate vanishing strokes.

## Layout & Spacing

The layout is built on a single-column-first, fluid mobile canvas with a strict 4-column grid for mobile viewports and vertical stacked sequences. 

- **Hit Density:** Content density is intentionally spacious. Elements must never overlap or sit in ambiguous proximities.
- **Touch Margins:** Every interactive item requires a minimum margin of `space-sm` (12px) separating it from neighboring tap targets, guaranteeing total immunity against accidental touches.
- **Vertical Rhythm:** Stack screens linearly. Complex nested card groups and multi-column inputs are avoided in favor of conversational, one-step-at-a-time form progressions.
- **Desktop & Tablet Adaptability:** On screens wider than 640px, the maximum content width constrains strictly to 480px–560px centered, preserving the comfortable, oversized mobile reading experience rather than sprawling out data.

## Elevation & Depth

To remain intelligible to users who struggle with abstract depth cues or faint drop shadows, this design system combines **Tactile Edge Outlines** with **Subtle Grounding Elevation**.

1. **Structured Outlines:** Every card, container, and button features a solid 2px border (`#E2E8F0` on inert containers; `#0D47A1` or `#15803D` on active/focused states). This defines clear physical interaction boundaries.
2. **Grounding Shadow:** Interactive cards and floating operational bars utilize a soft, directional shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)`.
3. **Pressed Feedback:** Upon tap/press, buttons reduce their outline offset and shift down 2px with an inner shadow, giving unmistakable physical confirmation that the command was registered.
4. **Modals & Sheets:** Elevated modals use an 80% opacity dark slate overlay (`rgba(15, 23, 42, 0.8)`) to fully dim background distractions, helping users retain focus on the primary task.

## Shapes

The design system adopts **Roundedness 2** (16px base corner radius for components, scaling to 20px–24px on cards and sheets). 

- Sharp 0px corners are avoided to eliminate harshness and anxiety.
- Complete pill borders are restricted only to discrete status tags and chips to prevent buttons from looking like unclickable badges.
- Buttons, input fields, and action cards share a uniform radius of 16px to maintain predictable touch affordances across the entire product.

## Components

### Buttons
- **Touch Targets:** Minimum height of **56px** (recommended **64px** for critical primary actions like "Tomar Remedio" or "Confirmar Cita").
- **Visual Composition:** High-contrast background with bold 18px–20px typography. Secondary buttons use a solid 2px outline with a light background fill to ensure visibility against the page.
- **Icons in Buttons:** When accompanied by an icon, the icon size is 28px, strictly paired with descriptive text (never icon-only).

### Action Cards (Appointments & Medication Cards)
- **Structure:** Crisp white background (`#FFFFFF`), 2px border (`#CBD5E1`), 20px corner radius, and generous interior padding (`space-md` to `space-lg`).
- **Hierarchy:** Prominent time badges (e.g., "08:00 AM") in high-contrast tertiary/alert colors, followed by the medicine name in bold 22px type, dosage instructions in 18px, and a full-width primary button at the base.

### Form Inputs & Text Fields
- **Dimensions:** Minimum 58px height with 2px borders (`#94A3B8`). On focus, border deepens to `#0D47A1` with a 3px ring.
- **Labels:** Labels are permanently positioned outside and above the field in bold 18px font. Floating placeholders that disappear during typing are strictly prohibited.
- **Input Text:** 20px font size to provide instant legibility during typing.

### Selection Controls (Checkboxes & Radios)
- **Hit Area:** Checkboxes and radio buttons occupy an oversized 32x32px visual target, embedded within a container with a 56px minimum height.
- **State Feedback:** Selected items turn Deep Blue (`#0D47A1`) or Forest Green (`#15803D`) with thick white tick marks (3px stroke). The entire parent row serves as the active tap target.

### Status Chips & Pills
- **Usage:** Indicate dosage times, appointment status (e.g., "Confirmada", "Pendiente"), or day indicators.
- **Styling:** Height of 40px–44px, bold 16px label, with high-contrast text and a matching border to maintain legibility.

### Bottom Navigation & Action Bars
- **Requirement:** Every navigation icon is paired with a persistent, non-collapsible text label (16px bold). Navigation items provide a minimum touch footprint of 64x64px.
- **Confirmations:** Destructive or high-impact actions (e.g., canceling a doctor's visit) trigger a step-by-step confirmation sheet with explicit, descriptive actions ("Sí, cancelar cita" vs. "No, mantener mi cita") instead of generic "Aceptar/Cancelar" options.