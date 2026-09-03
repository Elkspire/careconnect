/**
 * CareConnect's brand palette, ported 1:1 from
 * packages/config/tailwind-preset.css (the same tokens apps/web's
 * globals.css uses) — a "vintage stamped document" look: deep bottle-green
 * page chrome, cream/paper card surfaces, brass/seal/stamp accents. The
 * web app never adapts to system light/dark preference (no
 * prefers-color-scheme in its CSS) — it's one fixed brand identity, not a
 * theme with two modes, so this mirrors that rather than inventing a
 * separate dark palette for mobile alone.
 */
import { Platform } from "react-native";

export const Colors = {
  // Page chrome — the dark bottle-green background most screens sit on.
  background: "#0e2620",
  backgroundAlt: "#153429",
  border: "#2c5748",
  // Card/surface — the cream "paper" most content sits on top of.
  surface: "#f4f0e4",
  surfaceAlt: "#fbf9f1",
  // Text
  onBackground: "#f4f0e4", // text on the dark bottle-green chrome
  onBackgroundMuted: "#c3d4cb",
  onSurface: "#12201b", // text on cream paper surfaces
  onSurfaceMuted: "#4a5c54",
  // Accents
  verified: "#1c7a55", // primary brand accent — buttons, verified badges
  stamp: "#2b4c9b", // links/secondary actions
  seal: "#b93b26", // errors/destructive actions
  brass: "#b8912f",
  mint: "#79d2a6",
} as const;

export type ThemeColorKey = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    mono: "monospace",
  },
  web: {
    sans: "Inter, ui-sans-serif, system-ui, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
})!;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
