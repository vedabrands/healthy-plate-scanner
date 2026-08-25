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
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            {["A", "B", "C", "D", "E", "F"].map((g) => (
              <GradeBadge key={g} grade={g} size="sm" className="rounded-xl" />
            ))}
          </div>
        </section>

        <div className="mt-8">
          <FoodScanner />
        </div>
      </main>
    </div>
  );
}
