"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase, SupabaseConfigError } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionProfile } from "@/lib/session";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import { getErrorMessage } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [current, setCurrent] = useState<{ email: string; role: string } | null>(null);

  // La config publique est injectée dans `window` : on ne peut la lire
  // qu'après le montage, sinon le rendu serveur et le rendu client divergent.
  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  // Une session existante est signalée, jamais suivie d'une redirection
  // automatique : sinon on ne peut plus atteindre le formulaire pour passer
  // du compte gérant au compte admin.
  useEffect(() => {
    if (configured !== true) return;
    let cancelled = false;

    const detectSession = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled || !profile) return;
        setCurrent({ email: profile.email, role: profile.role });
      } catch {
        // Pas de session exploitable : le formulaire suffit.
      }
    };

    detectSession();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const goToSpace = (role: string) => router.replace(role === "super_admin" ? "/admin" : "/dashboard");

  const switchAccount = async () => {
    setError("");
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Même si la déconnexion distante échoue, on rend le formulaire utilisable.
    }
    setCurrent(null);
    setEmail("");
    setPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabase();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Email ou mot de passe incorrect."
            : signInError.message,
        );
        return;
      }
      if (!data.user) {
        setError("Connexion impossible, réessaie.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        setError("Ton compte n'est rattaché à aucune boutique. Contacte Ali.IA Solutions.");
        await supabase.auth.signOut();
        return;
      }

      router.replace(profile.role === "super_admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof SupabaseConfigError ? err.message : getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (configured === false) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <ConfigError />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold">
            SENsite<span className="text-orange-500">APP</span>
          </Link>
          <p className="text-gray-500 mt-2">Connexion à ton espace boutique</p>
        </div>

        {current && (
          <div className="card p-4 mb-4 border-l-4 border-orange-500 space-y-3">
            <p className="text-sm text-gray-700">
              Déjà connecté en tant que <span className="font-semibold break-all">{current.email}</span>
              {current.role === "super_admin" && <span className="badge bg-gray-900 text-white ml-2">Admin</span>}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => goToSpace(current.role)} className="btn-primary text-sm flex-1">
                Aller à mon espace
              </button>
              <button onClick={switchAccount} className="btn-secondary text-sm flex-1">
                Changer de compte
              </button>
            </div>
          </div>
        )}

        <div className="card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <ErrorBanner message={error} />}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="boutique@exemple.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          Pas de boutique ?{" "}
          <a href="https://wa.me/221XXXXXXXXX" className="text-orange-500 font-semibold">
            Contacte Ali.IA
          </a>
        </p>
      </div>
    </div>
  );
}
