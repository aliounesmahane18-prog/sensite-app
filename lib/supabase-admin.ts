import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase « service role » : il contourne les règles RLS.
 *
 * À N'IMPORTER QUE depuis des route handlers (`app/api/**`). La clé service
 * role ne doit jamais atteindre le navigateur — d'où le garde-fou ci-dessous
 * et le fait que ce module n'est jamais importé par un composant client.
 */

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("lib/supabase-admin est réservé au serveur.");
  }
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Configuration serveur manquante : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.",
    );
  }

  admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}
