import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { SupabaseConfigurationError } from "@/lib/supabase/errors";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new SupabaseConfigurationError(
      "Supabase environment is not configured",
    );
  }

  return { url, publishableKey };
}

export async function createServerSupabaseClient() {
  const { getToken } = await auth();
  const { url, publishableKey } = getSupabaseConfig();

  return createClient(url, publishableKey, {
    accessToken: () => getToken({ template: "supabase" }),
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}