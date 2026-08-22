/**
 * Vocabulaire des commandes.
 *
 * Les clés restent les valeurs anglaises stockées dans `orders.status` — la
 * contrainte CHECK de la base fait foi. Seuls les libellés sont en français.
 */

export type StatutCommande = "new" | "confirmed" | "processing" | "delivered" | "paid" | "cancelled";

export interface InfoStatut {
  label: string;
  puce: string;
  badge: string;
  /** Étape suivante du parcours, `null` si le statut est terminal. */
  suivant: StatutCommande | null;
  labelSuivant?: string;
}

export const STATUTS: Record<StatutCommande, InfoStatut> = {
  new: {
    label: "En attente",
    puce: "🟡",
    badge: "bg-yellow-100 text-yellow-800",
    suivant: "processing",
    labelSuivant: "Prendre en charge",
  },
  confirmed: {
    // Statut historique : conservé pour les commandes déjà enregistrées.
    label: "Confirmée",
    puce: "🔵",
    badge: "bg-blue-100 text-blue-700",
    suivant: "processing",
    labelSuivant: "Prendre en charge",
  },
  processing: {
    label: "En cours",
    puce: "🔵",
    badge: "bg-blue-100 text-blue-700",
    suivant: "delivered",
    labelSuivant: "Marquer livrée",
  },
  delivered: {
    label: "Livrée",
    puce: "🟢",
    badge: "bg-green-100 text-green-700",
    suivant: "paid",
    labelSuivant: "Marquer payée",
  },
  paid: {
    label: "Payée",
    puce: "✅",
    badge: "bg-emerald-700 text-white",
    suivant: null,
  },
  cancelled: {
    label: "Annulée",
    puce: "🔴",
    badge: "bg-red-100 text-red-700",
    suivant: null,
  },
};

/** Ordre des filtres, tel qu'affiché au gérant. */
export const FILTRES: { cle: StatutCommande | "toutes"; label: string }[] = [
  { cle: "toutes", label: "Toutes" },
  { cle: "new", label: "En attente" },
  { cle: "processing", label: "En cours" },
  { cle: "delivered", label: "Livrée" },
  { cle: "paid", label: "Payée" },
  { cle: "cancelled", label: "Annulée" },
];

export function infoStatut(statut: string): InfoStatut {
  return STATUTS[statut as StatutCommande] ?? STATUTS.new;
}

/** Une commande qui attend encore une action du gérant. */
export function estEnAttente(statut: string): boolean {
  return statut === "new" || statut === "confirmed";
}

/**
 * « Aujourd'hui 14:32 », « Hier 09:15 », sinon « 12 août 09:15 ».
 *
 * Le gérant regarde ses commandes plusieurs fois par jour : une date absolue
 * l'oblige à calculer, un « il y a 3 heures » l'oblige à deviner l'heure.
 */
export function dateLisible(iso: string): string {
  const d = new Date(iso);
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const jour = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const aujourdhui = new Date();
  const zero = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const ecart = Math.round((zero.getTime() - jour.getTime()) / 86_400_000);

  if (ecart === 0) return `Aujourd'hui ${heure}`;
  if (ecart === 1) return `Hier ${heure}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ${heure}`;
}

export interface LigneCommande {
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
}

/** « Tacos x2, Burger x1 », tronqué au-delà de trois produits. */
export function resumeProduits(items: LigneCommande[]): string {
  if (!items?.length) return "—";
  const debut = items.slice(0, 3).map(i => `${i.name} x${i.quantity}`).join(", ");
  return items.length > 3 ? `${debut} +${items.length - 3}` : debut;
}
