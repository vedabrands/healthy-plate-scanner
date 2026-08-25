import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { GradeBadge } from "@/components/GradeBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your scan history — NutriGrade" },
      {
        name: "description",
        content: "Review every food you've scanned with NutriGrade, with its health grade and verdict.",
      },
      { property: "og:title", content: "Your scan history — NutriGrade" },
      {
        property: "og:description",
        content: "Review every food you've scanned, with its health grade and verdict.",
      },
    ],
  }),
  component: HistoryPage,
});

type Row = {
  id: string;
  food_name: string;
  brand: string | null;
  grade: string;
  score: number | null;
  summary: string | null;
  created_at: string;
};

function HistoryPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    supabase
      .from("scans")
      .select("id, food_name, brand, grade, score, summary, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setFetching(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl">Your scan history</h1>

        {!loading && !user && (
          <div className="mt-6 rounded-3xl border bg-card p-8 text-center shadow-soft">
            <p className="text-muted-foreground">Sign in to see the foods you've scanned.</p>
            <Button className="mt-4" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        )}

        {user && !fetching && rows.length === 0 && (
          <p className="mt-6 text-muted-foreground">
            No scans yet.{" "}
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              Scan something
            </Link>
            .
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-soft">
              <GradeBadge grade={r.grade} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.food_name}</p>
                {r.brand ? <p className="text-xs text-muted-foreground">{r.brand}</p> : null}
                {r.summary ? <p className="mt-1 text-sm text-foreground/80">{r.summary}</p> : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="font-display text-base text-foreground">{r.score ?? "–"}</div>
                {new Date(r.created_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
