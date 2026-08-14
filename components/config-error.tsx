"use client";

/**
 * Écran affiché quand la config Supabase est absente.
 * Mieux vaut un message explicite qu'une page blanche.
 */
export function ConfigError({ message }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="card p-6 max-w-md w-full space-y-3">
        <p className="text-4xl">⚙️</p>
        <h2 className="font-bold text-lg text-gray-900">Configuration incomplète</h2>
        <p className="text-sm text-gray-600">
          {message ??
            "L'application n'arrive pas à joindre Supabase : les variables d'environnement publiques ne sont pas chargées."}
        </p>
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">À vérifier dans Vercel → Settings → Environment Variables :</p>
          <p>
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> et{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> doivent exister et{" "}
            <strong>ne pas être marquées « Sensitive »</strong>, puis redéployer.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Bandeau d'erreur inline, pour les erreurs non bloquantes. */
export function ErrorBanner({ message }: { message: string }) {
  return <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{message}</div>;
}
