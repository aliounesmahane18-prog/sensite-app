"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccessToken, getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import type { Prospecteur } from "@/types";
import AdminTabs from "@/components/admin-tabs";

interface Ligne extends Prospecteur {
  nb_boutiques: number;
}

export default function AdminProspecteursPage() {
  const router = useRouter();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unconfigured">("loading");
  const [error, setError] = useState("");
  const [modalOuverte, setModalOuverte] = useState(false);
  const [creation, setCreation] = useState(false);
  const [cree, setCree] = useState<{ email: string; password: string } | null>(null);
  const [nouveau, setNouveau] = useState({
    email: "", nom: "", prenom: "", telephone: "", ville: "", quartier: "",
  });

  const chargerListe = async () => {
    const supabase = getSupabase();
    const { data: prospecteurs, error: qError } = await supabase
      .from("prospecteurs").select("*").order("created_at", { ascending: false });
    if (qError) throw new Error(qError.message);

    const { data: boutiques } = await supabase
      .from("boutiques").select("prospecteur_id").not("prospecteur_id", "is", null);

    const compte = new Map<string, number>();
    for (const b of boutiques ?? []) {
      const key = (b as { prospecteur_id: string }).prospecteur_id;
      compte.set(key, (compte.get(key) ?? 0) + 1);
    }
    setLignes((prospecteurs ?? []).map((p: Prospecteur) => ({
      ...p, nb_boutiques: compte.get(p.id) ?? 0,
    })));
  };

  const creerProspecteur = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreation(true);
    try {
      const token = await getAccessToken();
      if (!token) { router.replace("/login"); return; }

      const res = await fetch("/api/admin/create-prospecteur", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(nouveau),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Création impossible.");

      setCree({ email: json.compte.email, password: json.compte.password });
      setNouveau({ email: "", nom: "", prenom: "", telephone: "", ville: "", quartier: "" });
      await chargerListe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreation(false);
    }
  };

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

        // Une seule requête pour tous les comptages, plutôt qu'une par ligne.
        await chargerListe();
        if (cancelled) return;
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
        <AdminTabs />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="section-title">Prospecteurs</h1>
          <button onClick={() => { setCree(null); setModalOuverte(true); }} className="btn-primary text-sm shrink-0">
            ＋ Ajouter un prospecteur
          </button>
        </div>

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

      {modalOuverte && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!creation) { setModalOuverte(false); setCree(null); } }}
          />

          {cree ? (
            // Écran de confirmation : le mot de passe n'est affiché qu'une fois,
            // il n'est stocké en clair nulle part.
            <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              <h2 className="font-bold text-lg">✅ Compte créé</h2>

              <p className="text-sm text-gray-700">
                Le compte de <span className="font-semibold break-all">{cree.email}</span> est prêt.
                Transmets-lui les identifiants ci-dessous — ils ne seront plus jamais affichés.
              </p>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-orange-800">
                  🔐 Identifiants — affichés une seule fois
                </p>
                <p className="text-sm">
                  Email : <span className="font-mono break-all">{cree.email}</span>
                </p>
                <p className="text-sm">
                  Mot de passe : <span className="font-mono font-bold">{cree.password}</span>
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `Bienvenue sur SENsite-APP\n\nConnexion : ${window.location.origin}/login\nEmail : ${cree.email}\nMot de passe : ${cree.password}\n\nPense à changer ton mot de passe.`,
                    )
                  }
                  className="btn-secondary text-sm"
                >
                  📋 Copier le message
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Bienvenue sur SENsite-APP\n\nEmail : ${cree.email}\nMot de passe : ${cree.password}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp text-sm"
                >
                  💬 Envoyer sur WhatsApp
                </a>
              </div>

              <p className="text-xs text-gray-500">
                Le prospecteur apparaît en <strong>Suspendu</strong> : active-le depuis la liste
                pour qu&apos;il puisse accéder à son espace.
              </p>

              <button
                onClick={() => { setModalOuverte(false); setCree(null); }}
                className="btn-primary w-full"
              >
                Terminé
              </button>
            </div>
          ) : (
            <form
              onSubmit={creerProspecteur}
              className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="font-bold text-lg">Nouveau prospecteur</h2>

              {error && <ErrorBanner message={error} />}

              <div>
                <label className="label" htmlFor="p-email">Email *</label>
                <input
                  id="p-email" type="email" required autoComplete="off"
                  value={nouveau.email}
                  onChange={e => setNouveau({ ...nouveau, email: e.target.value })}
                  className="input-field" placeholder="prospecteur@exemple.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="p-nom">Nom *</label>
                  <input
                    id="p-nom" type="text" required
                    value={nouveau.nom}
                    onChange={e => setNouveau({ ...nouveau, nom: e.target.value })}
                    className="input-field" placeholder="Diallo"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="p-prenom">Prénom</label>
                  <input
                    id="p-prenom" type="text"
                    value={nouveau.prenom}
                    onChange={e => setNouveau({ ...nouveau, prenom: e.target.value })}
                    className="input-field" placeholder="Fatou"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="p-tel">Téléphone</label>
                <input
                  id="p-tel" type="tel"
                  value={nouveau.telephone}
                  onChange={e => setNouveau({ ...nouveau, telephone: e.target.value })}
                  className="input-field" placeholder="+221 77..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="p-ville">Ville *</label>
                  <input
                    id="p-ville" type="text" required
                    value={nouveau.ville}
                    onChange={e => setNouveau({ ...nouveau, ville: e.target.value })}
                    className="input-field" placeholder="Dakar"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="p-quartier">Quartier *</label>
                  <input
                    id="p-quartier" type="text" required
                    value={nouveau.quartier}
                    onChange={e => setNouveau({ ...nouveau, quartier: e.target.value })}
                    className="input-field" placeholder="Plateau"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Le compte est créé <strong>suspendu</strong> : tu devras l&apos;activer
                manuellement depuis la liste.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOuverte(false)}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button type="submit" disabled={creation} className="btn-primary flex-1">
                  {creation ? "Création..." : "Créer le compte"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
