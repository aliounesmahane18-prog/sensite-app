"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { estEnAttente, type LigneCommande } from "@/lib/commandes";

export interface Commande {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items: LigneCommande[];
  total_amount: number;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Commandes d'une boutique, tenues à jour en direct.
 *
 * L'abonnement est filtré sur `boutique_id` côté serveur : sans ce filtre,
 * chaque boutique recevrait les événements de toutes les autres (les RLS
 * protègent la lecture initiale, pas le flux Realtime).
 *
 * `onNouvelle` est appelé pour chaque commande qui arrive pendant que la page
 * est ouverte — jamais au chargement initial.
 */
export function useCommandes(
  boutiqueId: string | null,
  onNouvelle?: (c: Commande) => void,
) {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  // Passer par une ref évite de réabonner le canal à chaque rendu du parent.
  const rappel = useRef(onNouvelle);
  rappel.current = onNouvelle;

  const charger = useCallback(async () => {
    if (!boutiqueId) return;
    const { data, error } = await getSupabase()
      .from("orders")
      .select("*")
      .eq("boutique_id", boutiqueId)
      .order("created_at", { ascending: false });
    if (error) setErreur(error.message);
    else setCommandes((data ?? []) as Commande[]);
    setChargement(false);
  }, [boutiqueId]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    if (!boutiqueId) return;
    const supabase = getSupabase();

    const canal = supabase
      .channel(`commandes-${boutiqueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `boutique_id=eq.${boutiqueId}` },
        payload => {
          const nouvelle = payload.new as Commande;
          setCommandes(prev =>
            // Une commande créée depuis cet onglet est déjà dans la liste :
            // sans ce test elle apparaîtrait en double.
            prev.some(c => c.id === nouvelle.id) ? prev : [nouvelle, ...prev],
          );
          rappel.current?.(nouvelle);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `boutique_id=eq.${boutiqueId}` },
        payload => {
          const maj = payload.new as Commande;
          setCommandes(prev => prev.map(c => (c.id === maj.id ? { ...c, ...maj } : c)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [boutiqueId]);

  const enAttente = commandes.filter(c => estEnAttente(c.status)).length;

  return { commandes, setCommandes, enAttente, chargement, erreur, setErreur, recharger: charger };
}

/**
 * Nombre de commandes en attente, pour la pastille de la barre latérale.
 *
 * Volontairement séparé de `useCommandes` : la barre latérale est montée sur
 * toutes les pages du tableau de bord et n'a pas besoin de charger les
 * commandes entières pour afficher un compteur.
 */
export function useCommandesEnAttente(boutiqueId: string | null): number {
  const [nombre, setNombre] = useState(0);

  const compter = useCallback(async () => {
    if (!boutiqueId) return;
    // On lit les identifiants plutôt que d'utiliser `count: "exact"` : le
    // comptage PostgREST passe par l'en-tête `content-range`, une dépendance
    // de plus pour un nombre qui reste petit — ce sont les commandes qu'il
    // reste à traiter, pas l'historique.
    const { data } = await getSupabase()
      .from("orders")
      .select("id")
      .eq("boutique_id", boutiqueId)
      .in("status", ["new", "confirmed"]);
    setNombre(data?.length ?? 0);
  }, [boutiqueId]);

  useEffect(() => {
    compter();
  }, [compter]);

  useEffect(() => {
    if (!boutiqueId) return;
    const supabase = getSupabase();
    // Un simple recomptage : plus court et plus sûr que de rejouer chaque
    // transition de statut à la main.
    const canal = supabase
      .channel(`compteur-commandes-${boutiqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `boutique_id=eq.${boutiqueId}` },
        () => compter(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [boutiqueId, compter]);

  return nombre;
}
