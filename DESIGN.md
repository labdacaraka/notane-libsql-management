# DESIGN.md - Design Direction for Notane LibSQL Management

## 1. Product Identity & Purpose
- **Product:** Notane LibSQL Management
- **Audience:** Software engineers, database administrators, and DevOps personnel managing local or distributed libSQL (`sqld`) database instances.
- **Tone:** Professional, reliable, concise, high-utility, predictable.

## 2. Palette & Contrast
- **Base Canvas (Dark Mode - Primary):**
  - Background Base: `#0f172a` (Slate 900) / `#020617` (Slate 950)
  - Surface Card: `#1e293b` (Slate 800)
  - Surface Border: `#334155` (Slate 700)
  - Text Primary: `#f8fafc` (Slate 50) - Contrast ratio ~ 13:1 (exceeds WCAG AAA)
  - Text Muted: `#94a3b8` (Slate 400) - Contrast ratio ~ 5.6:1 (exceeds WCAG AA)
- **Base Canvas (Light Mode):**
  - Background Base: `#f8fafc` (Slate 50)
  - Surface Card: `#ffffff`
  - Surface Border: `#e2e8f0` (Slate 200)
  - Text Primary: `#0f172a` (Slate 900) - Contrast ratio ~ 15:1
  - Text Muted: `#475569` (Slate 600) - Contrast ratio ~ 5.8:1
- **Status & Accent Signals:**
  - Active/Online: `#10b981` (Emerald 500)
  - Stopped/Inactive: `#64748b` (Slate 500)
  - Error/Crash: `#ef4444` (Rose 500)
  - Key Actions: `#2563eb` (Blue 600) / Focus ring: `#3b82f6` (Blue 500)
  - No decorative gradients or purple-neon glow.

## 3. Typography
- **UI Text:** System font stack (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- **Code, Tokens, URLs, Ports, Logs:** Monospace stack (`JetBrains Mono, "Fira Code", ui-monospace, Menlo, Consolas, monospace`)

## 4. Interaction Dials
- **ENERGY:** 2 (Calm, structured data density, functional clarity)
- **RHYTHM:** 2 (Structured grid for metrics/instances, consistent 8px/16px/24px spacing)
- **MOTION:** 1 (Instant state feedback, subtle 150ms transitions on hover/focus, no looping animations or floating elements)

## 5. Anti-Slop Guarantees
- No fake numbers or statistics. Real values only (or explicitly labeled `0`).
- No generic AI icons or emojis in UI buttons.
- Real functional controls only: every button triggers a real Tauri command or dialog.
- Accessible keyboard navigation (`Tab`, `Shift+Tab`, `Enter`, `Escape` to close modals).
- One-click copy buttons with distinct "Copied" acknowledgment state.
