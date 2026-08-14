import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

/**
 * Erreur levée quand la config Supabase publique est absente.
 * Elle est volontairement *levée à l'appel* et non au chargement du module :
 * une erreur au chargement casse tout le bundle et affiche une page blanche.
 */
export class SupabaseConfigError extends Error {
  constructor() {
    super(
      "Configuration Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (dans Vercel, ces deux variables ne " +
        "doivent PAS être marquées « Sensitive »).",
    );
    this.name = "SupabaseConfigError";
  }
}

let client: SupabaseClient | null = null;

/**
 * Client Supabase navigateur (clé anon, soumis aux règles RLS).
 *
 * Créé à la demande et mis en cache : tant que personne ne l'appelle, un
 * environnement mal configuré n'empêche pas la page de s'afficher.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) throw new SupabaseConfigError();

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Jeton d'accès de la session courante, ou `null` si personne n'est connecté. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}
