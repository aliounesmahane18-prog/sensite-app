"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { formatFcfa, generateOrderNumber, getErrorMessage } from "@/lib/utils";
import { FILTRES, type StatutCommande } from "@/lib/commandes";
import type { Commande } from "@/lib/use-commandes";

interface Produit {
  id: string;
  name: string;
  price: number;
}

interface Ligne {
  product_id: string;
  quantity: number;
}

interface Props {
  boutiqueId: string;
  onFermer: () => void;
  onCreee: (c: Commande) => void;
}

/**
 * Saisie d'une commande prise au comptoir ou par téléphone.
 *
 * Les prix viennent du catalogue de la boutique et ne sont pas saisissables :
 * une commande manuelle doit rester comparable aux commandes WhatsApp, dont
 * les prix sont recalculés côté serveur.
 */
export default function ModaleCommandeManuelle({ boutiqueId, onFermer, onCreee }: Props) {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([{ product_id: "", quantity: 1 }]);
  const [client, setClient] = useState({ nom: "", telephone: "", adresse: "", notes: "" });
  const [statut, setStatut] = useState<StatutCommande>("new");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const charger = async () => {
      const { data } = await getSupabase()
        .from("products")
        .select("id, name, price")
        .eq("boutique_id", boutiqueId)
        .eq("is_available", true)
        .order("name");
      setProduits((data ?? []) as Produit[]);
    };
    charger();
  }, [boutiqueId]);

  const prix = (id: string) => produits.find(p => p.id === id)?.price ?? 0;
  const total = lignes.reduce((s, l) => s + prix(l.product_id) * l.quantity, 0);
  const lignesValides = lignes.filter(l => l.product_id && l.quantity > 0);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lignesValides.length === 0) {
      setErreur("Ajoute au moins un produit.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      // Les lignes sont figées à l'enregistrement (nom et prix du moment) :
      // une hausse de prix plus tard ne doit pas réécrire une commande passée.
      const items = lignesValides.map(l => {
        const p = produits.find(x => x.id === l.product_id)!;
        return { product_id: p.id, name: p.name, price: p.price, quantity: l.quantity };
      });

      const { data, error } = await getSupabase()
        .from("orders")
        .insert({
          boutique_id: boutiqueId,
          order_number: generateOrderNumber(),
          customer_name: client.nom.trim() || null,
          customer_phone: client.telephone.trim() || null,
          customer_address: client.adresse.trim() || null,
          items,
          total_amount: items.reduce((s, i) => s + i.price * i.quantity, 0),
          status: statut,
          source: "manuelle",
          notes: client.notes.trim() || null,
        })
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      // Un INSERT bloqué par RLS n'échoue pas : il n'écrit simplement rien.
      if (!data) throw new Error("Enregistrement refusé : droits insuffisants sur cette boutique.");

      onCreee(data as Commande);
      onFermer();
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        onSubmit={enregistrer}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Nouvelle commande</h2>
          <button type="button" onClick={onFermer} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        {erreur && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{erreur}</div>
        )}

        <div className="space-y-3">
          <p className="label">Produits</p>
          {produits.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              Cette boutique n&apos;a aucun produit disponible : ajoute d&apos;abord des produits.
            </p>
          )}
          {lignes.map((l, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={l.product_id}
                onChange={e =>
                  setLignes(prev => prev.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))
                }
                className="input-field flex-1"
                aria-label={`Produit ${i + 1}`}
              >
                <option value="">— Choisir —</option>
                {produits.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatFcfa(p.price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={l.quantity}
                onChange={e =>
                  setLignes(prev =>
                    prev.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x)),
                  )
                }
                className="input-field w-20"
                aria-label={`Quantité ${i + 1}`}
              />
              {lignes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
                  className="px-3 text-red-500 hover:bg-red-50 rounded-xl"
                  aria-label="Retirer ce produit"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLignes(prev => [...prev, { product_id: "", quantity: 1 }])}
            className="btn-secondary text-xs"
          >
            ＋ Ajouter un produit
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 font-bold">
          <span>Total</span>
          <span className="text-orange-500">{formatFcfa(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cm-nom">Nom client</label>
            <input id="cm-nom" value={client.nom}
              onChange={e => setClient({ ...client, nom: e.target.value })}
              className="input-field" placeholder="Optionnel" />
          </div>
          <div>
            <label className="label" htmlFor="cm-tel">Téléphone</label>
            <input id="cm-tel" type="tel" value={client.telephone}
              onChange={e => setClient({ ...client, telephone: e.target.value })}
              className="input-field" placeholder="Optionnel" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cm-adresse">Adresse de livraison</label>
          <input id="cm-adresse" value={client.adresse}
            onChange={e => setClient({ ...client, adresse: e.target.value })}
            className="input-field" placeholder="Optionnel" />
        </div>

        <div>
          <label className="label" htmlFor="cm-notes">Notes</label>
          <textarea id="cm-notes" rows={2} value={client.notes}
            onChange={e => setClient({ ...client, notes: e.target.value })}
            className="input-field resize-none" placeholder="Optionnel" />
        </div>

        <div>
          <label className="label" htmlFor="cm-statut">Statut initial</label>
          <select id="cm-statut" value={statut}
            onChange={e => setStatut(e.target.value as StatutCommande)}
            className="input-field">
            {FILTRES.filter(f => f.cle !== "toutes").map(f => (
              <option key={f.cle} value={f.cle}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={envoi || lignesValides.length === 0} className="btn-primary flex-1">
            {envoi ? "Enregistrement…" : "Enregistrer la commande"}
          </button>
          <button type="button" onClick={onFermer} className="btn-secondary">Annuler</button>
        </div>
      </form>
    </div>
  );
}
