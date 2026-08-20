"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabase, SupabaseConfigError } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError, ErrorBanner } from "@/components/config-error";
import { getErrorMessage } from "@/lib/utils";
import AdminTabs from "@/components/admin-tabs";

const BUCKET = "boutique-banners";
const FORMATS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_OCTETS = 5 * 1024 * 1024;

interface Banniere {
  id: string;
  titre: string | null;
  sous_titre: string | null;
  image_url: string;
  boutique_id: string | null;
  lien_url: string | null;
  ordre: number;
  is_active: boolean;
}

interface BoutiqueOption {
  id: string;
  name: string;
  slug: string;
}

const VIDE = {
  titre: "",
  sous_titre: "",
  boutique_id: "",
  lien_url: "",
  ordre: 0,
  is_active: true,
};

export default function AdminBannieresPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bannieres, setBannieres] = useState<Banniere[]>([]);
  const [boutiques, setBoutiques] = useState<BoutiqueOption[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unconfigured">("loading");
  const [error, setError] = useState("");

  const [modale, setModale] = useState(false);
  const [form, setForm] = useState(VIDE);
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const supabase = getSupabase();

    const { data: lignes, error: qError } = await supabase
      .from("bannieres_landing")
      .select("id, titre, sous_titre, image_url, boutique_id, lien_url, ordre, is_active")
      .order("ordre", { ascending: true });
    if (qError) throw new Error(qError.message);
    setBannieres((lignes ?? []) as Banniere[]);

    const { data: b } = await supabase
      .from("boutiques")
      .select("id, name, slug")
      .eq("status", "active")
      .order("name", { ascending: true });
    setBoutiques((b ?? []) as BoutiqueOption[]);
  };

  useEffect(() => {
    let annule = false;

    const init = async () => {
      if (!isSupabaseConfigured()) {
        setState("unconfigured");
        return;
      }
      try {
        const profile = await getSessionProfile();
        if (annule) return;
        if (!profile) {
          router.replace("/login");
          return;
        }
        if (profile.role !== "super_admin") {
          router.replace("/dashboard");
          return;
        }
        await charger();
        if (annule) return;
        setState("ready");
      } catch (err) {
        if (annule) return;
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
      annule = true;
    };
  }, [router]);

  const choisirFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (!FORMATS[f.type]) {
      setError("Format non accepté. Utilise un JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (f.size > MAX_OCTETS) {
      setError("Image trop lourde (5 Mo maximum).");
      return;
    }
    setError("");
    setFichier(f);
    setApercu(URL.createObjectURL(f));
  };

  const ouvrirModale = () => {
    // Une nouvelle bannière se place à la suite des existantes.
    const suivant = bannieres.reduce((max, b) => Math.max(max, b.ordre), 0) + 1;
    setForm({ ...VIDE, ordre: suivant });
    setFichier(null);
    setApercu(null);
    setError("");
    setModale(true);
  };

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fichier) {
      setError("Choisis une image pour la bannière.");
      return;
    }
    setError("");
    setEnvoi(true);

    const supabase = getSupabase();
    // L'id est tiré ici, avant l'envoi : le chemin de stockage
    // `bannieres/<id>.<ext>` doit être connu au moment de l'upload.
    const id = crypto.randomUUID();
    const ext = FORMATS[fichier.type];
    const chemin = `bannieres/${id}.${ext}`;

    try {
      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
      if (upError) throw new Error(`Envoi de l'image impossible : ${upError.message}`);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(chemin);

      const { data, error: insError } = await supabase
        .from("bannieres_landing")
        .insert({
          id,
          titre: form.titre.trim() || null,
          sous_titre: form.sous_titre.trim() || null,
          image_url: pub.publicUrl,
          boutique_id: form.boutique_id || null,
          lien_url: form.lien_url.trim() || null,
          ordre: form.ordre,
          is_active: form.is_active,
        })
        .select("id")
        .maybeSingle();

      if (insError) throw new Error(insError.message);
      // Un INSERT bloqué par RLS ne lève pas d'erreur : il n'écrit rien.
      if (!data) {
        // L'image est déjà partie : on ne laisse pas de fichier orphelin.
        await supabase.storage.from(BUCKET).remove([chemin]);
        throw new Error("Création refusée : droits insuffisants.");
      }

      await charger();
      setModale(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  const basculerActif = async (b: Banniere) => {
    const { data, error: upError } = await getSupabase()
      .from("bannieres_landing")
      .update({ is_active: !b.is_active })
      .eq("id", b.id)
      .select("id")
      .maybeSingle();
    if (upError) {
      setError(upError.message);
      return;
    }
    if (!data) {
      setError("Modification refusée : droits insuffisants.");
      return;
    }
    setBannieres((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_active: !b.is_active } : x)));
  };

  /** Échange la position d'une bannière avec sa voisine. */
  const deplacer = async (index: number, direction: -1 | 1) => {
    const voisin = index + direction;
    if (voisin < 0 || voisin >= bannieres.length) return;

    const a = bannieres[index];
    const b = bannieres[voisin];
    // Deux bannières peuvent partager le même `ordre` (saisie manuelle) :
    // dans ce cas un simple échange ne changerait rien à l'affichage.
    const [ordreA, ordreB] = a.ordre === b.ordre ? [b.ordre, a.ordre + 1] : [b.ordre, a.ordre];

    const supabase = getSupabase();
    const r1 = await supabase.from("bannieres_landing").update({ ordre: ordreA }).eq("id", a.id).select("id").maybeSingle();
    const r2 = await supabase.from("bannieres_landing").update({ ordre: ordreB }).eq("id", b.id).select("id").maybeSingle();

    if (r1.error || r2.error) {
      setError(r1.error?.message ?? r2.error?.message ?? "Réordonnancement impossible.");
      return;
    }
    if (!r1.data || !r2.data) {
      setError("Réordonnancement refusé : droits insuffisants.");
      return;
    }
    await charger();
  };

  const supprimer = async (b: Banniere) => {
    if (!confirm(`Supprimer définitivement la bannière « ${b.titre || "sans titre"} » ?`)) return;

    const supabase = getSupabase();
    const { data, error: delError } = await supabase
      .from("bannieres_landing")
      .delete()
      .eq("id", b.id)
      .select("id")
      .maybeSingle();

    if (delError) {
      setError(delError.message);
      return;
    }
    if (!data) {
      setError("Suppression refusée : droits insuffisants.");
      return;
    }

    // La ligne est partie : on retire aussi le fichier, sinon il reste
    // facturé et inaccessible.
    const chemin = b.image_url.split("?")[0].split(`/${BUCKET}/`)[1];
    if (chemin) await supabase.storage.from(BUCKET).remove([chemin]);

    setBannieres((prev) => prev.filter((x) => x.id !== b.id));
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center justify-between sticky top-0 z-30 gap-3">
        <span className="font-bold truncate">
          SENsite<span className="text-orange-500">APP</span>
          <span className="text-xs bg-orange-500 px-2 py-0.5 rounded-full ml-1">Admin</span>
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

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <AdminTabs />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="section-title">Bannières de la page d&apos;accueil</h1>
            <p className="text-sm text-gray-500 mt-1">
              Les bannières actives défilent en carrousel, dans l&apos;ordre ci-dessous.
            </p>
          </div>
          <button onClick={ouvrirModale} className="btn-primary text-sm shrink-0">
            ＋ Ajouter une bannière
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {bannieres.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">🖼️</p>
            <p className="text-gray-500">Aucune bannière</p>
            <p className="text-gray-400 text-sm mt-1">
              La page d&apos;accueil affiche le slogan SENsite-APP par défaut.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bannieres.map((b, i) => (
              <div key={b.id} className="card p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                <div
                  className="relative w-28 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-100"
                  style={{ background: "#f5f5f5" }}
                >
                  <Image src={b.image_url} alt={b.titre ?? "Bannière"} fill sizes="112px" className="object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{b.titre || "Sans titre"}</p>
                  {b.sous_titre && <p className="text-xs text-gray-500 truncate">{b.sous_titre}</p>}
                  <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                    {b.lien_url ||
                      (b.boutique_id
                        ? `/boutique/${boutiques.find((x) => x.id === b.boutique_id)?.slug ?? "…"}`
                        : "aucun lien")}
                  </p>
                </div>

                <span className="text-xs text-gray-400 shrink-0">ordre {b.ordre}</span>

                <button
                  onClick={() => basculerActif(b)}
                  className={`badge shrink-0 ${b.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {b.is_active ? "✓ Active" : "Inactive"}
                </button>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => deplacer(i, -1)}
                    disabled={i === 0}
                    aria-label="Monter"
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => deplacer(i, 1)}
                    disabled={i === bannieres.length - 1}
                    aria-label="Descendre"
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => supprimer(b)}
                    aria-label="Supprimer"
                    className="w-8 h-8 rounded-lg border border-gray-200 text-red-500 hover:border-red-300 transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ MODALE DE CRÉATION ============ */}
      {modale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={creer}
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Nouvelle bannière</h2>
              <button
                type="button"
                onClick={() => setModale(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {error && <ErrorBanner message={error} />}

            <div>
              <span className="label">Image de la bannière</span>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-orange-500 transition-colors overflow-hidden"
              >
                {apercu ? (
                  <div className="relative h-40" style={{ background: "#f5f5f5" }}>
                    {/* `cover` ici : c'est le cadrage réel du carrousel. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={apercu} alt="Aperçu" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <span className="text-3xl">🖼️</span>
                    <span className="text-sm mt-2">Choisir une image</span>
                    <span className="text-xs mt-1">JPG, PNG, WEBP ou GIF — 5 Mo max</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Format conseillé : 1600×600 px. L&apos;image est recadrée en 300 px de haut
                (200 px sur mobile).
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={choisirFichier}
                className="hidden"
              />
            </div>

            <div>
              <label htmlFor="ban-titre" className="label">
                Titre <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                id="ban-titre"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                placeholder="Soldes de la rentrée"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="ban-sous-titre" className="label">
                Sous-titre <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                id="ban-sous-titre"
                value={form.sous_titre}
                onChange={(e) => setForm({ ...form, sous_titre: e.target.value })}
                placeholder="Jusqu'à -40 % chez nos partenaires"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="ban-boutique" className="label">
                Boutique liée
              </label>
              <select
                id="ban-boutique"
                value={form.boutique_id}
                onChange={(e) => setForm({ ...form, boutique_id: e.target.value, lien_url: "" })}
                className="input-field"
              >
                <option value="">— Aucune —</option>
                {boutiques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ban-lien" className="label">
                …ou lien libre
              </label>
              <input
                id="ban-lien"
                value={form.lien_url}
                onChange={(e) => setForm({ ...form, lien_url: e.target.value, boutique_id: "" })}
                placeholder="/boutique/noviq ou https://…"
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">
                Si les deux sont renseignés, le lien libre l&apos;emporte.
              </p>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="ban-ordre" className="label">
                  Ordre d&apos;affichage
                </label>
                <input
                  id="ban-ordre"
                  type="number"
                  value={form.ordre}
                  onChange={(e) => setForm({ ...form, ordre: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <label className="flex items-center gap-2 pb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={envoi} className="btn-primary flex-1">
                {envoi ? "Envoi..." : "Créer la bannière"}
              </button>
              <button type="button" onClick={() => setModale(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
