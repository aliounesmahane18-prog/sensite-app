/**
 * Configuration publique de l'application (URL Supabase, clé anon, URL de l'app).
 *
 * Pourquoi ce fichier existe :
 * Next.js remplace les `process.env.NEXT_PUBLIC_*` par leur valeur littérale
 * AU MOMENT DU BUILD. Si une variable n'est pas disponible pendant le build
 * (typiquement quand elle est marquée « Sensitive » dans Vercel), le bundle
 * navigateur contient `undefined` et `createClient()` lève l'erreur
 * « supabaseKey is required » — d'où la page blanche.
 *
 * On lit donc la config dans cet ordre :
 *  1. `window.__SENSITE_PUBLIC_ENV__` — injecté à chaque requête par le serveur
 *     (voir `components/public-env-script.tsx`). Fonctionne même si les
 *     variables sont « Sensitive », et prend en compte un changement de
 *     variable dans Vercel sans avoir à rebuilder.
 *  2. `process.env.NEXT_PUBLIC_*` — valeurs inlinées au build (dev local, SSR).
 *
 * Les deux accès à `process.env` ci-dessous sont écrits en toutes lettres :
 * c'est indispensable pour que Next.js puisse les remplacer au build.
 */

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}

declare global {
  interface Window {
    __SENSITE_PUBLIC_ENV__?: Partial<PublicEnv>;
  }
}

function injected(): Partial<PublicEnv> {
  if (typeof window === "undefined") return {};
  return window.__SENSITE_PUBLIC_ENV__ ?? {};
}

export function getPublicEnv(): PublicEnv {
  const runtime = injected();
  const appUrlFallback = typeof window !== "undefined" ? window.location.origin : "";

  return {
    supabaseUrl: runtime.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: runtime.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    appUrl: runtime.appUrl || process.env.NEXT_PUBLIC_APP_URL || appUrlFallback,
  };
}

/** `true` si l'URL et la clé anon Supabase sont toutes les deux disponibles. */
export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** URL publique du catalogue d'une boutique, ex. `https://…/boutique/mode-dakar`. */
export function catalogueUrl(slug: string): string {
  const { appUrl } = getPublicEnv();
  return `${appUrl.replace(/\/+$/, "")}/boutique/${slug}`;
}
