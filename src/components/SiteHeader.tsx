import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">NutriGrade</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/history"
            className="rounded-full px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            History
          </Link>
          {user ? (
            <Button variant="secondary" size="sm" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
