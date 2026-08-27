---
name: Orbital Precision Mono
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#171c24'
  surface-container: '#1C2026'
  surface-container-high: '#262a33'
  surface-container-highest: '#30353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c303a'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c1c7cf'
  on-secondary: '#2b3137'
  secondary-container: '#41474e'
  on-secondary-container: '#afb6bd'
  tertiary: '#ffffff'
  on-tertiary: '#233143'
  tertiary-container: '#d4e4fa'
  on-tertiary-container: '#576679'
  error: '#EF4444'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#dde3eb'
  secondary-fixed-dim: '#c1c7cf'
  on-secondary-fixed: '#161c22'
  on-secondary-fixed-variant: '#41474e'
  tertiary-fixed: '#d4e4fa'
  tertiary-fixed-dim: '#b9c8de'
  on-tertiary-fixed: '#0d1c2d'
  on-tertiary-fixed-variant: '#39485a'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#30353e'
  surface-elevated: '#161B27'
  success: '#10B981'
  warning: '#F59E0B'
  border-glass: rgba(255, 255, 255, 0.08)
  text-dim: '#94A3B8'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.04em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter-sm: 8px
  gutter-md: 12px
  panel-padding: 16px
  sidebar-width: 320px
---

## Brand & Style

This design system is a monochromatic evolution of a high-density GIS and engineering interface. The brand personality is clinical, architectural, and hyper-precise, catering to users who require a focused environment for complex geospatial analysis. By removing chromatic distractions in the primary interface, the system prioritizes the "Technical Command Center" aesthetic, where depth and hierarchy are communicated through light, opacity, and value rather than hue.

The design style is a hybrid of **Technical Minimalism** and **Architectural Glassmorphism**. It utilizes a "Deep Space" canvas where the UI feels like a transparent heads-up display (HUD) overlaid on a data-rich map engine. The aesthetic is rigorous and intentional, removing all decorative flourishes to ensure that the only colors present are those conveying critical functional status (success, warning, error).

## Colors

The palette is strictly monochromatic for the interface framework, utilizing a "Deep Space" base of `#060A12`. Primary actions and highlights are rendered in pure white (#FFFFFF) or high-contrast silver (#E2E8F0) to ensure maximum legibility against the dark canvas. 

**Functional Color Exception:** To maintain safety and operational awareness, Green (Success), Amber (Warning), and Red (Error) are retained exclusively for status indicators. 

The UI uses a stepped grayscale hierarchy:
- **Primary:** White (#FFFFFF) for high-priority actions and active states.
- **Secondary:** Slate (#E2E8F0) for secondary interactions and borders.
- **Tertiary:** Muted Blue-Gray (#94A3B8) for meta-data and inactive icons.
- **Neutral:** Deep Space (#060A12) for the base viewport and input backgrounds.

## Typography

The system utilizes **Outfit** for the primary interface. Its geometric construction and wide apertures provide a modern, architectural feel that is more legible at small sizes than standard grotesque fonts.

- **Outfit** is used for the navigational framework, headings, and standard body text. It should feel "machined" and precise.
- **JetBrains Mono** is utilized for all technical variables, coordinates, and data-dense attributes. This typographic split allows the user's brain to instantly distinguish between "interface controls" and "raw data."
- **Scale:** Use `body-sm` (12px) as the default for sidebars to maximize information density.

## Layout & Spacing

The layout is a **Fixed Sidebar Model** designed for 3D viewport applications. The primary map engine is a full-bleed background layer, with UI panels floating or docked on a strict 4px grid.

- **Grid:** A rigid 4px baseline grid governs all internal alignment.
- **Sidebars:** Fixed at 320px to accommodate complex property tables and hierarchical layers.
- **Density:** Spacing is intentionally tight. Elements within a group use 4px gaps, while distinct groups use 12px or 16px margins.
- **Responsiveness:** On mobile, sidebars collapse into bottom sheets or full-screen overlays to preserve the map center.

## Elevation & Depth

Hierarchy is established through **Backdrop Opacity** and **High-Definition Outlines** rather than traditional drop shadows.

- **Base Layer (Level 0):** The raw map/data canvas.
- **Floating Panels (Level 1):** Surfaces use `#161B27` with 85% opacity and a `12px` backdrop blur. Edges are defined by a `1px` stroke of `border-glass`.
- **Active Overlays (Level 2):** Menus or popovers use 100% opacity and a `1px` white top-border highlight to simulate an edge catching light.

Avoid fuzzy shadows. Every container must feel like a physical, machined component with sharp, clean edges.

## Shapes

The shape language is conservative and technical. A **Soft (4px)** radius is the standard for almost all UI components to provide a refined, modern finish without appearing "bubbly."

- **Buttons & Inputs:** 4px radius.
- **Panels:** 8px radius for major containers (`rounded-lg`).
- **Data Indicators:** 0px (Sharp) for status pips, map swatches, and selection rectangles to reinforce the grid-based nature of GIS data.

## Components

- **Buttons:** Primary buttons are solid White (#FFFFFF) with black text. Secondary buttons are "Ghost" style (transparent fill, 1px `#E2E8F0` border).
- **Input Fields:** Backgrounds are `#060A12`. The focus state uses a sharp `1px` white outer stroke with `0px` blur for a technical "lit" effect.
- **Data Chips:** Rectangular with `mono-label` text. Use low-opacity fills (10%) for status colors (e.g., 10% Green fill for "Verified").
- **Accordion Sections:** Used in sidebars to manage density. Headers should be all-caps, 11px bold Outfit, with a subtle `1px` divider.
- **The HUD:** Group map controls (zoom/tilt) into a single vertical glass-morphic bar with backdrop blurs and white icons.
- **Map Swatches:** Always use sharp 8x8px squares for legend items to distinguish map features from UI icons.