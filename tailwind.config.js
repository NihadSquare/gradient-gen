/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("--bg"), surface: c("--surface"), surface2: c("--surface2"), line: c("--line"), ink: c("--ink"), dim: c("--dim"),
        accent: c("--accent"), "accent-hover": c("--accent-hover"), "accent-ink": c("--accent-ink"), track: c("--track"), stage: c("--stage"),
        ok: c("--ok"), warn: c("--warn"), bad: c("--bad"),
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', '"SF Pro Text"', "-apple-system", "BlinkMacSystemFont", '"Helvetica Neue"', '"Inter Variable"', "Inter", "Roboto", '"DejaVu Sans"', "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
