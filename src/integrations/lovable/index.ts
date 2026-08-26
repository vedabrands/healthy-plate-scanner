import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions
    ) => {
      // Map 'lovable' to 'google' fallback if passed
      const targetProvider = provider === "lovable" ? "google" : provider;

      const redirectTo =
        opts?.redirect_uri ||
        (typeof window !== "undefined" ? `${window.location.origin}/` : undefined);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: targetProvider as "google" | "apple",
        options: {
          redirectTo,
          queryParams: opts?.extraParams,
        },
      });

      if (error) {
        return { error };
      }

      return { redirected: true, data };
    },
  },
};