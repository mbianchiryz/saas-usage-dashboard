import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          anthropic: "#D97757",
          openai: "#10A37F",
          amex: "#006FCF",
        },
      },
    },
  },
  plugins: [],
};
export default config;
