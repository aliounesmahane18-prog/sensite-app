"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import type { Prospecteur } from "@/types";

interface Ligne extends Prospecteur {
  nb_boutiques: number;
}

export default function AdminProspecteursPage() {
  const router = useRouter();
  const [lignes, setLignes] = useState<Ligne[]>([]);
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
        if (!profile) { router.replace("/login"); return; }
        if (profile.role !== "super_admin") { router.replace("/dashboard"); return; }

        const supabase = getSupabase();
        const { data: prospecteurs, error: qError } = await supabase
          .from("prospecteurs")
          .select("*")
          .order("created_at", { ascending: false });
        if (qError) throw new Error(qError.message);

        // Une seule requête pour tous les comptages, plutôt qu'une par ligne.
        const { data: boutiques } = await supabase
          .from("boutiques")
          .select("prospecteur_id")
          .not("prospecteur_id", "is", null);

        const compte = new Map<string, number>();
        for (const b of boutiques ?? []) {
          const key = (b as { prospecteur_id: string }).prospecteur_id;
          compte.set(key, (compte.get(key) ?? 0) + 1);
        }

        if (cancelled) return;
        setLignes((prospecteurs ?? []).map((p: Prospecteur) => ({
          ...p,
          nb_boutiques: compte.get(p.id) ?? 0,
        })));
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement.");
        setState("ready");
      }
    };

    init();
    return () => { cancelled = true; };
  }, [router]);

  const basculerActivation = async (p: Ligne) => {
    const { data, error: upError } = await getSupabase()
      .from("prospecteurs")
      .update({ is_active: !p.is_active })
      .eq("id", p.id)
      .select("id")
      .maybeSingle();

    if (upError) { setError(upError.message); return; }
    if (!data) { setError("Modification refusée : droits insuffisants."); return; }
    setLignes(prev => prev.map(x => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  };

  if (state === "unconfigured") {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><ConfigError /></div>;
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center justify-between sticky top-0 z-30 gap-3">
        <span className="font-bold truncate">
          SENsite<span className="text-orange-500">APP</span>
          <span className="text-xs bg-orange-500 px-2 py-0.5 rounded-full ml-1">Admin</span>
        </span>
        <button
          onClick={async () => { await getSupabase().auth.signOut(); router.replace("/login"); }}
          className="text-gray-400 hover:text-white text-sm shrink-0"
        >
          Déconnexion
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2">
          <Link href="/admin"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-orange-300 transition-colors">
            🏪 Boutiques
          </Link>
          <span className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white">
            🧑🏾‍💼 Prospecteurs
          </span>
        </div>

        <h1 className="section-title">Prospecteurs</h1>

        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: lignes.length, color: "text-blue-600" },
            { label: "Actifs", value: lignes.filter(l => l.is_active).length, color: "text-green-600" },
            {
              label: "Boutiques créées",
              value: lignes.reduce((s, l) => s + l.nb_boutiques, 0),
              color: "text-orange-600",
            },
          ].map(stat => (
            <div key={stat.label} className="card p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {lignes.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">🧑🏾‍💼</p>
            <p className="text-gray-500">Aucun prospecteur enregistré</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Ville / Quartier</th>
                  <th className="px-4 py-3">Boutiques</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Création</th>
                  <th className="px-4 py-3">Dernière activité</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-semibold">
                      {p.nom}{p.prenom ? ` ${p.prenom}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {[p.ville, p.quartier].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 font-bold text-orange-500">{p.nb_boutiques}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${p.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {p.is_active ? "Actif" : "Suspendu"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(p.last_activity)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => basculerActivation(p)}
                          className={`text-xs py-1.5 px-3 rounded-xl border transition-colors ${
                            p.is_active
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-green-50 text-green-700 border-green-200"
                          }`}
                        >
                          {p.is_active ? "Suspendre" : "✓ Activer"}
                        </button>
                        <Link href={`/admin/prospecteurs/${p.id}`}
                          className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap">
                          Voir détail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
