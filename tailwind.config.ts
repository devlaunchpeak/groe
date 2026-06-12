import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // GROE design system — keep in sync with app/globals.css CSS vars
        "nav-dark": "#1C4A2E",
        primary: {
          DEFAULT: "#2D6A4F",
          light: "#D6EAD8",
          foreground: "#FFFFFF",
        },
        bg: "#F8F6F0",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#111827",
        },
        text: "#111827",
        muted: {
          DEFAULT: "#6B7280",
          foreground: "#6B7280",
        },
        border: "#E5E7EB",
        // RAG status colors
        rag: {
          red: "#DC2626",
          "red-bg": "#FEF2F2",
          amber: "#F59E0B",
          "amber-bg": "#FFFBEB",
          green: "#2D6A4F",
          "green-bg": "#F0FDF4",
        },
        // shadcn/ui required tokens (mapped to GROE palette)
        background: "#F8F6F0",
        foreground: "#111827",
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#111827",
        },
        secondary: {
          DEFAULT: "#D6EAD8",
          foreground: "#2D6A4F",
        },
        accent: {
          DEFAULT: "#D6EAD8",
          foreground: "#2D6A4F",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        input: "#E5E7EB",
        ring: "#2D6A4F",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        heading: ["Space Grotesk", ...fontFamily.sans],
        body: ["IBM Plex Sans", ...fontFamily.sans],
        mono: ["IBM Plex Mono", ...fontFamily.mono],
        sans: ["IBM Plex Sans", ...fontFamily.sans],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
