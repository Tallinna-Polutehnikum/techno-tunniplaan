/**
 * Generate daisyUI themes from well-known editor colour schemes.
 *
 * VS Code themes come from @shikijs/themes; JetBrains themes are not packaged there, so their
 * palettes are written out below. Every theme is reduced to the same small palette and mapped
 * onto daisyUI the same way, so the whole set looks consistent in the app:
 *
 *   base-100 / base-content   editor background / foreground (foreground darkened or lightened to 4.5:1 if fainter)
 *   base-200, base-300        background nudged towards the foreground (cards, borders)
 *   primary                   keyword colour, the one people recognise a theme by
 *   secondary                 string colour
 *   accent                    function name colour
 *   info/success/warning/error  the theme's terminal blue/green/yellow/red
 *
 * Writes src/themes/editor.css (daisyUI theme blocks) and src/themes/editor.json (id, label and
 * whether it is dark, in display order, read by ThemeSelect.vue).
 *
 *   bun run themes
 */
import { mkdirSync, writeFileSync } from "node:fs";

interface Palette {
  dark: boolean;
  bg: string;
  fg: string;
  keyword: string;
  string: string;
  func: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
}

/** id (must not clash with daisyUI's built-in theme names), label, and where the palette comes from */
const THEMES: { id: string; label: string; shiki?: string; palette?: Palette }[] = [
  { id: "dark-plus", label: "VS Code Dark", shiki: "dark-plus" },
  { id: "light-plus", label: "VS Code Light", shiki: "light-plus" },
  { id: "github-dark", label: "GitHub Dark", shiki: "github-dark-default" },
  { id: "github-dark-dimmed", label: "GitHub Dark Dimmed", shiki: "github-dark-dimmed" },
  { id: "github-light", label: "GitHub Light", shiki: "github-light-default" },
  { id: "one-dark-pro", label: "One Dark Pro", shiki: "one-dark-pro" },
  { id: "one-light", label: "One Light", shiki: "one-light" },
  { id: "monokai", label: "Monokai", shiki: "monokai" },
  {
    id: "darcula",
    label: "Darcula",
    palette: { dark: true, bg: "#2b2b2b", fg: "#a9b7c6", keyword: "#cc7832", string: "#6a8759", func: "#ffc66d", red: "#ff6b68", green: "#6a8759", yellow: "#bbb529", blue: "#6897bb" },
  },
  {
    id: "jetbrains-dark",
    label: "JetBrains Dark",
    palette: { dark: true, bg: "#1e1f22", fg: "#bcbec4", keyword: "#cf8e6d", string: "#6aab73", func: "#56a8f5", red: "#f75464", green: "#5fb865", yellow: "#d5b778", blue: "#548af7" },
  },
  {
    id: "intellij-light",
    label: "IntelliJ Light",
    palette: { dark: false, bg: "#ffffff", fg: "#080808", keyword: "#0033b3", string: "#067d17", func: "#00627a", red: "#e55c5c", green: "#067d17", yellow: "#9e880d", blue: "#1750eb" },
  },
  { id: "nord-dark", label: "Nord", shiki: "nord" },
  {
    // Nord's "Snow Storm" colours as background with the darker Frost and Aurora tones for text
    id: "nord-light",
    label: "Nord Light",
    palette: { dark: false, bg: "#eceff4", fg: "#2e3440", keyword: "#5e81ac", string: "#6d8a4f", func: "#3b7b8c", red: "#bf616a", green: "#6d8a4f", yellow: "#b3862e", blue: "#5e81ac" },
  },
  { id: "solarized-dark", label: "Solarized Dark", shiki: "solarized-dark" },
  { id: "solarized-light", label: "Solarized Light", shiki: "solarized-light" },
  { id: "gruvbox-dark-hard", label: "Gruvbox Dark Hard", shiki: "gruvbox-dark-hard" },
  { id: "gruvbox-dark-medium", label: "Gruvbox Dark", shiki: "gruvbox-dark-medium" },
  { id: "gruvbox-dark-soft", label: "Gruvbox Dark Soft", shiki: "gruvbox-dark-soft" },
  { id: "gruvbox-light-hard", label: "Gruvbox Light Hard", shiki: "gruvbox-light-hard" },
  { id: "gruvbox-light-medium", label: "Gruvbox Light", shiki: "gruvbox-light-medium" },
  { id: "gruvbox-light-soft", label: "Gruvbox Light Soft", shiki: "gruvbox-light-soft" },
  { id: "catppuccin-latte", label: "Catppuccin Latte", shiki: "catppuccin-latte" },
  { id: "catppuccin-frappe", label: "Catppuccin Frappé", shiki: "catppuccin-frappe" },
  { id: "catppuccin-macchiato", label: "Catppuccin Macchiato", shiki: "catppuccin-macchiato" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", shiki: "catppuccin-mocha" },
  { id: "tokyo-night", label: "Tokyo Night", shiki: "tokyo-night" },
  { id: "rose-pine", label: "Rosé Pine", shiki: "rose-pine" },
  { id: "rose-pine-moon", label: "Rosé Pine Moon", shiki: "rose-pine-moon" },
  { id: "rose-pine-dawn", label: "Rosé Pine Dawn", shiki: "rose-pine-dawn" },
  { id: "everforest-dark", label: "Everforest Dark", shiki: "everforest-dark" },
  { id: "everforest-light", label: "Everforest Light", shiki: "everforest-light" },
  { id: "kanagawa-wave", label: "Kanagawa Wave", shiki: "kanagawa-wave" },
  { id: "kanagawa-dragon", label: "Kanagawa Dragon", shiki: "kanagawa-dragon" },
  { id: "kanagawa-lotus", label: "Kanagawa Lotus", shiki: "kanagawa-lotus" },
  { id: "ayu-dark", label: "Ayu Dark", shiki: "ayu-dark" },
  { id: "ayu-mirage", label: "Ayu Mirage", shiki: "ayu-mirage" },
  { id: "ayu-light", label: "Ayu Light", shiki: "ayu-light" },
  { id: "material", label: "Material", shiki: "material-theme" },
  { id: "material-ocean", label: "Material Ocean", shiki: "material-theme-ocean" },
  { id: "material-palenight", label: "Material Palenight", shiki: "material-theme-palenight" },
  { id: "material-lighter", label: "Material Lighter", shiki: "material-theme-lighter" },
  { id: "night-owl", label: "Night Owl", shiki: "night-owl" },
  { id: "night-owl-light", label: "Night Owl Light", shiki: "night-owl-light" },
  { id: "vitesse-dark", label: "Vitesse Dark", shiki: "vitesse-dark" },
  { id: "vitesse-light", label: "Vitesse Light", shiki: "vitesse-light" },
  { id: "synthwave-84", label: "Synthwave '84", shiki: "synthwave-84" },
  { id: "poimandres", label: "Poimandres", shiki: "poimandres" },
  { id: "horizon", label: "Horizon", shiki: "horizon" },
];

// --- colour helpers -----------------------------------------------------------------------

type RGB = [number, number, number];

function parse(hex: string): { rgb: RGB; alpha: number } {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return { rgb: [n(0), n(2), n(4)], alpha: h.length === 8 ? n(6) / 255 : 1 };
}

const toHex = (rgb: RGB) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** `a` mixed towards `b` by `t` (0..1). */
const mix = (a: string, b: string, t: number) => {
  const x = parse(a).rgb;
  const y = parse(b).rgb;
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
};

/** Theme colours may be translucent (#rrggbbaa); flatten them onto the background. */
const solid = (c: string, bg: string) => {
  const { rgb, alpha } = parse(c);
  return alpha >= 1 ? toHex(rgb) : mix(bg, toHex(rgb), alpha);
};

function luminance(hex: string) {
  const [r, g, b] = parse(hex).rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Text colour for a filled surface: the theme's own background or foreground if readable, else black/white. */
function content(surface: string, p: Palette) {
  const candidates = [p.bg, p.fg, "#000000", "#ffffff"];
  const own = candidates.slice(0, 2).filter((c) => contrast(surface, c) >= 4.5);
  if (own.length) return own.sort((a, b) => contrast(surface, b) - contrast(surface, a))[0];
  return candidates.sort((a, b) => contrast(surface, b) - contrast(surface, a))[0];
}

// --- reading VS Code themes ---------------------------------------------------------------

type Rule = { scope?: string | string[]; settings?: { foreground?: string } };

/** Foreground of the first rule covering one of `scopes`, exact scope matches before prefixes. */
function tokenColor(rules: Rule[], scopes: string[]): string | undefined {
  const withScopes = rules
    .filter((r) => r.scope && r.settings?.foreground)
    .map((r) => ({ fg: r.settings!.foreground!, scopes: (Array.isArray(r.scope) ? r.scope : r.scope!.split(",")).map((s) => s.trim()) }));
  for (const want of scopes) {
    const exact = withScopes.find((r) => r.scopes.includes(want));
    if (exact) return exact.fg;
  }
  for (const want of scopes) {
    const prefix = withScopes.find((r) => r.scopes.some((s) => s.startsWith(want + ".")));
    if (prefix) return prefix.fg;
  }
}

async function fromShiki(name: string): Promise<Palette> {
  const t = (await import(`@shikijs/themes/${name}`)).default;
  const c: Record<string, string> = t.colors ?? {};
  const rules: Rule[] = t.tokenColors ?? [];
  const dark = t.type !== "light";
  const bg = solid(c["editor.background"] ?? (dark ? "#1e1e1e" : "#ffffff"), dark ? "#000000" : "#ffffff");
  const fg = solid(c["editor.foreground"] ?? c.foreground ?? (dark ? "#d4d4d4" : "#000000"), bg);
  const pick = (...options: (string | undefined)[]) => solid(options.find(Boolean)!, bg);
  const keyword = tokenColor(rules, ["keyword.control", "keyword", "storage.type", "storage"]);
  const string = tokenColor(rules, ["string", "string.quoted"]);
  const func = tokenColor(rules, ["entity.name.function", "support.function", "meta.function-call"]);
  // VS Code's own terminal colours when a theme leaves them out
  const term = (k: string, darkDefault: string, lightDefault: string) => c[`terminal.ansi${k}`] ?? (dark ? darkDefault : lightDefault);
  return {
    dark,
    bg,
    fg,
    keyword: pick(keyword, c["button.background"], fg),
    string: pick(string, term("Green", "#0dbc79", "#00bc00")),
    func: pick(func, term("Yellow", "#e5e510", "#949800")),
    red: pick(c["editorError.foreground"], term("Red", "#cd3131", "#cd3131")),
    green: pick(term("Green", "#0dbc79", "#00bc00")),
    yellow: pick(c["editorWarning.foreground"], term("Yellow", "#e5e510", "#949800")),
    blue: pick(c["editorInfo.foreground"], term("Blue", "#2472c8", "#0451a5")),
  };
}

// --- writing daisyUI themes ---------------------------------------------------------------

/** Some light themes use faint body text (Material Lighter is 2.5:1); push it towards black/white until it reads at 4.5:1. */
function readable(fg: string, bg: string, dark: boolean) {
  let out = fg;
  for (let t = 0.05; contrast(out, bg) < 4.5 && t <= 1; t += 0.05) out = mix(fg, dark ? "#ffffff" : "#000000", t);
  return out;
}

function daisyTheme(id: string, palette: Palette) {
  const p = { ...palette, fg: readable(palette.fg, palette.bg, palette.dark) };
  const neutral = mix(p.bg, p.fg, 0.22);
  const colors: [string, string][] = [
    ["base-100", p.bg],
    ["base-200", mix(p.bg, p.fg, 0.05)],
    ["base-300", mix(p.bg, p.fg, 0.12)],
    ["base-content", p.fg],
    ["primary", p.keyword],
    ["secondary", p.string],
    ["accent", p.func],
    ["neutral", neutral],
    ["info", p.blue],
    ["success", p.green],
    ["warning", p.yellow],
    ["error", p.red],
  ];
  const lines = [`  name: "${id}";`, `  color-scheme: ${p.dark ? "dark" : "light"};`];
  for (const [name, value] of colors) {
    lines.push(`  --color-${name}: ${value};`);
    if (name !== "base-100" && name !== "base-200" && name !== "base-300" && name !== "base-content") {
      lines.push(`  --color-${name}-content: ${content(value, p)};`);
    }
  }
  lines.push("  --radius-selector: 0.5rem;", "  --radius-field: 0.5rem;", "  --radius-box: 0.75rem;", "  --border: 1px;", "  --depth: 0;", "  --noise: 0;");
  return `@plugin "daisyui/theme" {\n${lines.join("\n")}\n}\n`;
}

const OUT = new URL("../src/themes/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const blocks = [`/* Generated by scripts/gen-themes.ts, do not edit by hand. */\n`];
const list = [];
for (const t of THEMES) {
  const palette = t.palette ?? (await fromShiki(t.shiki!));
  blocks.push(daisyTheme(t.id, palette));
  list.push({ id: t.id, label: t.label, dark: palette.dark });
}
writeFileSync(`${OUT}editor.css`, blocks.join("\n"));
writeFileSync(`${OUT}editor.json`, JSON.stringify(list, null, 2) + "\n");
console.log(`${THEMES.length} themes -> ${OUT}`);
