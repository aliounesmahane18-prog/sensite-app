import { getSupabase } from "./supabase";
import type { Prospecteur, UserRole } from "@/types";

export interface SessionProfile {
  id: string;
  email: string;
  role: UserRole;
  boutique_id: string | null;
}

/**
 * Profil de l'utilisateur connecté, ou `null` s'il n'y a pas de session.
 * Centralise le couple `auth.getUser()` + lecture de `profiles` utilisé par
 * toutes les pages protégées.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, role, boutique_id")
    .eq("id", user.id)
    .maybeSingle();

  return (data as SessionProfile | null) ?? null;
}

/**
 * Fiche prospecteur de l'utilisateur connecté, ou `null` s'il n'en est pas un.
 *
 * La politique RLS `prospecteur_own_profile` autorise la lecture même quand le
 * compte est suspendu : c'est ce qui permet d'afficher l'écran « en attente
 * d'activation » plutôt qu'une page vide.
 */
export async function getProspecteur(): Promise<Prospecteur | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("prospecteurs")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as Prospecteur | null) ?? null;
}

/** Route d'accueil correspondant au rôle, utilisée après connexion. */
export function homeForRole(role: UserRole): string {
  if (role === "super_admin") return "/admin";
  if (role === "prospecteur") return "/prospecteur";
  return "/dashboard";
}
