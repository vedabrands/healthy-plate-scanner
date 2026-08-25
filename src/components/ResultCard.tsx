import type { Analysis } from "@/lib/analyze.functions";
import { GradeBadge, gradeLabel } from "./GradeBadge";
import { cn } from "@/lib/utils";

const severityStyles: Record<string, string> = {
  low: "bg-grade-b/15 text-foreground border-grade-b/40",
  medium: "bg-grade-c/20 text-foreground border-grade-c/50",
  high: "bg-grade-e/15 text-foreground border-grade-e/45",
};

export function ResultCard({ result }: { result: Analysis }) {
  return (
    <article className="rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
      <header className="flex flex-wrap items-start gap-5">
        <GradeBadge grade={result.grade} />
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-2xl leading-tight">{result.foodName}</h2>
          {result.brand ? (
            <p className="text-sm text-muted-foreground">{result.brand}</p>
          ) : null}
          <p className="mt-2 font-medium text-primary">
            {gradeLabel[(result.grade || "C").toUpperCase()]}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl">{result.score}/100</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            health score
          </div>
        </div>
      </header>

      <p className="mt-6 rounded-2xl bg-secondary p-4 text-base font-medium">{result.verdict}</p>

      <section className="mt-6">
        <h3 className="text-lg">Why it scores this way</h3>
        <div className="mt-2 space-y-3 text-[0.975rem] leading-relaxed text-foreground/85">
          {result.explanation.split(/\n{1,2}/).filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {result.ingredients.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg">What's inside that hurts</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.ingredients.map((ing, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-2xl border p-4",
                  severityStyles[ing.severity] ?? severityStyles["medium"],
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{ing.name}</span>
                  <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                    {ing.severity} risk
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground/80">{ing.concern}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.nutrition.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg">Nutrition at a glance</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {result.nutrition.map((n, i) => (
              <div key={i} className="rounded-2xl border bg-secondary/60 p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{n.label}</dt>
                <dd className="font-display text-lg">{n.value}</dd>
                {n.note ? <p className="text-xs text-muted-foreground">{n.note}</p> : null}
              </div>
            ))}
          </dl>
        </section>
      )}

      {result.goodPoints.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg">In its favour</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
            {result.goodPoints.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {result.alternatives.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg">Better swaps</h3>
          <ul className="mt-3 space-y-2">
            {result.alternatives.map((a, i) => (
              <li key={i} className="rounded-2xl border border-grade-a/40 bg-grade-a/10 p-4">
                <span className="font-semibold">{a.name}</span>
                <p className="text-sm text-foreground/80">{a.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Confidence: {result.confidence}. General wellness guidance, not medical advice.
      </p>
    </article>
  );
}
