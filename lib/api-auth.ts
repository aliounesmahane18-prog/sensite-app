import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabase-admin";
import { getErrorMessage } from "./utils";

/**
 * Vérifie que l'appelant est bien le super admin.
 *
 * Le client envoie son jeton de session dans l'en-tête
 * `Authorization: Bearer <access_token>`. Sans cette vérification, n'importe
 * qui pourrait appeler les routes `/api/admin/*` qui utilisent la clé service
 * role et créer des comptes.
 */
export async function requireSuperAdmin(
  request: NextRequest,
): Promise<{ userId: string } | { response: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";

  if (!token) {
    return { response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  try {
    const admin = getSupabaseAdmin();

    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) {
      return { response: NextResponse.json({ error: "Session invalide ou expirée" }, { status: 401 }) };
    }

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "super_admin") {
      return { response: NextResponse.json({ error: "Accès réservé au super admin" }, { status: 403 }) };
    }

    return { userId: user.id };
  } catch (err) {
    // Typiquement SUPABASE_SERVICE_ROLE_KEY absente : sans ce filet, la route
    // renvoie un 500 vide et l'admin n'a aucune piste.
    return { response: NextResponse.json({ error: getErrorMessage(err) }, { status: 500 }) };
  }
}
