/**
 * Secteurs d'activité des boutiques — source unique.
 *
 * Les clés doivent rester alignées sur la contrainte CHECK de
 * `boutiques.category` en base : toute valeur absente de la contrainte serait
 * rejetée par Postgres à l'insertion, même si l'option apparaît dans le
 * formulaire. Ajouter un secteur ici implique donc une migration SQL.
 *
 * Tout ce qui affiche ou valide un secteur part d'ici : formulaire de contact
 * de la page d'accueil, création de boutique (admin et prospecteur), route
 * API de création, cartes de la landing.
 */

export const SECTEURS = [
  ["pret_a_porter", "Prêt-à-porter"],
  ["electromenager", "Électroménager"],
  ["bazar", "Bazar"],
  ["quincaillerie", "Quincaillerie"],
  ["bijouterie", "Bijouterie"],
  ["restaurant", "Restaurant"],
  ["textile", "Textile"],
  ["digital", "Digital"],
  ["autre", "Autre"],
] as const;

/**
 * Type dérivé de la liste ci-dessus — le `as const` sert à ça. Ajouter un
 * secteur dans SECTEURS l'ajoute automatiquement au type : impossible que
 * les deux divergent.
 */
export type CleSecteur = (typeof SECTEURS)[number][0];

/** Les clés seules, pour valider une saisie côté serveur. */
export const CLES_SECTEURS: CleSecteur[] = SECTEURS.map(([cle]) => cle);

// Typée sur `string` et non sur CleSecteur : on interroge cette table avec
// une valeur venue de la base, qui peut être n'importe quoi.
const LIBELLES = new Map<string, string>(SECTEURS);

/** Libellé lisible d'un secteur, ou la clé brute si elle est inconnue. */
export function libelleSecteur(cle: string | null): string {
  if (!cle) return "Autre";
  return LIBELLES.get(cle) ?? cle;
}

/**
 * Couleur du badge secteur sur la landing. Une teinte par secteur : le
 * visiteur repère un rayon du centre commercial à la couleur.
 */
export const COULEUR_SECTEUR: Record<string, string> = {
  pret_a_porter: "bg-pink-100 text-pink-700",
  electromenager: "bg-blue-100 text-blue-700",
  bazar: "bg-amber-100 text-amber-700",
  quincaillerie: "bg-slate-100 text-slate-700",
  bijouterie: "bg-yellow-100 text-yellow-800",
  restaurant: "bg-red-100 text-red-700",
  textile: "bg-purple-100 text-purple-700",
  digital: "bg-cyan-100 text-cyan-700",
  autre: "bg-gray-100 text-gray-600",
};
