import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Highclass "High Class" brand system
        navy: {
          DEFAULT: "#0B1E3A",
          50: "#EAF0F7",
          100: "#C9D8EC",
          200: "#93B0D6",
          300: "#5D87BF",
          400: "#345F97",
          500: "#1E406B",
          600: "#153052",
          700: "#0F2645",
          800: "#0B1E3A",
          900: "#071427",
          950: "#040B17",
        },
        // Brand accent ramp — the logo's royal blue (the "Shipping" wordmark and
        // swoosh ring). Kept under the `gold` token name so the whole app re-themes
        // from one place; there is no gold in the Highclass brand.
        gold: {
          DEFAULT: "#0A5BE0",
          50: "#EAF2FE",
          100: "#CFE0FC",
          200: "#9EC0F9",
          300: "#5E97F3",
          400: "#2E74EC",
          500: "#0A5BE0",
          600: "#0848B4",
          700: "#063A93",
          800: "#052D72",
          900: "#04204F",
        },
        // Silver / steel accents echoing the logo's chrome ring and the
        // "and Logistics Inc." lettering.
        steel: {
          DEFAULT: "#9AA6B2",
          50: "#F4F6F8",
          100: "#E6EAEE",
          200: "#CBD3DB",
          300: "#AAB5C0",
          400: "#8A98A6",
          500: "#6E7C8C",
          600: "#55606D",
        },
        surface: "#F8FAFC",
        ink: {
          DEFAULT: "#1A202C",
          muted: "#718096",
        },
        // shadcn-style semantic tokens (HSL via CSS vars)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // 8-stage shipment lifecycle badge colors
        stage: {
          collection: "#6366F1", // Indigo
          inspection: "#F59E0B", // Amber
          loading: "#3B82F6", // Blue
          transit: "#8B5CF6", // Purple
          clearance: "#F97316", // Orange
          offloading: "#06B6D4", // Cyan
          delivery: "#14B8A6", // Teal
          completed: "#22C55E", // Green
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        premium: "0 10px 40px -12px rgba(11, 30, 58, 0.25)",
        // Accent glow now uses the brand royal blue (token name kept as `gold`).
        gold: "0 8px 30px -8px rgba(10, 91, 224, 0.45)",
        card: "0 1px 3px rgba(11, 30, 58, 0.08), 0 1px 2px rgba(11, 30, 58, 0.04)",
      },
      backgroundImage: {
        "navy-gradient": "linear-gradient(135deg, #0B1E3A 0%, #153052 55%, #071427 100%)",
        // Brand royal-blue gradient (bright to deep), mirroring the logo swoosh.
        "gold-gradient": "linear-gradient(135deg, #2E74EC 0%, #0A5BE0 55%, #0848B4 100%)",
        "steel-gradient": "linear-gradient(135deg, #E6EAEE 0%, #AAB5C0 55%, #6E7C8C 100%)",
        "hero-radial": "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(10,91,224,0.20), transparent)",
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
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
