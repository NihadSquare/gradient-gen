// The eight themes of the desktop version.
export interface Theme {
  label: string;
  dark: boolean;
  bg: string; surface: string; surface2: string; line: string; ink: string; dim: string;
  accent: string; accentHover: string; accentInk: string; track: string; stage: string;
  ok: string; warn: string; bad: string;
}
const OK = "#34D399", WARN = "#FBBF24", BAD = "#F87171";
const t = (label: string, dark: boolean, bg: string, surface: string, surface2: string, line: string, ink: string, dim: string, accent: string, accentHover: string, accentInk: string, track: string, stage: string, ok = OK, warn = WARN, bad = BAD): Theme =>
  ({ label, dark, bg, surface, surface2, line, ink, dim, accent, accentHover, accentInk, track, stage, ok, warn, bad });

export const THEMES: Record<string, Theme> = {
  midnight: t("Midnight", true, "#0D0A1F", "#16122E", "#211B45", "#2F2862", "#ECE9FF", "#9893C9", "#5240FF", "#846BFF", "#FFFFFF", "#2B2559", "#090715"),
  graphite: t("Graphite", true, "#111214", "#1A1B1E", "#25272B", "#34373D", "#ECEDEF", "#8D9199", "#C9CDD4", "#E4E7EC", "#15161A", "#33363C", "#0B0B0D"),
  aurora: t("Aurora", true, "#06161A", "#0C2227", "#133339", "#1E4A52", "#E2F7F5", "#7FB6B3", "#2DD4BF", "#5EEAD4", "#042F2E", "#18424A", "#041013"),
  sunset: t("Sunset", true, "#1A0E12", "#27151B", "#381F28", "#53303C", "#FFEDE5", "#CFA3A0", "#FF7A45", "#FF9566", "#2A0F05", "#4A2A35", "#12070A"),
  rose: t("Rose", true, "#1A0D15", "#26121E", "#361A2A", "#512740", "#FFE8F1", "#CFA0B8", "#FF5C9A", "#FF82B2", "#2B0716", "#4A2339", "#11060D"),
  ocean: t("Ocean", true, "#071327", "#0D1E3B", "#142A50", "#213B69", "#E6F0FF", "#8BA6D4", "#3B9CFF", "#66B2FF", "#04152E", "#1B3563", "#040C1A"),
  forest: t("Forest", true, "#09150F", "#0F2218", "#163124", "#244937", "#E6F6EC", "#8DB8A0", "#4ADE80", "#74E8A0", "#052313", "#1D4030", "#050E09"),
  paper: t("Paper", false, "#ECECE6", "#FFFFFF", "#F3F3EE", "#D9D8D0", "#1E1E24", "#6B6B78", "#5B3DF5", "#7357FF", "#FFFFFF", "#D8D7E6", "#E2E2DB", "#12805C", "#B7791F", "#C53030"),
};
export const THEME_ORDER = ["midnight", "graphite", "aurora", "sunset", "rose", "ocean", "forest", "paper"];

const rgb = (hex: string) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
const lighten = (hex: string, f: number) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return "#" + c.map((v) => Math.round(v + (255 - v) * f).toString(16).padStart(2, "0")).join("");
};
const readable = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 > 0.6 ? "#15161A" : "#FFFFFF";
};

export function applyTheme(name: string, accentOverride = "") {
  const th = THEMES[name] ?? THEMES.midnight;
  const acc = /^#[0-9A-Fa-f]{6}$/.test(accentOverride) ? accentOverride.toUpperCase() : th.accent;
  const hover = acc === th.accent ? th.accentHover : lighten(acc, 0.25);
  const ink = acc === th.accent ? th.accentInk : readable(acc);
  const s = document.documentElement.style;
  const set = (k: string, v: string) => s.setProperty(k, rgb(v));
  set("--bg", th.bg); set("--surface", th.surface); set("--surface2", th.surface2); set("--line", th.line);
  set("--ink", th.ink); set("--dim", th.dim); set("--accent", acc); set("--accent-hover", hover);
  set("--accent-ink", ink); set("--track", th.track); set("--stage", th.stage);
  set("--ok", th.ok); set("--warn", th.warn); set("--bad", th.bad);
  document.documentElement.style.colorScheme = th.dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", th.bg);
}
