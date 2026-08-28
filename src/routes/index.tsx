import { createFileRoute } from "@tanstack/react-router";
import { 
  ShieldCheck, 
  Sparkles, 
  Camera, 
  BarChart3, 
  HeartPulse, 
} from "lucide-react";
import { InteractiveFoodBackground } from "@/components/InteractiveFoodBackground";
import { FoodScanner } from "@/components/FoodScanner";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const GRADES = [
  { grade: "A", color: "bg-emerald-500/80 shadow-emerald-500/40", text: "text-emerald-300", label: "Excellent", desc: "Whole foods, minimally processed, rich in nutrients." },
  { grade: "B", color: "bg-teal-500/80 shadow-teal-500/40", text: "text-teal-300", label: "Good", desc: "Decent nutritional profile with minor processing." },
  { grade: "C", color: "bg-amber-500/80 shadow-amber-500/40", text: "text-amber-300", label: "Moderate", desc: "Average quality. Best consumed in moderation." },
  { grade: "D", color: "bg-orange-500/80 shadow-orange-500/40", text: "text-orange-300", label: "Poor", desc: "High in sodium, sugars, or refined saturated fats." },
  { grade: "E", color: "bg-rose-500/80 shadow-rose-500/40", text: "text-rose-300", label: "Ultra-Processed", desc: "Heavy additives, low nutritional density." },
  { grade: "F", color: "bg-red-600/80 shadow-red-600/40", text: "text-red-300", label: "Harmful", desc: "Hazardous additive profiles and high health risks." },
];

const FEATURES = [
  {
    icon: Camera,
    title: "Instant OCR & Barcode Scan",
    description: "Scan product barcodes or snap packaging nutrition labels with real-time text parsing.",
  },
  {
    icon: ShieldCheck,
    title: "Verified Ingredient Database",
    description: "Cross-checked against Open Food Facts and global food registries for uncompromised accuracy.",
  },
  {
    icon: BarChart3,
    title: "NOVA & Additive Breakdown",
    description: "Reveals hidden emulsifiers, excessive sodium, trans fats, and processing levels in plain language.",
  },
  {
    icon: Sparkles,
    title: "Smarter Alternatives",
    description: "Suggests cleaner, whole-food swaps whenever a scan receives a poor or average grade.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Scan or Snap",
    desc: "Use your camera to scan a barcode, snap the ingredients panel, or type any food name.",
  },
  {
    step: "02",
    title: "Evidence Analysis",
    desc: "Our engine evaluates the ingredient hierarchy, NOVA processing tier, and nutrient density.",
  },
  {
    step: "03",
    title: "Understand Your Food",
    desc: "Receive an instant A–F score, clear health implications, and better nutritional alternatives.",
  },
];

function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0f0d] text-neutral-100 selection:bg-emerald-500/30">
      {/* Liquid Glass & 3D Bulge Core Styling */}
      <style>{`
        /* Glossy Ambient Backdrops */
        .liquid-glass {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.12) 0%,
            rgba(255, 255, 255, 0.03) 60%,
            rgba(255, 255, 255, 0.08) 100%
          );
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 
            0 20px 40px -15px rgba(0, 0, 0, 0.5),
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -1px 1px 0 rgba(0, 0, 0, 0.4);
          position: relative;
          overflow: hidden;
        }

        /* Diagonal Liquid Light Glare Reflection */
        .liquid-glass::before {
          content: '';
          position: absolute;
          top: 0;
          left: -60%;
          width: 200%;
          height: 100%;
          background: linear-gradient(
            120deg,
            transparent 30%,
            rgba(255, 255, 255, 0.1) 45%,
            rgba(255, 255, 255, 0.22) 50%,
            transparent 55%
          );
          pointer-events: none;
          transform: translateY(-50%) rotate(15deg);
          transition: transform 0.65s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .liquid-glass:hover::before {
          transform: translateY(20%) rotate(15deg);
        }

        /* 3D Bulge + Smooth Suspension Lift */
        .liquid-card-interactive {
          transition: 
            transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            border-color 0.3s ease;
          will-change: transform, box-shadow;
        }

        .liquid-card-interactive:hover {
          transform: translateY(-8px) scale(1.035);
          border-color: rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.65),
            0 0 25px 2px rgba(16, 185, 129, 0.15),
            inset 0 1px 2px 0 rgba(255, 255, 255, 0.6);
        }

        .liquid-card-interactive:active {
          transform: translateY(-2px) scale(0.99);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }

        /* Glass Orb Glows behind elements */
        .glass-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>

      {/* Atmospheric Liquid Glow Orbs */}
      <div className="glass-orb top-[-10%] left-[-10%] size-[500px] bg-emerald-500/40" />
      <div className="glass-orb top-[40%] right-[-15%] size-[600px] bg-teal-500/30" />
      <div className="glass-orb bottom-[-10%] left-[20%] size-[550px] bg-emerald-600/30" />

      {/* Floating Interactive Food Elements */}
      <InteractiveFoodBackground />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="mb-12 text-center sm:mb-16">
          <div className="liquid-glass liquid-card-interactive inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-300 shadow-lg cursor-default">
            <HeartPulse className="size-3.5 text-emerald-400" />
            <span>Know What You Eat</span>
          </div>

          <h1 className="mt-5 font-serif text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-white">
            Scan any food. Get a grade from{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
              A to F
            </span>
            .
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-300 sm:text-lg">
            Instant, evidence-backed nutritional ratings. Decode complex labels, spot harmful additives, and find healthier everyday alternatives.
          </p>
        </section>

        {/* Liquid Glass Food Scanner Card */}
        <section aria-label="Food Scanner" className="w-full">
          <div className="liquid-glass liquid-card-interactive rounded-3xl p-2 sm:p-4">
            <FoodScanner />
          </div>
        </section>

        {/* How It Works (Liquid Glass Cards) */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">How NutriGrade Works</h2>
            <p className="mt-2 text-sm text-neutral-300 sm:text-base">
              Transparent, science-backed food evaluation in three easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="liquid-glass liquid-card-interactive rounded-3xl p-6 shadow-md cursor-pointer"
              >
                <span className="text-3xl font-black text-emerald-400/40">{s.step}</span>
                <h3 className="mt-2 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Liquid Glass Grading Scale Guide */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">The Grading System</h2>
            <p className="mt-2 text-sm text-neutral-300 sm:text-base">
              Clear benchmarks based on whole ingredients, additive safety, and processing depth.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {GRADES.map((g) => (
              <div
                key={g.grade}
                className="liquid-glass liquid-card-interactive flex flex-col items-center rounded-2xl p-4 text-center cursor-pointer"
              >
                <div className={`flex size-12 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg backdrop-blur-md ${g.color}`}>
                  {g.grade}
                </div>
                <span className={`mt-3 text-sm font-semibold ${g.text}`}>{g.label}</span>
                <p className="mt-1 text-xs text-neutral-300 leading-tight">{g.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Liquid Glass Feature Highlights */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">Why Trust NutriGrade?</h2>
            <p className="mt-2 text-sm text-neutral-300 sm:text-base">
              Built to cut through misleading marketing claims on package fronts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="liquid-glass liquid-card-interactive flex gap-4 rounded-3xl p-6 cursor-pointer"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 shadow-inner border border-emerald-400/30">
                  <f.icon className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-300">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-24 border-t border-white/10 pt-8 pb-12 text-center text-xs text-neutral-400">
          <p>© {new Date().getFullYear()} NutriGrade. Evidence-based health metrics for smart choices.</p>
        </footer>
      </main>
    </div>
  );
}
