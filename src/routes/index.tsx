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
  { grade: "A", color: "bg-emerald-500", text: "text-emerald-500", label: "Excellent", desc: "Whole foods, minimally processed, rich in nutrients." },
  { grade: "B", color: "bg-teal-500", text: "text-teal-500", label: "Good", desc: "Decent nutritional profile with minor processing." },
  { grade: "C", color: "bg-amber-500", text: "text-amber-500", label: "Moderate", desc: "Average quality. Best consumed in moderation." },
  { grade: "D", color: "bg-orange-500", text: "text-orange-500", label: "Poor", desc: "High in sodium, sugars, or refined saturated fats." },
  { grade: "E", color: "bg-rose-500", text: "text-rose-500", label: "Ultra-Processed", desc: "Heavy additives, low nutritional density." },
  { grade: "F", color: "bg-red-600", text: "text-red-600", label: "Harmful", desc: "Hazardous additive profiles and high health risks." },
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
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Embedded 3D Bulge & Lift Animation Styles */}
      <style>{`
        .card-3d-bulge {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), 
                      box-shadow 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                      border-color 0.25s ease;
          will-change: transform, box-shadow;
        }
        .card-3d-bulge:hover {
          transform: translateY(-8px) scale(1.035);
          box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.16), 
                      0 10px 15px -5px rgba(0, 0, 0, 0.08);
        }
        .card-3d-bulge:active {
          transform: translateY(-2px) scale(0.99);
          box-shadow: 0 8px 15px -5px rgba(0, 0, 0, 0.12);
        }
      `}</style>

      {/* Floating Interactive Background */}
      <InteractiveFoodBackground />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="mb-10 text-center sm:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/90 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary shadow-sm backdrop-blur-md transition-transform hover:scale-105 cursor-default">
            <HeartPulse className="size-3.5" />
            <span>Know What You Eat</span>
          </div>

          <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Scan any food. Get a grade from{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-primary bg-clip-text text-transparent">
              A to F
            </span>
            .
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Instant, evidence-backed nutritional ratings. Decode complex labels, spot harmful additives, and find healthier everyday alternatives.
          </p>
        </section>

        {/* Primary Interactive Food Scanner */}
        <section aria-label="Food Scanner" className="w-full">
          <div className="card-3d-bulge rounded-3xl">
            <FoodScanner />
          </div>
        </section>

        {/* How It Works */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">How NutriGrade Works</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Transparent, science-backed food evaluation in three easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="card-3d-bulge relative rounded-3xl border bg-card/85 p-6 shadow-sm backdrop-blur-md cursor-pointer"
              >
                <span className="text-3xl font-black text-primary/30">{s.step}</span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Grading Scale Guide */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">The Grading System</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Clear benchmarks based on whole ingredients, additive safety, and processing depth.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {GRADES.map((g) => (
              <div
                key={g.grade}
                className="card-3d-bulge flex flex-col items-center rounded-2xl border bg-card/85 p-4 text-center shadow-sm backdrop-blur-md cursor-pointer"
              >
                <div className={`flex size-11 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm ${g.color}`}>
                  {g.grade}
                </div>
                <span className={`mt-2.5 text-sm font-semibold ${g.text}`}>{g.label}</span>
                <p className="mt-1 text-xs text-muted-foreground leading-tight">{g.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">Why Trust NutriGrade?</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Built to cut through misleading marketing claims on package fronts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-3d-bulge flex gap-4 rounded-3xl border bg-card/85 p-6 shadow-sm backdrop-blur-md cursor-pointer"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <f.icon className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="mt-24 border-t pt-8 pb-12 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} NutriGrade. Evidence-based health metrics for smart choices.</p>
        </footer>
      </main>
    </div>
  );
}
