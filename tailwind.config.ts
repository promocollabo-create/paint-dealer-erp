import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: {
          950: "#0F1115",
          900: "#161A21",
          800: "#1E232C",
          700: "#2A303B",
          600: "#3A414D",
          500: "#5B6472",
          400: "#8890A0",
          300: "#B7BFCC",
          200: "#DCE1E9",
          100: "#EFF2F6",
          50: "#F7F8FA"
        },
        brand: {
          50: "#EEF1FF",
          100: "#DBE0FF",
          200: "#B7C2FF",
          300: "#8C9BFF",
          400: "#6373F5",
          500: "#3F4ED8",
          600: "#3140B8",
          700: "#293497",
          800: "#232B78",
          900: "#1D2461"
        },
        swatch: {
          clay: "#C1552E",
          ochre: "#D9A441",
          moss: "#4C7B5A",
          teal: "#2E7D8C",
          plum: "#6C4E8C"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,17,21,0.06), 0 1px 8px rgba(15,17,21,0.04)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
};
export default config;
