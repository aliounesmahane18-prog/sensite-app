/**
 * Secteurs d'activité des boutiques.
 *
 * Les clés doivent rester alignées sur la contrainte CHECK de
 * `boutiques.category` en base : toute valeur absente d'ici serait rejetée
 * par Postgres à l'insertion.
 */

export const SECTEURS: [string, string][] = [
  ["pret_a_porter", "Prêt-à-porter"],
  ["electromenager", "Électroménager"],
  ["bazar", "Bazar"],
  ["quincaillerie", "Quincaillerie"],
  ["bijouterie", "Bijouterie"],
  ["autre", "Autre"],
];

const LIBELLES = new Map(SECTEURS);

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
  autre: "bg-gray-100 text-gray-600",
};
