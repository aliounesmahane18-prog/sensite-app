import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase de lecture publique, utilisé depuis les Server Components.
 *
 * Il utilise la clé « anon », donc les règles RLS s'appliquent : ce client ne
 * voit que ce qu'un visiteur non connecté peut voir. C'est volontaire —
 * la landing est publique, elle n'a aucune raison de contourner les RLS.
 * Pour les écritures privilégiées, voir `lib/supabase-admin.ts`.
 *
 * Retourne `null` si la configuration est absente au lieu de lever une
 * erreur : le build de Next.js doit pouvoir passer sans variables
 * d'environnement, et la landing doit rester affichable (en version
 * dégradée) si Supabase n'est pas joignable.
 */

let client: SupabaseClient | null = null;

export function getSupabasePublicServer(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) return null;

  client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
