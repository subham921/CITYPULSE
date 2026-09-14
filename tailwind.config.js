/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
    "./server/views/**/*.ejs",
    "./server/public/js/**/*.js",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        paper: "var(--paper)",
        card: "var(--card)",
        "card-alt": "var(--card-alt)",
        accent: "var(--accent)",
        coral: "var(--coral)",
        amber: "var(--amber)",
      },
      fontFamily: {
        sans: ["Manrope", "Arial", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4" }],
        xs: ["11px", { lineHeight: "1.5" }],
        sm: ["12px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.6" }],
        lg: ["17px", { lineHeight: "1.4" }],
        xl: ["21px", { lineHeight: "1.3" }],
        "2xl": ["32px", { lineHeight: "1.12" }],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "14px",
      },
      spacing: {
        13: "52px",
      },
    },
  },
  plugins: [],
};
