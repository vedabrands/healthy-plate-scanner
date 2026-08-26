import { createFileRoute } from "@tanstack/react-router";
import { FoodScanner } from "@/components/FoodScanner";
import { GradeBadge } from "@/components/GradeBadge";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NutriGrade — Scan food, get an A–F health grade" },
      {
        name: "description",
        content:
          "Scan a barcode, snap the pack, or type a food name and get an instant A–F health grade, what's harmful inside it, and better alternatives.",
      },
      { property: "og:title", content: "NutriGrade — Scan food, get an A–F health grade" },
      {
        property: "og:description",
        content:
          "Instant A–F grading for any packaged food, with a plain-language breakdown of what's inside and healthier swaps.",
      },
    ],
  }),
  component: Index,
});

const gradeDetails: Record<
  string,
  { title: string; desc: string; badgeClass: string }
> = {
  A: {
    title: "Grade A — Excellent",
    desc: "Whole, unprocessed or minimally processed foods rich in fiber, micronutrients, and healthy proteins.",
    badgeClass: "bg-emerald-600 text-white",
  },
  B: {
    title: "Grade B — Good",
    desc: "Nutrient-dense with balanced macros, minimal refined sugars, and low synthetic additives.",
    badgeClass: "bg-lime-600 text-white",
  },
  C: {
    title: "Grade C — Moderate",
    desc: "Contains moderate levels of sodium, saturated fats, or added sugars. Suitable in moderation.",
    badgeClass: "bg-amber-500 text-white",
  },
  D: {
    title: "Grade D — Poor",
    desc: "High in ultra-processed ingredients, elevated sugar, or saturated fats. Limit regular intake.",
    badgeClass: "bg-orange-500 text-white",
  },
  E: {
    title: "Grade E — Very Poor",
    desc: "Heavy in refined oils, artificial preservatives, high sodium, and empty calories.",
    badgeClass: "bg-rose-600 text-white",
  },
  F: {
    title: "Grade F — Ultra-Processed Hazard",
    desc: "Extremely high in harmful additives, trans fats, or excessive chemical sweeteners.",
    badgeClass: "bg-red-700 text-white",
  },
};

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <section className="grain rounded-3xl border bg-card px-6 py-10 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Know what you eat
          </p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
            Scan any food. Get a grade from A to F.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Scan the barcode with your camera, photograph the label, type the barcode, or just search
            the name. You'll see exactly what's inside, what harms your health and why, and what to
            eat instead.
          </p>

          {/* Interactive Animated Grade Badges */}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5 text-sm">
            {(["A", "B", "C", "D", "E", "F"] as const).map((g) => {
              const info = gradeDetails[g];
              return (
                <div key={g} className="group relative flex items-center justify-center">
                  <div className="transition-transform duration-200 ease-out group-hover:scale-110">
                    <GradeBadge grade={g} size="sm" className="cursor-pointer rounded-xl shadow-xs" />
                  </div>

                  {/* Smooth Hover Popup Card */}
                  <div className="pointer-events-none absolute bottom-full mb-3 left-1/2 w-64 -translate-x-1/2 opacity-0 scale-95 translate-y-2 transition-all duration-200 ease-out group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 z-50">
                    <div className="rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-md">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                        <span
                          className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${info.badgeClass}`}
                        >
                          {g}
                        </span>
                        <p className="text-xs font-semibold text-foreground">{info.title}</p>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-left">
                        {info.desc}
                      </p>
                    </div>

                    {/* Arrow Indicator */}
                    <div className="mx-auto -mt-1 size-2 rotate-45 border-b border-r border-border/80 bg-background" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8">
          <FoodScanner />
        </div>
      </main>
    </div>
  );
}