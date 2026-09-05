import type { Analysis } from "@/lib/analyze.functions";
import { GradeBadge, gradeLabel } from "./GradeBadge";
import { cn } from "@/lib/utils";

const severityStyles: Record<string, string> = {
  low: "bg-emerald-50 text-neutral-900 border-emerald-300",
  medium: "bg-amber-50 text-neutral-900 border-amber-300",
  high: "bg-rose-50 text-neutral-900 border-rose-300",
};

export function ResultCard({ result }: { result: Analysis }) {
  return (
    <article className="rounded-3xl border border-neutral-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl text-neutral-900 sm:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-start gap-5">
        <GradeBadge grade={result.grade} />
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-2xl font-bold leading-tight text-neutral-950">{result.foodName}</h2>
          {result.brand ? (
            <p className="text-sm font-medium text-neutral-600">{result.brand}</p>
          ) : null}
          <p className="mt-2 font-semibold text-emerald-700">
            {gradeLabel[(result.grade || "C").toUpperCase()]}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-extrabold text-neutral-950">{result.score}/100</div>
          <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            health score
          </div>
        </div>
      </header>

      {/* Verdict */}
      <p className="mt-6 rounded-2xl bg-neutral-100/90 border border-neutral-200/60 p-4 text-base font-semibold text-neutral-900 leading-snug">
        {result.verdict}
      </p>

      {/* Why it scores this way */}
      <section className="mt-6">
        <h3 className="text-lg font-bold text-neutral-950">Why it scores this way</h3>
        <div className="mt-2 space-y-3 text-[0.975rem] leading-relaxed text-neutral-800">
          {result.explanation.split(/\n{1,2}/).filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* What's inside that hurts */}
      {result.ingredients.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg font-bold text-neutral-950">What's inside that hurts</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.ingredients.map((ing, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-2xl border p-4 shadow-sm",
                  severityStyles[ing.severity] ?? severityStyles["medium"],
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-neutral-950">{ing.name}</span>
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-neutral-600">
                    {ing.severity} risk
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-neutral-700">{ing.concern}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nutrition at a glance */}
      {result.nutrition.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg font-bold text-neutral-950">Nutrition at a glance</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {result.nutrition.map((n, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3 shadow-sm">
                <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">{n.label}</dt>
                <dd className="font-display text-lg font-bold text-neutral-950">{n.value}</dd>
                {n.note ? <p className="text-xs font-medium text-neutral-600">{n.note}</p> : null}
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* In its favour */}
      {result.goodPoints.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg font-bold text-neutral-950">In its favour</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-800 font-medium">
            {result.goodPoints.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Better swaps */}
      {result.alternatives.length > 0 && (
        <section className="mt-7">
          <h3 className="text-lg font-bold text-neutral-950">Better swaps</h3>
          <ul className="mt-3 space-y-2">
            {result.alternatives.map((a, i) => (
              <li key={i} className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 shadow-sm">
                <span className="font-bold text-neutral-950">{a.name}</span>
                <p className="text-sm font-medium text-neutral-700">{a.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disclaimer */}
      <p className="mt-6 text-xs font-medium text-neutral-500">
        Confidence: {result.confidence}. General wellness guidance, not medical advice.
      </p>
    </article>
  );
}
