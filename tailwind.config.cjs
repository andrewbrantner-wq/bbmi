/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "lg:grid-cols-1",
    "lg:grid-cols-2",
    "lg:grid-cols-3",
    "lg:grid-cols-[1fr_240px]",
  ],
  theme: {
  extend: {
  fontFamily: {
    sans: ["var(--font-roboto)", "sans-serif"],
    mono: ["var(--font-roboto-mono)", "monospace"],
  },
  letterSpacing: {
    tightest: "-0.02em",
    tighter: "-0.01em",
  },
  lineHeight: {
    snug: "1.25",
    tight: "1.15",
  },
}
}

  plugins: [],
}

