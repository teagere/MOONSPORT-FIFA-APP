export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Public Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        midnight: "#000000",
        pitch: "#191919",
        floodlight: "#E8E8E8",
        moon: "#0066CC",
        lime: "#F4F844",
        gold: "#F4F844",
        offblack: "#191919",
        offwhite: "#E8E8E8",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(244, 248, 68, 0.08), 0 24px 80px rgba(0, 0, 0, 0.42)",
      },
    },
  },
  plugins: [],
};
