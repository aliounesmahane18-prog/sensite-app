"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { echeance, montantLisible, origineFacturation, type Facturation } from "@/lib/facturation";

interface Props {
  boutiqueId: string;
  facturation: Facturation;
  /** Remonte les valeurs enregistrées pour rafraîchir la liste parente. */
  onSaved: (f: Facturation) => void;
}

/**
 * Bloc « Facturation » du super admin : lecture, puis édition inline.
 *
 * Côté base, `stamp_facturation` renseigne seul `montant_modifie_par` et
 * `montant_modifie_at` — on ne les envoie donc jamais depuis le client, ce qui
 * évite qu'ils mentent sur l'auteur réel de la modification.
 */
export default function FacturationPanel({ boutiqueId, facturation, onSaved }: Props) {
  const [edition, setEdition] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    monthly_price: facturation.monthly_price ? String(facturation.monthly_price) : "",
    date_prochain_paiement: facturation.date_prochain_paiement ?? "",
    notes_paiement: facturation.notes_paiement ?? "",
  });

  const montant = montantLisible(facturation.monthly_price);
  const ech = echeance(facturation.date_prochain_paiement);
  const origine = origineFacturation(facturation);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const prix = form.monthly_price.trim() === "" ? 0 : Number.parseInt(form.monthly_price, 10);
    if (!Number.isFinite(prix) || prix < 0) {
      setError("Le montant doit être un nombre positif.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: upError } = await getSupabase()
        .from("boutiques")
        .update({
          monthly_price: prix,
          date_prochain_paiement: form.date_prochain_paiement || null,
          notes_paiement: form.notes_paiement.trim() || null,
        })
        .eq("id", boutiqueId)
        .select("monthly_price, date_prochain_paiement, notes_paiement, montant_modifie_par, montant_modifie_at")
        .maybeSingle();

      if (upError) throw new Error(upError.message);
      // Un UPDATE bloqué par RLS ne lève pas d'erreur : il ne touche aucune ligne.
      if (!data) throw new Error("Modification refusée : seul le super admin peut changer la facturation.");

      onSaved(data as Facturation);
      setEdition(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-gray-100 pt-3 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm text-gray-900">💰 Facturation</h3>
        {!edition && (
          <button
            onClick={() => {
              setForm({
                monthly_price: facturation.monthly_price ? String(facturation.monthly_price) : "",
                date_prochain_paiement: facturation.date_prochain_paiement ?? "",
                notes_paiement: facturation.notes_paiement ?? "",
              });
              setEdition(true);
            }}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            ✏️ Modifier
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded-xl text-xs">{error}</div>
      )}

      {edition ? (
        <form onSubmit={enregistrer} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs" htmlFor={`mp-${boutiqueId}`}>
                Montant mensuel (FCFA)
              </label>
              <input
                id={`mp-${boutiqueId}`}
                type="number"
                min={0}
                inputMode="numeric"
                value={form.monthly_price}
                onChange={e => setForm({ ...form, monthly_price: e.target.value })}
                className="input-field text-sm"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor={`dp-${boutiqueId}`}>
                Date prochain paiement
              </label>
              <input
                id={`dp-${boutiqueId}`}
                type="date"
                value={form.date_prochain_paiement}
                onChange={e => setForm({ ...form, date_prochain_paiement: e.target.value })}
                className="input-field text-sm"
              />
            </div>
          </div>
          <div>
            <label className="label text-xs" htmlFor={`np-${boutiqueId}`}>
              Notes de paiement
            </label>
            <textarea
              id={`np-${boutiqueId}`}
              rows={2}
              value={form.notes_paiement}
              onChange={e => setForm({ ...form, notes_paiement: e.target.value })}
              className="input-field text-sm resize-none"
              placeholder="Le client préfère payer le 1er du mois"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEdition(false)} className="btn-secondary text-xs flex-1">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs flex-1">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-4 flex-wrap text-sm">
            <div>
              <span className="text-gray-400 text-xs block">Montant / mois</span>
              {montant ? (
                <span className="font-bold text-orange-500">{montant}</span>
              ) : (
                <span className="text-gray-400">Non défini</span>
              )}
            </div>
            <div>
              <span className="text-gray-400 text-xs block">Prochain paiement</span>
              <span className={`badge ${ech.className}`}>{ech.label}</span>
            </div>
          </div>

          {facturation.notes_paiement && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded-xl p-2">
              📝 {facturation.notes_paiement}
            </p>
          )}

          {origine && <p className="text-xs text-gray-400">{origine}</p>}
        </div>
      )}
    </div>
  );
}
