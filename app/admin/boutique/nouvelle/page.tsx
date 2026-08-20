"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase";
import { catalogueUrl } from "@/lib/env";
import { ErrorBanner } from "@/components/config-error";
import { getErrorMessage, slugify } from "@/lib/utils";
import { SECTEURS } from "@/lib/secteurs";

// Liste unique : voir lib/secteurs.ts (alignée sur la contrainte CHECK
// de boutiques.category).
const CATEGORIES = SECTEURS;

interface CreatedBoutique {
  slug: string;
  name: string;
  email: string;
  password: string;
}

export default function NouvelleBoutiquePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedBoutique | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "bazar",
    whatsapp_number: "",
    quartier: "",
    monthly_price: "5000",
    manager_email: "",
    manager_name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/admin/boutiques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          whatsapp_number: form.whatsapp_number,
          quartier: form.quartier,
          monthly_price: Number(form.monthly_price),
          manager_email: form.manager_email,
          manager_name: form.manager_name,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Création impossible.");

      setCreated({
        slug: json.boutique.slug,
        name: json.boutique.name,
        email: json.manager.email,
        password: json.manager.password,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Le mot de passe n'est affiché qu'une seule fois : il n'est stocké nulle
  // part en clair, donc cet écran doit rester visible tant qu'Ali ne l'a pas
  // transmis au gérant.
  if (created) {
    const credentials =
      `Bienvenue sur SENsite-APP 🎉\n\nBoutique : ${created.name}\n` +
      `Catalogue : ${catalogueUrl(created.slug)}\n\n` +
      `Connexion gérant : ${window.location.origin}/login\n` +
      `Email : ${created.email}\nMot de passe : ${created.password}\n\n` +
      `Pense à changer ton mot de passe.`;

    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-xl mx-auto px-4 space-y-5">
          <h1 className="section-title">✅ Boutique créée</h1>

          <div className="card p-5 space-y-4">
            <div>
              <p className="label">Catalogue public</p>
              <p className="font-mono text-sm text-orange-500 break-all">{catalogueUrl(created.slug)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Le catalogue reste invisible tant que l&apos;abonnement n&apos;est pas activé depuis
                la liste des boutiques.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-orange-800">
                🔐 Identifiants du gérant — affichés une seule fois
              </p>
              <p className="text-sm">
                Email : <span className="font-mono">{created.email}</span>
              </p>
              <p className="text-sm">
                Mot de passe : <span className="font-mono font-bold">{created.password}</span>
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => navigator.clipboard.writeText(credentials)}
                className="btn-secondary text-sm"
              >
                📋 Copier le message
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(credentials)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp text-sm"
              >
                💬 Envoyer sur WhatsApp
              </a>
            </div>
          </div>

          <Link href="/admin" className="btn-primary inline-block">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  const slugPreview = slugify(form.name);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-xl mx-auto px-4 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700">
            ←
          </Link>
          <h1 className="section-title">Nouvelle boutique</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner message={error} />}

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-900">🏪 Infos boutique</h2>
            <div>
              <label className="label" htmlFor="boutique-name">
                Nom *
              </label>
              <input
                id="boutique-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Mode Dakar"
                required
              />
            </div>
            {slugPreview && (
              <p className="text-xs text-gray-400">
                URL : <span className="text-orange-500 font-mono">/boutique/{slugPreview}</span>
              </p>
            )}
            <div>
              <label className="label" htmlFor="boutique-category">
                Catégorie
              </label>
              <select
                id="boutique-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="boutique-whatsapp">
                  WhatsApp *
                </label>
                <input
                  id="boutique-whatsapp"
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  className="input-field"
                  placeholder="+221 77..."
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="boutique-quartier">
                  Quartier
                </label>
                <input
                  id="boutique-quartier"
                  type="text"
                  value={form.quartier}
                  onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                  className="input-field"
                  placeholder="Médina..."
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="boutique-price">
                Prix mensuel (FCFA)
              </label>
              <input
                id="boutique-price"
                type="number"
                min={0}
                value={form.monthly_price}
                onChange={(e) => setForm({ ...form, monthly_price: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-900">👤 Compte gérant</h2>
            <div>
              <label className="label" htmlFor="manager-email">
                Email *
              </label>
              <input
                id="manager-email"
                type="email"
                value={form.manager_email}
                onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                className="input-field"
                placeholder="gerant@boutique.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="manager-name">
                Nom
              </label>
              <input
                id="manager-name"
                type="text"
                value={form.manager_name}
                onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                className="input-field"
                placeholder="Moussa Diallo"
              />
            </div>
            <p className="text-xs text-gray-500">
              Le mot de passe est généré automatiquement et affiché après la création.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/admin" className="btn-secondary flex-1 text-center">
              Annuler
            </Link>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Création..." : "Créer la boutique"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
