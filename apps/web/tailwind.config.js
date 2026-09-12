/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b1220",
          raised: "#121c2e",
          border: "#243044",
        },
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          300: "#84c5ff",
          400: "#4aa8ff",
          500: "#2186f5",
          600: "#1467c9",
          700: "#134f9c",
        },
        // Fixed status palette (validated for CVD + contrast on a dark surface) —
        // never reused for categorical series, never carries meaning without an
        // accompanying icon/label per the dataviz skill's status-color rule.
        health: {
          healthy: "#0ca30c",
          atRisk: "#fab219",
          degraded: "#ec835a",
          critical: "#d03b3b",
        },
        // Fixed categorical order for team series in charts — assigned by slot
        // index, never cycled or reassigned when the team list changes.
        team: {
          1: "#3987e5",
          2: "#d95926",
          3: "#199e70",
          4: "#c98500",
          5: "#d55181",
          6: "#008300",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
