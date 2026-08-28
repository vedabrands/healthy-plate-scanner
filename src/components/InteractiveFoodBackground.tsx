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
  { emoji: "🍇", name: "Grapes" },
  { emoji: "🥗", name: "Salad" },
];

class SoundEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  playMunch() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(190 + Math.random() * 80, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {
      // audio fallback
    }
  }

  playBurp() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(85, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(75, this.ctx.currentTime + 0.35);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.55);

      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch {
      // audio fallback
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

  useEffect(() => {
    const items: FloatingFood[] = [];
    const count = 16;

    for (let i = 0; i < count; i++) {
      const foodItem = HEALTHY_FOODS[i % HEALTHY_FOODS.length];
      const col = i % 4;
      const row = Math.floor(i / 4);

      items.push({
        id: i + 1,
        emoji: foodItem.emoji,
        name: foodItem.name,
        x: col * 23 + (Math.random() * 8 + 3),
        y: row * 22 + (Math.random() * 8 + 3),
        size: Math.random() * 10 + 38, // 38px - 48px high visibility
        rotation: Math.random() * 40 - 20,
        speed: Math.random() * 3 + 4,
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

    sfx.playMunch();

    soundIntervalRef.current = setInterval(() => {
      sfx.playMunch();
    }, 280);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / 1500) * 100));
      setProgress(pct);
    }, 35);

    holdTimerRef.current = setTimeout(() => {
      clearHoldTimers();
      sfx.playBurp();

      setFoods((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const nextFood = HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)];
            return {
              ...item,
              emoji: nextFood.emoji,
              name: nextFood.name,
              x: Math.random() * 80 + 10,
              y: Math.random() * 80 + 10,
              rotation: Math.random() * 40 - 20,
            };
          }
          return item;
        })
      );
    }, 1500);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden select-none">
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
            className="pointer-events-auto absolute cursor-pointer transition-all duration-100 hover:scale-125 active:scale-95"
            style={{
              left: `${food.x}%`,
              top: `${food.y}%`,
              transform: `rotate(${food.rotation}deg) scale(${
                isBeingEaten ? Math.max(0.2, 1 - progress / 100) : 1
              })`,
              fontSize: `${food.size}px`,
              opacity: isBeingEaten ? 1 : 0.85,
              filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.12))",
              animation: isBeingEaten
                ? "food-eating-shake 0.15s infinite"
                : `food-float ${food.speed}s ease-in-out infinite alternate`,
            }}
            title={`Hold 1.5s to eat ${food.name}!`}
          >
            <span className="block leading-none">{food.emoji}</span>

            {/* Eating progress circle indicator */}
            {isBeingEaten && (
              <div className="pointer-events-none absolute -inset-3 flex items-center justify-center">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-primary/30"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary"
                    strokeDasharray={`${progress}, 100`}
                    strokeWidth="4.5"
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
        @keyframes food-float {
          0% { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(-20px) rotate(10deg); }
        }
        @keyframes food-eating-shake {
          0% { transform: translate(1px, 1px) rotate(0deg) scale(0.9); }
          25% { transform: translate(-3px, -1px) rotate(-6deg) scale(0.85); }
          50% { transform: translate(3px, 1px) rotate(5deg) scale(0.8); }
          75% { transform: translate(-2px, 2px) rotate(-4deg) scale(0.75); }
          100% { transform: translate(1px, -1px) rotate(2deg) scale(0.7); }
        }
      `}</style>
    </div>
  );
}
