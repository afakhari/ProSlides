/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // تمام فایل‌های React
  ],
  theme: {
    extend: {
      animation: {
        "confetti-fall": "confettiFall 2.5s linear forwards",
        "applause-pop": "applausePop 1.5s ease-out forwards",
        "drum-shake": "drumShake 0.1s ease-in-out infinite",
        "sound-wave": "soundWave 0.8s ease-out forwards",
      },
      keyframes: {
        confettiFall: {
          "0%": {
            transform: "translateY(0) rotate(0deg)",
            opacity: 1,
          },
          "100%": {
            transform: "translateY(100vh) rotate(360deg)",
            opacity: 0,
          },
        },
        applausePop: {
          "0%": {
            transform: "scale(0) rotate(-20deg)",
            opacity: 0,
          },
          "30%": {
            transform: "scale(1.4) rotate(10deg)",
            opacity: 1,
          },
          "60%": {
            transform: "scale(0.9) rotate(-5deg)",
            opacity: 1,
          },
          "100%": {
            transform: "scale(1) rotate(0deg)",
            opacity: 0,
          },
        },
        drumShake: {
          "0%, 100%": {
            transform: "rotate(-5deg) scale(1)",
          },
          "50%": {
            transform: "rotate(5deg) scale(1.1)",
          },
        },
        soundWave: {
          "0%": {
            transform: "translate(-50%, -50%) scale(0.5)",
            opacity: 1,
          },
          "100%": {
            transform: "translate(-50%, -50%) scale(3)",
            opacity: 0,
          },
        },
      },
    },
  },
  plugins: [],
};
