import { getSupabasePublicServer } from "@/lib/supabase-server";

/**
 * Données de la page d'accueil, lues côté serveur avec la clé anon.
 *
 * Toutes les fonctions de ce module renvoient un tableau vide plutôt que de
 * lever une erreur : une panne Supabase ou une variable d'environnement
 * manquante doit dégrader la landing, jamais la faire tomber en page blanche.
 */

export interface BanniereLanding {
  id: string;
  titre: string | null;
  sous_titre: string | null;
  image_url: string;
  lien_url: string | null;
  boutique_slug: string | null;
}

export interface BoutiqueLanding {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  ville: string | null;
  quartier: string | null;
  logo_url: string | null;
  is_featured: boolean;
}

export interface ProduitVedette {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  image_url: string | null;
  boutique_name: string;
  boutique_slug: string;
  boutique_whatsapp: string;
}

/**
 * Une requête qui échoue ne doit pas disparaître sans laisser de trace :
 * c'est ce qui a rendu l'absence de bannières indétectable en production.
 * La landing dégrade toujours, mais la cause est désormais dans les logs.
 */
function signaler(quoi: string, error: { message: string } | null): void {
  if (error) console.error(`[landing] ${quoi} : ${error.message}`);
}

/**
 * PostgREST renvoie une relation « plusieurs-vers-un » tantôt comme objet,
 * tantôt comme tableau à un élément selon la façon dont la clé étrangère est
 * résolue. On normalise pour que l'appelant n'ait pas à s'en soucier.
 */
function unRelation<T>(valeur: unknown): T | null {
  if (Array.isArray(valeur)) return (valeur[0] as T) ?? null;
  return (valeur as T) ?? null;
}

/** Conditions de visibilité publique d'une boutique, alignées sur la RLS. */
const BOUTIQUE_PUBLIQUE = {
  status: "active",
  is_active: true,
  subscription_status: "active",
} as const;

export async function getBannieres(): Promise<BanniereLanding[]> {
  const supabase = getSupabasePublicServer();
  if (!supabase) return [];

  // Pas de jointure PostgREST ici, volontairement. Un `select` imbriqué
  // dépend du cache de relations de PostgREST : s'il ne résout pas la clé
  // étrangère, c'est TOUTE la requête qui échoue et le carrousel se retrouve
  // vide sans explication. Cette requête est donc exactement de la même
  // forme que celle de /admin/bannieres, qui fonctionne.
  const { data, error } = await supabase
    .from("bannieres_landing")
    .select("id, titre, sous_titre, image_url, lien_url, boutique_id")
    .eq("is_active", true)
    .order("ordre", { ascending: true });

  signaler("chargement des bannières", error);
  if (error || !data) return [];

  // Les slugs sont résolus à part : au pire, la bannière retombe sur
  // `lien_url` au lieu de faire tomber tout le carrousel.
  const ids = Array.from(
    new Set(data.map((b) => b.boutique_id as string | null).filter((v): v is string => Boolean(v))),
  );
  const slugs = new Map<string, string>();
  if (ids.length > 0) {
    const { data: liees, error: errSlugs } = await supabase
      .from("boutiques")
      .select("id, slug")
      .in("id", ids);
    signaler("résolution des boutiques liées aux bannières", errSlugs);
    for (const b of liees ?? []) slugs.set(b.id as string, b.slug as string);
  }

  return data.map((b) => ({
    id: b.id as string,
    titre: (b.titre as string | null) ?? null,
    sous_titre: (b.sous_titre as string | null) ?? null,
    image_url: (b.image_url as string | null) ?? "",
    lien_url: (b.lien_url as string | null) ?? null,
    // La boutique liée peut être invisible pour un visiteur (RLS) : dans ce
    // cas le slug reste absent et la bannière retombe sur `lien_url`.
    boutique_slug: slugs.get(b.boutique_id as string) ?? null,
  }));
}

export async function getBoutiques(): Promise<BoutiqueLanding[]> {
  const supabase = getSupabasePublicServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("boutiques")
    .select("id, name, slug, category, ville, quartier, logo_url, is_featured")
    .match(BOUTIQUE_PUBLIQUE)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  signaler("chargement des boutiques", error);
  if (error || !data) return [];
  return data as BoutiqueLanding[];
}

const CHAMPS_PRODUIT =
  "id, name, price, old_price, image_url, created_at, " +
  "boutique:boutiques!inner(name, slug, whatsapp_number, is_featured, status, is_active, subscription_status)";

/**
 * `CHAMPS_PRODUIT` étant une concaténation, TypeScript n'en voit qu'un
 * `string` : l'analyseur de type de supabase-js ne peut pas en déduire la
 * forme des lignes et retombe sur `GenericStringError`. On repasse donc par
 * une forme brute, que `versProduitVedette` valide champ par champ.
 */
function lignesBrutes(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

function versProduitVedette(p: Record<string, unknown>): ProduitVedette | null {
  const b = unRelation<{ name: string; slug: string; whatsapp_number: string }>(p.boutique);
  if (!b) return null;
  return {
    id: p.id as string,
    name: p.name as string,
    price: p.price as number,
    old_price: (p.old_price as number | null) ?? null,
    image_url: (p.image_url as string | null) ?? null,
    boutique_name: b.name,
    boutique_slug: b.slug,
    boutique_whatsapp: b.whatsapp_number,
  };
}

/**
 * Les 12 produits vedettes, boutiques mises en avant d'abord.
 *
 * En deux requêtes, et non une seule : PostgREST sait filtrer sur une table
 * jointe, mais son `order` sur une relation trie les lignes DANS la relation,
 * pas les lignes parentes. Trier les produits par `boutiques.is_featured`
 * exigerait donc une vue SQL. Deux requêtes bornées font le même travail de
 * façon exacte, sans objet supplémentaire à maintenir en base.
 */
export async function getProduitsVedettes(limite = 12): Promise<ProduitVedette[]> {
  const supabase = getSupabasePublicServer();
  if (!supabase) return [];

  const requete = (boutiqueEnVedette: boolean, n: number) =>
    supabase
      .from("products")
      .select(CHAMPS_PRODUIT)
      .eq("is_featured", true)
      .eq("is_available", true)
      .eq("boutique.status", BOUTIQUE_PUBLIQUE.status)
      .eq("boutique.is_active", BOUTIQUE_PUBLIQUE.is_active)
      .eq("boutique.subscription_status", BOUTIQUE_PUBLIQUE.subscription_status)
      .eq("boutique.is_featured", boutiqueEnVedette)
      .order("created_at", { ascending: false })
      .limit(n);

  const { data: prioritaires, error } = await requete(true, limite);
  signaler("chargement des produits vedettes", error);
  const vedettes = lignesBrutes(prioritaires)
    .map(versProduitVedette)
    .filter((p): p is ProduitVedette => p !== null);

  const reste = limite - vedettes.length;
  if (reste <= 0) return vedettes.slice(0, limite);

  const { data: autres } = await requete(false, reste);
  return [
    ...vedettes,
    ...lignesBrutes(autres).map(versProduitVedette).filter((p): p is ProduitVedette => p !== null),
  ].slice(0, limite);
}

/** Numéro WhatsApp au format attendu par wa.me : chiffres uniquement. */
export function numeroWhatsapp(brut: string): string {
  return brut.replace(/\D/g, "");
}

/** Lien de commande d'un produit, message déjà rédigé pour le client. */
export function lienCommandeProduit(p: ProduitVedette): string {
  const message = `Bonjour, je suis intéressé par ${p.name} chez ${p.boutique_name}`;
  return `https://wa.me/${numeroWhatsapp(p.boutique_whatsapp)}?text=${encodeURIComponent(message)}`;
}
