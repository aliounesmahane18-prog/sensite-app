"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getProspecteur, getSessionProfile } from "@/lib/session";
import { ErrorBanner } from "@/components/config-error";
import ProductForm from "@/components/product-form";
import { THEME_PRESETS } from "@/lib/themes";
import { catalogueUrl } from "@/lib/env";
import type { BoutiqueStatus } from "@/types";

interface Boutique {
  id: string; name: string; slug: string; description: string | null;
  whatsapp_number: string; ville: string | null; quartier: string | null;
  color_primary: string; color_secondary: string; color_accent: string;
  theme_preset: string; status: BoutiqueStatus;
}

interface Produit {
  id: string; name: string; description: string | null; price: number;
  old_price: number | null; category: string | null; image_url: string | null;
  is_available: boolean; is_featured: boolean; has_variants: boolean;
  variants: { name: string; values: string[] }[];
}

interface Commande {
  id: string; order_number: string; customer_name: string; customer_phone: string;
  total_amount: number; status: string; created_at: string;
  items: { name: string; quantity: number; price: number }[];
}

type Onglet = "parametres" | "produits" | "commandes";

const STATUS_BADGE: Record<BoutiqueStatus, { label: string; className: string }> = {
  demo: { label: "Démo", className: "bg-orange-100 text-orange-700" },
  active: { label: "Active", className: "bg-green-100 text-green-700" },
  suspended: { label: "Suspendue", className: "bg-red-100 text-red-700" },
};

export default function ProspecteurBoutiquePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const boutiqueId = typeof params?.id === "string" ? params.id : "";

  const [onglet, setOnglet] = useState<Onglet>("parametres");
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [produitEdite, setProduitEdite] = useState<Produit | "nouveau" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const recharger = useCallback(async () => {
    const supabase = getSupabase();
    const [{ data: prods }, { data: cmds }] = await Promise.all([
      supabase.from("products").select("*").eq("boutique_id", boutiqueId)
        .order("created_at", { ascending: false }),
      supabase.from("orders").select("*").eq("boutique_id", boutiqueId)
        .order("created_at", { ascending: false }),
    ]);
    setProduits(prods ?? []);
    setCommandes(cmds ?? []);
  }, [boutiqueId]);

  useEffect(() => {
    if (!boutiqueId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile) { router.replace("/login"); return; }
        if (profile.role !== "prospecteur") { router.replace("/dashboard"); return; }
        setUserId(profile.id);

        const fiche = await getProspecteur();
        if (cancelled) return;
        if (!fiche?.is_active) { router.replace("/prospecteur"); return; }

        // La politique RLS limite déjà la lecture aux boutiques du prospecteur :
        // une boutique qui ne lui appartient pas renvoie simplement 0 ligne.
        const { data: b } = await getSupabase()
          .from("boutiques")
          .select("id, name, slug, description, whatsapp_number, ville, quartier, color_primary, color_secondary, color_accent, theme_preset, status")
          .eq("id", boutiqueId)
          .eq("prospecteur_id", fiche.id)
          .maybeSingle();

        if (cancelled) return;
        if (!b) {
          setError("Cette boutique ne fait pas partie de tes boutiques.");
          return;
        }
        setBoutique(b);
        await recharger();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [boutiqueId, router, recharger]);

  const enregistrer = async () => {
    if (!boutique) return;
    setSaving(true);
    setError("");
    try {
      const { data, error: updateError } = await getSupabase()
        .from("boutiques")
        .update({
          name: boutique.name,
          description: boutique.description,
          whatsapp_number: boutique.whatsapp_number,
          ville: boutique.ville,
          quartier: boutique.quartier,
          color_primary: boutique.color_primary,
          color_secondary: boutique.color_secondary,
          color_accent: boutique.color_accent,
          theme_preset: boutique.theme_preset,
        })
        .eq("id", boutique.id)
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      // Un UPDATE bloqué par RLS ne renvoie pas d'erreur, juste aucune ligne.
      if (!data) throw new Error("Aucune modification enregistrée : droits insuffisants.");

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const supprimerProduit = async (id: string) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    const { error: delError } = await getSupabase().from("products").delete().eq("id", id);
    if (delError) { setError(delError.message); return; }
    setProduits(prev => prev.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!boutique) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-5xl">🏪</p>
          <p className="text-gray-600">{error || "Boutique introuvable."}</p>
          <Link href="/prospecteur" className="btn-primary inline-block">Retour</Link>
        </div>
      </div>
    );
  }

  const badge = STATUS_BADGE[boutique.status] ?? STATUS_BADGE.demo;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center gap-3 sticky top-0 z-30">
        <Link href="/prospecteur" className="text-gray-300 hover:text-white shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-bold truncate flex-1">{boutique.name}</span>
        <span className={`badge ${badge.className} shrink-0`}>{badge.label}</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {error && <ErrorBanner message={error} />}

        {boutique.status === "demo" && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
            Cette boutique est en <strong>démo</strong> : son catalogue n&apos;est pas encore visible
            du public. Seul l&apos;administrateur peut l&apos;activer.
          </div>
        )}

        <div>
          <p className="label">Lien du catalogue</p>
          <p className="font-mono text-sm text-orange-500 break-all">{catalogueUrl(boutique.slug)}</p>
        </div>

        <div className="flex gap-2 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}>
          {([
            ["parametres", `⚙️ Paramètres`],
            ["produits", `📦 Produits (${produits.length})`],
            ["commandes", `🛒 Commandes (${commandes.length})`],
          ] as [Onglet, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setOnglet(key); setProduitEdite(null); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                onglet === key
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-transparent border-orange-200 text-orange-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {onglet === "parametres" && (
          <div className="space-y-4">
            <div className="card p-4 space-y-4">
              <h2 className="font-bold text-gray-900">📋 Informations</h2>
              <div>
                <label className="label" htmlFor="p-name">Nom</label>
                <input id="p-name" className="input-field" value={boutique.name}
                  onChange={e => setBoutique({ ...boutique, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="p-desc">Description</label>
                <textarea id="p-desc" rows={2} className="input-field resize-none"
                  value={boutique.description ?? ""}
                  onChange={e => setBoutique({ ...boutique, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="p-wa">WhatsApp</label>
                  <input id="p-wa" className="input-field" value={boutique.whatsapp_number}
                    onChange={e => setBoutique({ ...boutique, whatsapp_number: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="p-ville">Ville</label>
                  <input id="p-ville" className="input-field" value={boutique.ville ?? ""}
                    onChange={e => setBoutique({ ...boutique, ville: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="p-quartier">Quartier</label>
                <input id="p-quartier" className="input-field" value={boutique.quartier ?? ""}
                  onChange={e => setBoutique({ ...boutique, quartier: e.target.value })} />
              </div>
            </div>

            <div className="card p-4 space-y-4">
              <h2 className="font-bold text-gray-900">🎨 Thème couleurs</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THEME_PRESETS.map(preset => (
                  <button key={preset.name} type="button"
                    onClick={() => setBoutique({
                      ...boutique, color_primary: preset.primary,
                      color_secondary: preset.secondary, color_accent: preset.accent,
                      theme_preset: preset.name,
                    })}
                    className={`p-2 rounded-xl border-2 text-left transition-all ${
                      boutique.theme_preset === preset.name ? "border-gray-900" : "border-gray-100"
                    }`}>
                    <div className="flex gap-1 mb-1">
                      {preset.preview.map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-gray-700 leading-tight">{preset.name}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ["color_primary", "Principale"],
                  ["color_secondary", "Secondaire"],
                  ["color_accent", "Accent"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="text-center">
                    <div className="relative mx-auto w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-200 mb-1">
                      <div className="w-full h-full" style={{ background: boutique[key] }} />
                      <input type="color" value={boutique[key]}
                        onChange={e => setBoutique({ ...boutique, [key]: e.target.value, theme_preset: "custom" })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={enregistrer} disabled={saving}
              className="btn-primary w-full"
              style={saved ? { background: "#16A34A" } : undefined}>
              {saved ? "✓ Enregistré" : saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        )}

        {onglet === "produits" && (
          <div className="space-y-4">
            {produitEdite ? (
              <>
                <button onClick={() => setProduitEdite(null)} className="btn-secondary text-sm">
                  ← Retour à la liste
                </button>
                {userId && (
                  <ProductForm
                    boutiqueId={boutique.id}
                    userId={userId}
                    product={produitEdite === "nouveau" ? undefined : produitEdite}
                    onSuccess={async () => { setProduitEdite(null); await recharger(); }}
                  />
                )}
              </>
            ) : (
              <>
                <button onClick={() => setProduitEdite("nouveau")} className="btn-primary text-sm">
                  + Ajouter un produit
                </button>
                {produits.length === 0 ? (
                  <div className="card p-10 text-center">
                    <p className="text-4xl mb-2">📦</p>
                    <p className="text-gray-500">Aucun produit</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {produits.map(p => (
                      <div key={p.id} className="card p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">
                            {fmt(p.price)} FCFA
                            {p.category ? ` — ${p.category}` : ""}
                            {p.is_available ? "" : " — masqué"}
                          </p>
                        </div>
                        <button onClick={() => setProduitEdite(p)} className="btn-secondary text-xs py-1.5 px-3">
                          ✏️
                        </button>
                        <button onClick={() => supprimerProduit(p.id)}
                          className="text-xs py-1.5 px-3 bg-red-50 text-red-500 rounded-xl">
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {onglet === "commandes" && (
          <div className="space-y-3">
            {commandes.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-4xl mb-2">🛒</p>
                <p className="text-gray-500">Aucune commande reçue</p>
              </div>
            ) : (
              commandes.map(o => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono font-bold text-sm">{o.order_number}</span>
                    <span className="font-bold text-orange-500 shrink-0">{fmt(o.total_amount)} FCFA</span>
                  </div>
                  <p className="text-sm">👤 {o.customer_name}</p>
                  <a href={`https://wa.me/${o.customer_phone.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-600 font-semibold">
                    💬 {o.customer_phone}
                  </a>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {(Array.isArray(o.items) ? o.items : []).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-600">
                        <span>{item.name} x{item.quantity}</span>
                        <span>{fmt(item.price * item.quantity)} FCFA</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
