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
/** Utilisateur identifié par le jeton `Authorization: Bearer <access_token>`. */
async function utilisateurDuJeton(
  request: NextRequest,
): Promise<{ userId: string; role: string | null } | { response: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";

  if (!token) {
    return { response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user) {
    return { response: NextResponse.json({ error: "Session invalide ou expirée" }, { status: 401 }) };
  }

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { userId: user.id, role: profile?.role ?? null };
}

export async function requireSuperAdmin(
  request: NextRequest,
): Promise<{ userId: string } | { response: NextResponse }> {
  try {
    const auth = await utilisateurDuJeton(request);
    if ("response" in auth) return auth;

    if (auth.role !== "super_admin") {
      return { response: NextResponse.json({ error: "Accès réservé au super admin" }, { status: 403 }) };
    }
    return { userId: auth.userId };
  } catch (err) {
    // Typiquement SUPABASE_SERVICE_ROLE_KEY absente : sans ce filet, la route
    // renvoie un 500 vide et l'admin n'a aucune piste.
    return { response: NextResponse.json({ error: getErrorMessage(err) }, { status: 500 }) };
  }
}

/**
 * Vérifie que l'appelant est un prospecteur ACTIF et renvoie sa fiche.
 *
 * L'activation est revérifiée ici et pas seulement dans l'interface : ces
 * routes utilisent la clé service role, qui contourne les règles RLS. Un
 * prospecteur suspendu doit être arrêté côté serveur, sinon la suspension ne
 * vaut que pour l'affichage.
 */
export async function requireProspecteurActif(
  request: NextRequest,
): Promise<{ userId: string; prospecteurId: string } | { response: NextResponse }> {
  try {
    const auth = await utilisateurDuJeton(request);
    if ("response" in auth) return auth;

    if (auth.role !== "prospecteur") {
      return { response: NextResponse.json({ error: "Accès réservé aux prospecteurs" }, { status: 403 }) };
    }

    const admin = getSupabaseAdmin();
    const { data: fiche } = await admin
      .from("prospecteurs")
      .select("id, is_active")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (!fiche) {
      return { response: NextResponse.json({ error: "Fiche prospecteur introuvable" }, { status: 403 }) };
    }
    if (!fiche.is_active) {
      return {
        response: NextResponse.json(
          { error: "Ton compte prospecteur est suspendu. Contacte Ali.IA Solutions." },
          { status: 403 },
        ),
      };
    }

    return { userId: auth.userId, prospecteurId: fiche.id as string };
  } catch (err) {
    return { response: NextResponse.json({ error: getErrorMessage(err) }, { status: 500 }) };
  }
}
