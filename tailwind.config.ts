import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "stage-black": "var(--stage-black)",
        "stage-charcoal": "var(--stage-charcoal)",
        "spotlight-gold": "var(--spotlight-gold)",
        "curtain-red": "var(--curtain-red)",
        "podium-gold": "var(--podium-gold)",
        "podium-silver": "var(--podium-silver)",
        "podium-bronze": "var(--podium-bronze)",
        paper: "var(--paper)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
      },
      fontFamily: {
        display: ["Bebas Neue", "Impact", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
