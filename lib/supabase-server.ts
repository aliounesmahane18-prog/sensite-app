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

/**
 * Lit une variable d'environnement À L'EXÉCUTION, côté serveur.
 *
 * Next.js remplace toute occurrence littérale de `process.env.NEXT_PUBLIC_X`
 * par sa valeur AU MOMENT DU BUILD — y compris dans le bundle serveur, pas
 * seulement dans celui du navigateur (vérifiable : la valeur se retrouve en
 * clair dans `.next/server/app/page.js`). Si la variable est marquée
 * « Sensitive » dans Vercel, elle n'est pas lisible pendant le build : le
 * serveur se retrouve alors avec `undefined` figé dans son code, et la page
 * d'accueil ne charge ni bannières, ni boutiques, ni produits.
 *
 * L'accès indirect ci-dessous n'est pas une astuce gratuite : il empêche
 * cette substitution, donc la valeur est réellement lue dans l'environnement
 * du serveur au moment de la requête.
 */
export function envServeur(nom: string): string {
  const source = process.env as Record<string, string | undefined>;
  return source[nom] ?? "";
}

/** URL du projet Supabase, lue à l'exécution. */
export function urlSupabase(): string {
  return envServeur("NEXT_PUBLIC_SUPABASE_URL") || envServeur("SUPABASE_URL");
}

let client: SupabaseClient | null = null;

export function getSupabasePublicServer(): SupabaseClient | null {
  if (client) return client;

  const url = urlSupabase();
  const anonKey = envServeur("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    console.error(
      "[landing] Configuration Supabase absente côté serveur. " +
        "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être " +
        "définies dans l'environnement d'exécution (Vercel → Environment Variables).",
    );
    return null;
  }

  client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
