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
        gold: {
          DEFAULT: "#D4A017",
          50: "#FBF4E0",
          100: "#F6E7B8",
          200: "#EDD077",
          300: "#E4BA3D",
          400: "#D4A017",
          500: "#B08512",
          600: "#8C6A0E",
          700: "#684F0B",
          800: "#453407",
          900: "#221A04",
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
        gold: "0 8px 30px -8px rgba(212, 160, 23, 0.4)",
        card: "0 1px 3px rgba(11, 30, 58, 0.08), 0 1px 2px rgba(11, 30, 58, 0.04)",
      },
      backgroundImage: {
        "navy-gradient": "linear-gradient(135deg, #0B1E3A 0%, #153052 55%, #071427 100%)",
        "gold-gradient": "linear-gradient(135deg, #E4BA3D 0%, #D4A017 60%, #B08512 100%)",
        "hero-radial": "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,160,23,0.18), transparent)",
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
