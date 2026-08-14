import { getSupabase } from "./supabase";
import type { UserRole } from "@/types";

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
