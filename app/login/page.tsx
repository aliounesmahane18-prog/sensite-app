"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase, SupabaseConfigError } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import { getErrorMessage } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);

  // La config publique est injectée dans `window` : on ne peut la lire
  // qu'après le montage, sinon le rendu serveur et le rendu client divergent.
  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  // Déjà connecté ? On envoie directement vers le bon espace.
  useEffect(() => {
    if (configured !== true) return;
    let cancelled = false;

    const redirectIfLoggedIn = async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        router.replace(profile?.role === "super_admin" ? "/admin" : "/dashboard");
      } catch {
        // Pas de session exploitable : on laisse le formulaire s'afficher.
      }
    };

    redirectIfLoggedIn();
    return () => {
      cancelled = true;
    };
  }, [configured, router]);

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
