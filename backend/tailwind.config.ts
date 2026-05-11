import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Smolyan Klima brand colours (must match the public site exactly).
        // Source of truth: frontend/index.css and frontend components.
        brand: {
          // Warm primary — used on the public site for CTAs and headlines.
          orange: {
            50: "#fff3ed",
            100: "#ffe1cf",
            200: "#ffc196",
            300: "#ff9c5d",
            400: "#ff7b2d",
            500: "#FF4D00", // primary
            600: "#E64500", // primary hover
            700: "#c63b00",
            800: "#9c2f00",
            900: "#7a2400",
          },
          // Cool accent — used for chips, links, info accents.
          blue: {
            50: "#e6f9fd",
            100: "#c4f0fa",
            200: "#8fe1f4",
            300: "#5ad1ee",
            400: "#2cc1e6",
            500: "#00B4D8", // accent
            600: "#0096b8",
            700: "#0077B6", // accent deep
            800: "#005c8e",
            900: "#003f63",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
