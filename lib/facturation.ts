/**
 * Affichage de la facturation d'une boutique.
 *
 * Le montant mensuel est porté par `monthly_price` (colonne historique, déjà
 * utilisée par le calcul de revenu de /admin) : on évite volontairement une
 * seconde colonne montant, qui finirait par diverger.
 * Devise fixe : FCFA.
 */

export interface Facturation {
  monthly_price: number | null;
  date_prochain_paiement: string | null;
  notes_paiement: string | null;
  montant_modifie_par: string | null;
  montant_modifie_at: string | null;
}

/** `12 000 FCFA`, ou `null` quand le montant n'est pas défini (0 ou vide). */
export function montantLisible(montant: number | null | undefined): string | null {
  if (montant === null || montant === undefined || montant === 0) return null;
  return `${new Intl.NumberFormat("fr-FR").format(montant)} FCFA`;
}

export type UrgenceEcheance = "aucune" | "depassee" | "proche" | "ok";

export interface Echeance {
  urgence: UrgenceEcheance;
  label: string;
  className: string;
}

/**
 * Statut visuel de la date de prochain paiement :
 * rouge si dépassée, orange si dans moins de 7 jours, vert sinon.
 */
export function echeance(date: string | null | undefined): Echeance {
  if (!date) {
    return { urgence: "aucune", label: "Non définie", className: "bg-gray-100 text-gray-400" };
  }

  // Comparaison au jour près : une échéance « aujourd'hui » ne doit pas
  // basculer en retard à cause de l'heure.
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const cible = new Date(`${date}T00:00:00`);
  const jours = Math.round((cible.getTime() - aujourdhui.getTime()) / 86_400_000);
  const label = cible.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  if (jours < 0) return { urgence: "depassee", label, className: "bg-red-100 text-red-700" };
  if (jours <= 7) return { urgence: "proche", label, className: "bg-orange-100 text-orange-700" };
  return { urgence: "ok", label, className: "bg-green-100 text-green-700" };
}

/** « Saisi par le prospecteur » / « Modifié par l'admin le 12/08/2026 ». */
export function origineFacturation(f: Facturation): string | null {
  if (!f.montant_modifie_par) return null;
  if (f.montant_modifie_par === "prospecteur") return "Saisi par le prospecteur";
  const quand = f.montant_modifie_at
    ? ` le ${new Date(f.montant_modifie_at).toLocaleDateString("fr-FR")}`
    : "";
  return `Modifié par l'admin${quand}`;
}
