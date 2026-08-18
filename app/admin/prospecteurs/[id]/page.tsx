"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { ErrorBanner } from "@/components/config-error";
import { catalogueUrl } from "@/lib/env";
import FacturationPanel from "@/components/facturation-panel";
import { echeance, montantLisible, type Facturation } from "@/lib/facturation";
import type { BoutiqueStatus, Prospecteur } from "@/types";

interface BoutiqueRow {
  id: string;
  name: string;
  slug: string;
  ville: string | null;
  quartier: string | null;
  status: BoutiqueStatus;
  created_at: string;
  monthly_price: number | null;
  date_prochain_paiement: string | null;
  notes_paiement: string | null;
  montant_modifie_par: string | null;
  montant_modifie_at: string | null;
}

const STATUS_BADGE: Record<BoutiqueStatus, { label: string; className: string }> = {
  demo: { label: "Démo", className: "bg-orange-100 text-orange-700" },
  active: { label: "Active", className: "bg-green-100 text-green-700" },
  suspended: { label: "Suspendue", className: "bg-red-100 text-red-700" },
};

export default function AdminProspecteurDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const prospecteurId = typeof params?.id === "string" ? params.id : "";

  const [prospecteur, setProspecteur] = useState<Prospecteur | null>(null);
  const [boutiques, setBoutiques] = useState<BoutiqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!prospecteurId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile) { router.replace("/login"); return; }
        if (profile.role !== "super_admin") { router.replace("/dashboard"); return; }

        const supabase = getSupabase();
        const { data: p } = await supabase
          .from("prospecteurs").select("*").eq("id", prospecteurId).maybeSingle();
        if (cancelled) return;
        if (!p) { setError("Prospecteur introuvable."); return; }
        setProspecteur(p);

        const { data: bs } = await supabase
          .from("boutiques")
          .select("id, name, slug, ville, quartier, status, created_at, monthly_price, date_prochain_paiement, notes_paiement, montant_modifie_par, montant_modifie_at")
          .eq("prospecteur_id", prospecteurId)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        setBoutiques(bs ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [prospecteurId, router]);

  const basculerProspecteur = async () => {
    if (!prospecteur) return;
    const { data, error: upError } = await getSupabase()
      .from("prospecteurs")
      .update({ is_active: !prospecteur.is_active })
      .eq("id", prospecteur.id)
      .select("id")
      .maybeSingle();
    if (upError) { setError(upError.message); return; }
    if (!data) { setError("Modification refusée : droits insuffisants."); return; }
    setProspecteur({ ...prospecteur, is_active: !prospecteur.is_active });
  };

  /**
   * Seul le super admin peut faire passer une boutique de 'demo' à 'active' :
   * le trigger `protect_boutique_admin_fields` rétablit la valeur pour tout
   * autre rôle, et `sync_boutique_status` répercute sur is_active /
   * subscription_status pour que le catalogue public suive.
   */
  const changerStatutBoutique = async (b: BoutiqueRow, nouveau: BoutiqueStatus) => {
    const { data, error: upError } = await getSupabase()
      .from("boutiques")
      .update({ status: nouveau })
      .eq("id", b.id)
      .select("id, status")
      .maybeSingle();
    if (upError) { setError(upError.message); return; }
    if (!data) { setError("Modification refusée : droits insuffisants."); return; }
    setBoutiques(prev => prev.map(x => (x.id === b.id ? { ...x, status: data.status } : x)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!prospecteur) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="space-y-3">
          <p className="text-5xl">🧑🏾‍💼</p>
          <p className="text-gray-600">{error || "Prospecteur introuvable."}</p>
          <Link href="/admin/prospecteurs" className="btn-primary inline-block">Retour</Link>
        </div>
      </div>
    );
  }

  const fmtDateHeure = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center gap-3 sticky top-0 z-30">
        <Link href="/admin/prospecteurs" className="text-gray-300 hover:text-white shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-bold truncate flex-1">
          {prospecteur.nom}{prospecteur.prenom ? ` ${prospecteur.prenom}` : ""}
        </span>
        <span className={`badge shrink-0 ${prospecteur.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {prospecteur.is_active ? "Actif" : "Suspendu"}
        </span>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && <ErrorBanner message={error} />}

        <div className="card p-5 space-y-3">
          <h2 className="font-bold text-gray-900">Fiche prospecteur</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Zone : </span>
              {[prospecteur.ville, prospecteur.quartier].filter(Boolean).join(", ") || "—"}</div>
            <div><span className="text-gray-400">Téléphone : </span>{prospecteur.telephone || "—"}</div>
            <div><span className="text-gray-400">Inscrit le : </span>
              {new Date(prospecteur.created_at).toLocaleDateString("fr-FR")}</div>
            <div><span className="text-gray-400">Dernière activité : </span>
              {prospecteur.last_activity ? fmtDateHeure(prospecteur.last_activity) : "aucune"}</div>
          </div>
          <button
            onClick={basculerProspecteur}
            className={`text-sm py-2 px-4 rounded-xl border transition-colors ${
              prospecteur.is_active
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}
          >
            {prospecteur.is_active ? "Suspendre ce prospecteur" : "✓ Activer ce prospecteur"}
          </button>
          {!prospecteur.is_active && (
            <p className="text-xs text-gray-500">
              Tant qu&apos;il est suspendu, il ne peut ni accéder à son espace ni créer de boutique.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-bold text-gray-900">
            Boutiques créées <span className="text-gray-400">({boutiques.length})</span>
          </h2>

          {boutiques.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl mb-2">🏪</p>
              <p className="text-gray-500">Aucune boutique créée par ce prospecteur</p>
            </div>
          ) : (
            boutiques.map(b => {
              const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.demo;
              return (
                <div key={b.id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{b.name}</span>
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex gap-3 flex-wrap mt-0.5">
                        <span className="font-mono">/boutique/{b.slug}</span>
                        {(b.ville || b.quartier) && (
                          <span>📍 {[b.ville, b.quartier].filter(Boolean).join(", ")}</span>
                        )}
                        <span>🗓 {fmtDateHeure(b.created_at)}</span>
                        <span>
                          💰 {montantLisible(b.monthly_price) ?? (
                            <span className="text-gray-300">Non défini</span>
                          )}
                        </span>
                        <span className={`badge ${echeance(b.date_prochain_paiement).className}`}>
                          {echeance(b.date_prochain_paiement).label}
                        </span>
                      </div>
                    </div>
                    <a href={catalogueUrl(b.slug)} target="_blank" rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1.5 px-3 shrink-0">
                      👁 Voir
                    </a>
                  </div>

                  <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-3">
                    {(["demo", "active", "suspended"] as BoutiqueStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => changerStatutBoutique(b, s)}
                        disabled={b.status === s}
                        className={`text-xs py-1.5 px-3 rounded-xl border transition-colors ${
                          b.status === s
                            ? "bg-gray-900 text-white border-gray-900 cursor-default"
                            : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                        }`}
                      >
                        {STATUS_BADGE[s].label}
                      </button>
                    ))}
                  </div>

                  <FacturationPanel
                    boutiqueId={b.id}
                    facturation={b}
                    onSaved={(f: Facturation) =>
                      setBoutiques(prev => prev.map(x => (x.id === b.id ? { ...x, ...f } : x)))
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
