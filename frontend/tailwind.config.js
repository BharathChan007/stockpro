/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#131314",
        surface: "#131314",
        "surface-container-low": "#1c1b1c",
        "surface-container": "#201f20",
        "surface-container-high": "#2a2a2b",
        "surface-container-highest": "#353436",
        "surface-variant": "#353436",
        primary: "#b8c3ff",
        "primary-container": "#2e5bff",
        tertiary: "#ffb4aa",
        "tertiary-container": "#d71a18",
        "on-surface": "#e5e2e3",
        "on-surface-variant": "#c4c5d9",
        "on-primary": "#002388",
        "outline-variant": "#434656",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      fontFamily: {
        headline: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
