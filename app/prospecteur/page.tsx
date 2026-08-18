"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getProspecteur, getSessionProfile } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import { slugify } from "@/lib/utils";
import type { BoutiqueStatus, Prospecteur } from "@/types";

interface BoutiqueRow {
  id: string;
  name: string;
  slug: string;
  ville: string | null;
  quartier: string | null;
  status: BoutiqueStatus;
  created_at: string;
}

const STATUS_BADGE: Record<BoutiqueStatus, { label: string; className: string }> = {
  demo: { label: "Démo", className: "bg-orange-100 text-orange-700" },
  active: { label: "Active", className: "bg-green-100 text-green-700" },
  suspended: { label: "Suspendue", className: "bg-red-100 text-red-700" },
};

const CATEGORIES: [string, string][] = [
  ["pret_a_porter", "Prêt-à-porter"],
  ["electromenager", "Électroménager"],
  ["bazar", "Bazar"],
  ["quincaillerie", "Quincaillerie"],
  ["bijouterie", "Bijouterie"],
  ["autre", "Autre"],
];

type Etat = "chargement" | "pret" | "suspendu" | "interdit" | "non-configure";

export default function ProspecteurPage() {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>("chargement");
  const [prospecteur, setProspecteur] = useState<Prospecteur | null>(null);
  const [boutiques, setBoutiques] = useState<BoutiqueRow[]>([]);
  const [error, setError] = useState("");
  const [modalOuverte, setModalOuverte] = useState(false);
  const [creation, setCreation] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "bazar",
    whatsapp_number: "",
    ville: "",
    quartier: "",
    monthly_price: "",
    date_prochain_paiement: "",
    notes_paiement: "",
  });

  const chargerBoutiques = useCallback(async (prospecteurId: string) => {
    const { data, error: queryError } = await getSupabase()
      .from("boutiques")
      .select("id, name, slug, ville, quartier, status, created_at")
      .eq("prospecteur_id", prospecteurId)
      .order("created_at", { ascending: false });
    if (queryError) throw new Error(queryError.message);
    setBoutiques(data ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isSupabaseConfigured()) {
        setEtat("non-configure");
        return;
      }
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile) {
          router.replace("/login");
          return;
        }
        if (profile.role !== "prospecteur") {
          setEtat("interdit");
          return;
        }

        const fiche = await getProspecteur();
        if (cancelled) return;
        if (!fiche) {
          setError("Aucune fiche prospecteur n'est rattachée à ton compte. Contacte Ali.IA Solutions.");
          setEtat("suspendu");
          return;
        }
        setProspecteur(fiche);

        if (!fiche.is_active) {
          setEtat("suspendu");
          return;
        }

        await chargerBoutiques(fiche.id);
        if (!cancelled) setEtat("pret");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement.");
        setEtat("pret");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [router, chargerBoutiques]);

  const creerBoutique = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospecteur) return;
    setError("");
    setCreation(true);
    try {
      const base = slugify(form.name) || `boutique-${Date.now()}`;
      // Le slug doit rester unique : on suffixe si l'adresse est déjà prise.
      let slug = base;
      for (let essai = 1; essai <= 20; essai++) {
        const { data: existante } = await getSupabase()
          .from("boutiques")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existante) break;
        slug = `${base}-${essai + 1}`;
      }

      const { data, error: insertError } = await getSupabase()
        .from("boutiques")
        .insert({
          name: form.name.trim(),
          slug,
          category: form.category,
          whatsapp_number: form.whatsapp_number.trim(),
          ville: form.ville.trim() || prospecteur.ville,
          quartier: form.quartier.trim() || prospecteur.quartier,
          prospecteur_id: prospecteur.id,
          created_by_role: "prospecteur",
          // Facturation : saisissable uniquement ici. Après création, seul le
          // super admin peut la modifier (trigger protect_boutique_admin_fields).
          monthly_price: form.monthly_price.trim() === "" ? 0 : Number.parseInt(form.monthly_price, 10),
          date_prochain_paiement: form.date_prochain_paiement || null,
          notes_paiement: form.notes_paiement.trim() || null,
        })
        .select("id, name, slug, ville, quartier, status, created_at")
        .maybeSingle();

      if (insertError) throw new Error(insertError.message);
      if (!data) {
        throw new Error(
          "Création refusée : ton compte prospecteur n'est pas actif. Contacte Ali.IA Solutions.",
        );
      }

      setBoutiques(prev => [data, ...prev]);
      setModalOuverte(false);
      setForm({
        name: "", category: "bazar", whatsapp_number: "", ville: "", quartier: "",
        monthly_price: "", date_prochain_paiement: "", notes_paiement: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreation(false);
    }
  };

  if (etat === "non-configure") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ConfigError />
      </div>
    );
  }

  if (etat === "chargement") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (etat === "interdit") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-5xl mb-4">🚫</p>
          <h1 className="text-xl font-bold mb-2">Espace réservé aux prospecteurs</h1>
          <Link href="/login" className="text-orange-500 font-semibold">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  if (etat === "suspendu") {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-orange-200 p-6 max-w-md w-full text-center space-y-3">
          <p className="text-5xl">⏳</p>
          <h1 className="text-xl font-bold text-gray-900">Compte en attente</h1>
          <p className="text-gray-600 text-sm">
            Votre compte prospecteur est en attente d&apos;activation par l&apos;administrateur.
          </p>
          {error && <ErrorBanner message={error} />}
          {prospecteur && (
            <p className="text-xs text-gray-400">
              {prospecteur.nom}
              {prospecteur.ville ? ` — ${prospecteur.ville}` : ""}
              {prospecteur.quartier ? `, ${prospecteur.quartier}` : ""}
            </p>
          )}
          <button
            onClick={async () => {
              await getSupabase().auth.signOut();
              router.replace("/login");
            }}
            className="btn-secondary text-sm w-full"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center justify-between sticky top-0 z-30 gap-3">
        <span className="font-bold truncate">
          SENsite<span className="text-orange-500">APP</span>
          <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full ml-1">Prospecteur</span>
        </span>
        <button
          onClick={async () => {
            await getSupabase().auth.signOut();
            router.replace("/login");
          }}
          className="text-gray-400 hover:text-white text-sm shrink-0"
        >
          Déconnexion
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="section-title">{prospecteur?.nom}</h1>
            <p className="text-sm text-gray-500">
              📍 {prospecteur?.ville ?? "Ville non renseignée"}
              {prospecteur?.quartier ? ` — ${prospecteur.quartier}` : ""}
            </p>
          </div>
          <button onClick={() => setModalOuverte(true)} className="btn-primary text-sm shrink-0">
            + Créer une boutique
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Boutiques", value: boutiques.length, color: "text-blue-600" },
            {
              label: "Actives",
              value: boutiques.filter(b => b.status === "active").length,
              color: "text-green-600",
            },
            {
              label: "En démo",
              value: boutiques.filter(b => b.status === "demo").length,
              color: "text-orange-600",
            },
          ].map(stat => (
            <div key={stat.label} className="card p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {boutiques.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-3">🏪</p>
              <p className="text-gray-500 mb-4">Aucune boutique créée pour l&apos;instant</p>
              <button onClick={() => setModalOuverte(true)} className="btn-primary">
                Créer ma première boutique
              </button>
            </div>
          ) : (
            boutiques.map(b => {
              const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.demo;
              const creeLe = new Date(b.created_at);
              return (
                <div key={b.id} className="card p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold shrink-0">
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{b.name}</span>
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </div>
                    <div className="text-xs text-gray-400 flex gap-3 flex-wrap mt-0.5">
                      <span className="font-mono">/boutique/{b.slug}</span>
                      {(b.ville || b.quartier) && (
                        <span>
                          📍 {[b.ville, b.quartier].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span>
                        🗓 {creeLe.toLocaleDateString("fr-FR")} à{" "}
                        {creeLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/prospecteur/boutique/${b.id}`}
                    className="btn-primary text-xs py-1.5 px-3 shrink-0"
                  >
                    ⚙️ Paramétrer
                  </Link>
                </div>
              );
            })
          )}
        </div>

        <p className="text-xs text-gray-400">
          Une boutique créée démarre en <strong>démo</strong> : son catalogue n&apos;est pas encore
          visible du public. Seul l&apos;administrateur peut la passer en <strong>active</strong>.
        </p>
      </div>

      {modalOuverte && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOuverte(false)} />
          <form
            onSubmit={creerBoutique}
            className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="font-bold text-lg">Nouvelle boutique</h2>

            <div>
              <label className="label" htmlFor="b-name">
                Nom de la boutique *
              </label>
              <input
                id="b-name"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Mode Dakar"
                required
              />
              {form.name && (
                <p className="text-xs text-gray-400 mt-1">
                  Adresse : <span className="font-mono text-orange-500">/boutique/{slugify(form.name)}</span>
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="b-category">
                Secteur
              </label>
              <select
                id="b-category"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="b-whatsapp">
                WhatsApp du commerçant *
              </label>
              <input
                id="b-whatsapp"
                type="tel"
                value={form.whatsapp_number}
                onChange={e => setForm({ ...form, whatsapp_number: e.target.value })}
                className="input-field"
                placeholder="+221 77..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="b-ville">
                  Ville
                </label>
                <input
                  id="b-ville"
                  type="text"
                  value={form.ville}
                  onChange={e => setForm({ ...form, ville: e.target.value })}
                  className="input-field"
                  placeholder={prospecteur?.ville ?? "Dakar"}
                />
              </div>
              <div>
                <label className="label" htmlFor="b-quartier">
                  Quartier
                </label>
                <input
                  id="b-quartier"
                  type="text"
                  value={form.quartier}
                  onChange={e => setForm({ ...form, quartier: e.target.value })}
                  className="input-field"
                  placeholder={prospecteur?.quartier ?? "Plateau"}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Laissés vides, la ville et le quartier reprennent ta zone.
            </p>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900">💰 Facturation</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Optionnel mais recommandé. ⓘ Ces informations seront visibles et modifiables
                  par l&apos;administrateur — <strong>tu ne pourras plus les changer</strong> après
                  la création.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="b-montant">
                    Montant mensuel (FCFA)
                  </label>
                  <input
                    id="b-montant"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.monthly_price}
                    onChange={e => setForm({ ...form, monthly_price: e.target.value })}
                    className="input-field"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="b-echeance">
                    Prochain paiement
                  </label>
                  <input
                    id="b-echeance"
                    type="date"
                    value={form.date_prochain_paiement}
                    onChange={e => setForm({ ...form, date_prochain_paiement: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="b-notes-paiement">
                  Notes de paiement
                </label>
                <textarea
                  id="b-notes-paiement"
                  rows={2}
                  value={form.notes_paiement}
                  onChange={e => setForm({ ...form, notes_paiement: e.target.value })}
                  className="input-field resize-none"
                  placeholder="Le client préfère payer le 1er du mois"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalOuverte(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button type="submit" disabled={creation} className="btn-primary flex-1">
                {creation ? "Création..." : "Créer la boutique"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
