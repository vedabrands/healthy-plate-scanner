import { cn } from "@/lib/utils";

const gradeStyles: Record<string, string> = {
  A: "bg-grade-a",
  B: "bg-grade-b",
  C: "bg-grade-c",
  D: "bg-grade-d",
  E: "bg-grade-e",
  F: "bg-grade-f",
};

export const gradeLabel: Record<string, string> = {
  A: "Genuinely good for you",
  B: "Decent, minor issues",
  C: "Average — occasional treat",
  D: "Poor — clearly unhealthy",
  E: "Very poor — ultra-processed",
  F: "Worst — best avoided",
};

export function GradeBadge({
  grade,
  size = "lg",
  className,
}: {
  grade: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const g = (grade || "C").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-display font-semibold text-primary-foreground shadow-soft",
        gradeStyles[g] ?? "bg-grade-c",
        size === "lg" ? "h-20 w-20 text-5xl" : "h-10 w-10 text-xl",
        className,
      )}
      aria-label={`Grade ${g}`}
    >
      {g}
    </span>
  );
}
