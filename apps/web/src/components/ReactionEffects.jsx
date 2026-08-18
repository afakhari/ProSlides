import React, { useEffect, useRef, useState } from "react";

// Confetti particle component with 3D rotation effect
const ConfettiParticle = ({ x, delay, color, shape, rotation, size }) => {
  const getShapeStyle = () => {
    switch (shape) {
      case "circle":
        return { borderRadius: "50%", width: `${size}px`, height: `${size}px` };
      case "rectangle":
        return { width: `${size * 1.5}px`, height: `${size * 0.5}px` };
      default: // square
        return { width: `${size}px`, height: `${size}px` };
    }
  };

  return (
    <div
      className="absolute animate-confetti-fall"
      style={{
        left: `${x}%`,
        top: "-20px",
        animationDelay: `${delay}s`,
        animationDuration: `${2 + Math.random() * 1.5}s`,
      }}
    >
      <div
        style={{
          backgroundColor: color,
          transform: `rotate(${rotation}deg)`,
          ...getShapeStyle(),
        }}
      />
    </div>
  );
};

// Applause hands component
const ApplauseHand = ({ x, y, delay, size, rotation, skinTone }) => {
  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        animation: `applauseFloat 2.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
        animationDelay: `${delay}s`,
        opacity: 0,
      }}
    >
      <div
        style={{
          fontSize: `${size}rem`,
          transform: `rotate(${rotation}deg)`,
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
        }}
      >
        👏{skinTone}
      </div>
    </div>
  );
};

// Drumroll component - Large centered drum image
const DrumEffect = () => {
  const [useFallback, setUseFallback] = React.useState(false);
  const [isShaking, setIsShaking] = React.useState(true);

  useEffect(() => {
    // Stop shaking after 1.5s (matching the roll sound duration)
    const timer = setTimeout(() => setIsShaking(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const animationClass = isShaking ? "animate-drum-shake" : "";

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {!useFallback ? (
        <img
          src="/drum.png"
          alt="Drum"
          className={`w-52 h-52 object-contain ${animationClass}`}
          style={{ filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.4))" }}
          onError={() => setUseFallback(true)}
        />
      ) : (
        <div
          className={`text-[10rem] ${animationClass}`}
          style={{ filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.4))" }}
        >
          🥁
        </div>
      )}
    </div>
  );
};

// Sound wave for drumroll
const SoundWave = ({ delay }) => {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <div
        className="w-52 h-52 rounded-full border-4 border-yellow-400 opacity-0"
        style={{
          animation: `soundWaveSimple 0.8s ease-out forwards`,
          animationDelay: `${delay}s`,
        }}
      />
    </div>
  );
};

// Constants outside component to avoid dependency issues
const CONFETTI_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8B500",
  "#FF69B4",
  "#00CED1",
  "#FFD700",
];

const SHAPES = ["square", "circle", "rectangle"];
const SKIN_TONES = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];

export default function ReactionEffects({ effect, onComplete }) {
  const [particles, setParticles] = useState([]);
  const audioContextRef = useRef(null);

  // Create sound effects using Web Audio API
  const playSound = (type) => {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const now = audioContext.currentTime;

      if (type === "confetti") {
        // Confetti: Cannon Pop + Magical Shimmer

        // 1. Cannon Pop (Thump + Tone)
        const popOsc = audioContext.createOscillator();
        const popGain = audioContext.createGain();
        popOsc.connect(popGain);
        popGain.connect(audioContext.destination);

        popOsc.frequency.setValueAtTime(300, now);
        popOsc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        popOsc.type = "sine";

        popGain.gain.setValueAtTime(0.5, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        popOsc.start(now);
        popOsc.stop(now + 0.15);

        // Burst of noise for air pressure
        const bufferSize = audioContext.sampleRate * 0.1;
        const buffer = audioContext.createBuffer(
          1,
          bufferSize,
          audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = audioContext.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.value = 1000;
        const noiseGain = audioContext.createGain();

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioContext.destination);

        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        noise.start(now);

        // 2. Magical Shimmer (Falling particles)
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
          const sOsc = audioContext.createOscillator();
          const sGain = audioContext.createGain();
          sOsc.connect(sGain);
          sGain.connect(audioContext.destination);

          sOsc.type = "sine";
          // High pitched random frequencies
          sOsc.frequency.value = 2000 + Math.random() * 3000;

          // Staggered start times
          const time = now + 0.1 + Math.random() * 0.5;
          const duration = 0.1 + Math.random() * 0.2;

          sGain.gain.setValueAtTime(0, time);
          sGain.gain.linearRampToValueAtTime(0.03, time + 0.02);
          sGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

          sOsc.start(time);
          sOsc.stop(time + duration);
        }
      } else if (type === "applause") {
        // Applause: Rich crowd clapping simulation
        const duration = 3.0;
        const clapCount = 60;

        // Master gain for fade in/out
        const masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(1, now + 0.5);
        masterGain.gain.setValueAtTime(1, now + duration - 0.5);
        masterGain.gain.linearRampToValueAtTime(0, now + duration);

        for (let i = 0; i < clapCount; i++) {
          // Distribute claps
          const t = now + Math.random() * duration;

          // Create noise buffer for a single clap
          const bufferSize = audioContext.sampleRate * 0.15;
          const buffer = audioContext.createBuffer(
            1,
            bufferSize,
            audioContext.sampleRate
          );
          const data = buffer.getChannelData(0);

          // Generate noise with envelope
          for (let j = 0; j < bufferSize; j++) {
            const envelope = Math.exp(-j / (bufferSize * 0.1));
            data[j] = (Math.random() * 2 - 1) * envelope;
          }

          const source = audioContext.createBufferSource();
          source.buffer = buffer;

          // Bandpass filter with varied frequency for natural variation
          const filter = audioContext.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.value = 800 + Math.random() * 1000;
          filter.Q.value = 1 + Math.random();

          const gain = audioContext.createGain();
          gain.gain.value = 0.1 + Math.random() * 0.2;

          source.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);

          source.start(t);
        }

        // Add low-frequency presence
        const thumpOsc = audioContext.createOscillator();
        const thumpGain = audioContext.createGain();
        thumpOsc.connect(thumpGain);
        thumpGain.connect(masterGain);
        thumpOsc.frequency.value = 100;
        thumpGain.gain.setValueAtTime(0, now);
        thumpGain.gain.linearRampToValueAtTime(0.05, now + 1);
        thumpGain.gain.linearRampToValueAtTime(0, now + duration);
        thumpOsc.start(now);
        thumpOsc.stop(now + duration);
      } else if (type === "drumroll") {
        // Drumroll: Snare roll + Cymbal crash
        const createDrumHit = (time) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();

          osc.connect(gain);
          gain.connect(audioContext.destination);

          osc.frequency.setValueAtTime(150, time);
          osc.type = "triangle";

          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

          osc.start(time);
          osc.stop(time + 0.08);

          // Noise component for snare
          const bufferSize = audioContext.sampleRate * 0.05;
          const buffer = audioContext.createBuffer(
            1,
            bufferSize,
            audioContext.sampleRate
          );
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = audioContext.createBufferSource();
          noise.buffer = buffer;
          const noiseGain = audioContext.createGain();
          noise.connect(noiseGain);
          noiseGain.connect(audioContext.destination);

          noiseGain.gain.setValueAtTime(0.1, time);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

          noise.start(time);
        };

        // Roll
        const rollDuration = 1.5;
        const hits = 25;
        for (let i = 0; i < hits; i++) {
          createDrumHit(now + (i / hits) * rollDuration);
        }

        // Final Crash
        const crashTime = now + rollDuration;
        const bufferSize = audioContext.sampleRate * 1.5;
        const buffer = audioContext.createBuffer(
          1,
          bufferSize,
          audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = audioContext.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 3000;

        const gain = audioContext.createGain();

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);

        gain.gain.setValueAtTime(0.4, crashTime);
        gain.gain.exponentialRampToValueAtTime(0.001, crashTime + 1.2);

        noise.start(crashTime);
      }
    } catch {
      // Audio not supported
    }
  };

  useEffect(() => {
    if (!effect) return;

    // Play sound effect
    playSound(effect);

    // Generate particles based on effect type
    if (effect === "confetti") {
      const newParticles = [];
      for (let i = 0; i < 80; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 1.5,
          color:
            CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          rotation: Math.random() * 360,
          size: 4 + Math.random() * 6,
        });
      }
      setParticles(newParticles);
    } else if (effect === "applause") {
      const newParticles = [];
      for (let i = 0; i < 40; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 90 + 5,
          y: Math.random() * 60 + 20,
          delay: Math.random() * 1.5,
          size: 3 + Math.random() * 4,
          rotation: (Math.random() - 0.5) * 60,
          skinTone: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
        });
      }
      setParticles(newParticles);
    } else if (effect === "drumroll") {
      const newParticles = [];
      // Add drum and sound waves
      newParticles.push({ id: "drum", type: "drum", delay: 0 });
      for (let i = 0; i < 8; i++) {
        newParticles.push({
          id: `wave-${i}`,
          type: "wave",
          delay: i * 0.2,
        });
      }
      setParticles(newParticles);
    }

    // Clear effect after animation completes
    const timer = setTimeout(() => {
      setParticles([]);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (onComplete) onComplete();
    }, 4000);

    return () => {
      clearTimeout(timer);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect]);

  if (!effect) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-9999 overflow-hidden">
      <style>{`
        @keyframes soundWaveSimple {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes applauseFloat {
          0% { transform: translateY(20px) scale(0.5); opacity: 0; }
          20% { transform: translateY(0px) scale(1.2); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-100px) scale(1); opacity: 0; }
        }
      `}</style>
      {/* Confetti effect */}
      {effect === "confetti" &&
        particles.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            x={particle.x}
            delay={particle.delay}
            color={particle.color}
            shape={particle.shape}
            rotation={particle.rotation}
            size={particle.size}
          />
        ))}

      {/* Applause effect */}
      {effect === "applause" &&
        particles.map((particle) => (
          <ApplauseHand
            key={particle.id}
            x={particle.x}
            y={particle.y}
            delay={particle.delay}
            size={particle.size}
            rotation={particle.rotation}
            skinTone={particle.skinTone}
          />
        ))}

      {/* Drumroll effect */}
      {effect === "drumroll" && (
        <>
          {particles
            .filter((p) => p.type === "wave")
            .map((particle) => (
              <SoundWave key={particle.id} delay={particle.delay} />
            ))}
          <DrumEffect />
        </>
      )}
    </div>
  );
}
