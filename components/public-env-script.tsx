import type { PublicEnv } from "@/lib/env";

/**
 * Composant serveur : injecte la config publique dans `window` à chaque requête.
 *
 * C'est ce qui permet à l'app de fonctionner même si les variables
 * `NEXT_PUBLIC_*` n'ont pas été inlinées pendant le build (variables marquées
 * « Sensitive » dans Vercel). Côté serveur, `process.env` est lu à l'exécution,
 * donc la valeur est toujours correcte.
 *
 * Ne contient que des valeurs publiques : l'URL du projet, la clé anon
 * (protégée par RLS) et l'URL de l'app. Jamais la clé service role.
 */
export function PublicEnvScript() {
  const env: PublicEnv = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  };

  // `<` est échappé pour qu'une valeur ne puisse pas fermer la balise script.
  const json = JSON.stringify(env).replace(/</g, "\\u003c");

  return (
    <script
      id="sensite-public-env"
      dangerouslySetInnerHTML={{ __html: `window.__SENSITE_PUBLIC_ENV__=${json};` }}
    />
  );
}
