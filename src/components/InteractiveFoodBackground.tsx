import { useEffect, useRef, useState } from "react";

interface FloatingFood {
  id: number;
  emoji: string;
  name: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  speed: number;
}

const HEALTHY_FOODS = [
  { emoji: "🍎", name: "Apple" },
  { emoji: "🥑", name: "Avocado" },
  { emoji: "🥦", name: "Broccoli" },
  { emoji: "🥕", name: "Carrot" },
  { emoji: "🍓", name: "Strawberry" },
  { emoji: "🥝", name: "Kiwi" },
  { emoji: "🍉", name: "Watermelon" },
  { emoji: "🍌", name: "Banana" },
  { emoji: "🫐", name: "Blueberries" },
  { emoji: "🍊", name: "Orange" },
];

// Web Audio API Synthesized Sound Effects (No external mp3 assets needed)
class SoundEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  // Crunch / Munch sound effect
  playMunch() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(160 + Math.random() * 80, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {
      // Ignore audio policy issues
    }
  }

  // Play comical burp sound
  playBurp() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(55, this.ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + 0.35);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.55);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch {
      // Ignore audio policy issues
    }
  }
}

const sfx = new SoundEffects();

export function InteractiveFoodBackground() {
  const [foods, setFoods] = useState<FloatingFood[]>([]);
  const [eatingId, setEatingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize randomized background healthy items
  useEffect(() => {
    const items: FloatingFood[] = [];
    const count = 14;

    for (let i = 0; i < count; i++) {
      const foodItem = HEALTHY_FOODS[i % HEALTHY_FOODS.length];
      items.push({
        id: i + 1,
        emoji: foodItem.emoji,
        name: foodItem.name,
        x: Math.random() * 85 + 5, // 5% - 90% horizontal
        y: Math.random() * 85 + 5, // 5% - 90% vertical
        size: Math.random() * 12 + 28, // 28px - 40px
        rotation: Math.random() * 40 - 20,
        speed: Math.random() * 4 + 4, // floating float animation speed
      });
    }

    setFoods(items);
  }, []);

  const clearHoldTimers = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    holdTimerRef.current = null;
    soundIntervalRef.current = null;
    progressIntervalRef.current = null;
    setEatingId(null);
    setProgress(0);
  };

  const startEating = (id: number) => {
    clearHoldTimers();
    setEatingId(id);
    setProgress(0);

    // Initial crunch
    sfx.playMunch();

    // Sound loop during eating
    soundIntervalRef.current = setInterval(() => {
      sfx.playMunch();
    }, 320);

    // Progress indicator tracker (1500ms total)
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / 1500) * 100));
      setProgress(pct);
    }, 50);

    // After 1.5 seconds, finish eating
    holdTimerRef.current = setTimeout(() => {
      clearHoldTimers();

      // Burp sound
      sfx.playBurp();

      // Remove eaten food and respawn a fresh one in a new position
      setFoods((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const nextFood = HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)];
            return {
              ...item,
              emoji: nextFood.emoji,
              name: nextFood.name,
              x: Math.random() * 85 + 5,
              y: Math.random() * 85 + 5,
              rotation: Math.random() * 40 - 20,
            };
          }
          return item;
        })
      );
    }, 1500);
  };

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none">
      {foods.map((food) => {
        const isBeingEaten = eatingId === food.id;

        return (
          <div
            key={food.id}
            onPointerDown={(e) => {
              e.preventDefault();
              startEating(food.id);
            }}
            onPointerUp={clearHoldTimers}
            onPointerLeave={clearHoldTimers}
            onPointerCancel={clearHoldTimers}
            className="pointer-events-auto absolute cursor-pointer transition-transform duration-75 active:scale-95"
            style={{
              left: `${food.x}%`,
              top: `${food.y}%`,
              transform: `rotate(${food.rotation}deg) scale(${isBeingEaten ? Math.max(0.2, 1 - progress / 100) : 1})`,
              fontSize: `${food.size}px`,
              opacity: isBeingEaten ? Math.max(0.2, 1 - progress / 100) : 0.45,
              animation: isBeingEaten
                ? "eating-shake 0.15s infinite"
                : `float-slow ${food.speed}s ease-in-out infinite alternate`,
            }}
            title={`Hold 1.5s to eat ${food.name}!`}
          >
            <span>{food.emoji}</span>

            {/* Circular bite progress ring */}
            {isBeingEaten && (
              <div className="absolute -inset-2 flex items-center justify-center pointer-events-none">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-primary/40"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary"
                    strokeDasharray={`${progress}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes float-slow {
          0% { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(-16px) rotate(6deg); }
        }
        @keyframes eating-shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          25% { transform: translate(-2px, -1px) rotate(-4deg); }
          50% { transform: translate(2px, 0px) rotate(3deg); }
          75% { transform: translate(-1px, 2px) rotate(-2deg); }
          100% { transform: translate(1px, -1px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
