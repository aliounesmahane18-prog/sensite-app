"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase, SupabaseConfigError } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { catalogueUrl, isSupabaseConfigured } from "@/lib/env";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import { formatFcfa, getErrorMessage } from "@/lib/utils";

interface Boutique {
  id: string;
  name: string;
  slug: string;
  category: string;
  subscription_status: string;
  monthly_price: number;
  quartier: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-orange-100 text-orange-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  suspended: "Suspendu",
  cancelled: "Annulé",
};

export default function AdminPage() {
  const router = useRouter();
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unconfigured">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isSupabaseConfigured()) {
        setState("unconfigured");
        return;
      }
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile) {
          router.replace("/login");
          return;
        }
        if (profile.role !== "super_admin") {
          router.replace("/dashboard");
          return;
        }

        const { data, error: queryError } = await getSupabase()
          .from("boutiques")
          .select("id, name, slug, category, subscription_status, monthly_price, quartier")
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);
        setBoutiques(data ?? []);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SupabaseConfigError) {
          setState("unconfigured");
          return;
        }
        setError(getErrorMessage(err));
        setState("ready");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleStatus = async (boutique: Boutique) => {
    const newStatus = boutique.subscription_status === "active" ? "suspended" : "active";
    const updates: Record<string, unknown> = { subscription_status: newStatus };

    if (newStatus === "active") {
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      updates.subscription_start = new Date().toISOString().slice(0, 10);
      updates.subscription_end = end.toISOString().slice(0, 10);
    }

    const { error: updateError } = await getSupabase()
      .from("boutiques")
      .update(updates)
      .eq("id", boutique.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setBoutiques((prev) =>
      prev.map((b) => (b.id === boutique.id ? { ...b, subscription_status: newStatus } : b)),
    );
  };

  const logout = async () => {
    try {
      await getSupabase().auth.signOut();
    } finally {
      router.replace("/login");
    }
  };

  if (state === "unconfigured") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ConfigError />
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeBoutiques = boutiques.filter((b) => b.subscription_status === "active");
  const stats = {
    total: boutiques.length,
    active: activeBoutiques.length,
    revenue: activeBoutiques.reduce((sum, b) => sum + b.monthly_price, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center justify-between sticky top-0 z-30 gap-3">
        <span className="font-bold truncate">
          SENsite<span className="text-orange-500">APP</span>
          <span className="text-xs bg-orange-500 px-2 py-0.5 rounded-full ml-1">Admin</span>
        </span>
        <div className="flex gap-3 items-center shrink-0">
          <Link href="/admin/boutique/nouvelle" className="btn-primary text-xs py-1.5">
            + Nouvelle boutique
          </Link>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <h1 className="section-title">Gestion des boutiques</h1>

        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: String(stats.total), color: "text-blue-600" },
            { label: "Actives", value: String(stats.active), color: "text-green-600" },
            { label: "Revenu/mois", value: formatFcfa(stats.revenue), color: "text-orange-600" },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {boutiques.map((b) => (
            <div key={b.id} className="card p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold shrink-0">
                {b.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{b.name}</span>
                  <span className={`badge ${STATUS_COLOR[b.subscription_status] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABEL[b.subscription_status] ?? b.subscription_status}
                  </span>
                </div>
                <div className="text-xs text-gray-400 flex gap-3 flex-wrap mt-0.5">
                  {b.quartier && <span>📍 {b.quartier}</span>}
                  <span className="font-mono">/boutique/{b.slug}</span>
                  <span className="text-orange-500 font-semibold">{formatFcfa(b.monthly_price)}/mois</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href={catalogueUrl(b.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  👁 Voir
                </a>
                <button
                  onClick={() => toggleStatus(b)}
                  className={`text-xs py-1.5 px-3 rounded-xl border transition-colors ${
                    b.subscription_status === "active"
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "btn-primary"
                  }`}
                >
                  {b.subscription_status === "active" ? "Suspendre" : "✓ Activer"}
                </button>
              </div>
            </div>
          ))}

          {boutiques.length === 0 && (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-3">🏪</p>
              <p className="text-gray-500">Aucune boutique créée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
