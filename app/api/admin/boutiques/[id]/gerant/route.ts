import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/utils";
import {
  changerMotDePasseGerant,
  creerCompteGerant,
  emailValide,
  messageErreurAuth,
  verifierMotDePasse,
} from "@/lib/compte-gerant";

export const dynamic = "force-dynamic";

/**
 * Compte de connexion du gérant, côté super admin.
 *
 * Même rôle que la route prospecteur, à deux différences près : l'admin agit
 * sur n'importe quelle boutique (pas de vérification d'appartenance), et il
 * peut aussi changer l'ADRESSE EMAIL — ce que le prospecteur ne peut pas
 * faire, une adresse étant l'identifiant de connexion.
 */
async function gerantDeLaBoutique(boutiqueId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id, email")
    .eq("boutique_id", boutiqueId)
    .eq("role", "manager")
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    const gerant = await gerantDeLaBoutique(params.id);
    return NextResponse.json({ gerant: gerant ? { email: gerant.email } : null });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}

/** Crée le compte quand la boutique n'en a pas encore. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin(request);
  if ("response" in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!emailValide(email)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }
  const { motDePasse, erreur } = verifierMotDePasse(payload.password);
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

  try {
    const admin = getSupabaseAdmin();

    const { data: boutique } = await admin
      .from("boutiques").select("id").eq("id", params.id).maybeSingle();
    if (!boutique) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    const existant = await gerantDeLaBoutique(params.id);
    if (existant) {
      return NextResponse.json(
        { error: `Cette boutique a déjà un compte gérant (${existant.email}).` },
        { status: 409 },
      );
    }

    const compte = await creerCompteGerant({
      admin,
      email,
      motDePasse,
      boutiqueId: params.id,
    });
    return NextResponse.json({ gerant: { email: compte.email, password: compte.motDePasse } });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}

/**
 * Modifie l'email et/ou le mot de passe. Les deux champs sont optionnels :
 * l'admin change souvent l'un sans toucher à l'autre.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin(request);
  if ("response" in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const emailBrut = String(payload.email ?? "").trim().toLowerCase();
  const { motDePasse, erreur } = verifierMotDePasse(payload.password);
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });
  if (emailBrut && !emailValide(emailBrut)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }
  if (!emailBrut && !motDePasse) {
    return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const gerant = await gerantDeLaBoutique(params.id);
    if (!gerant) {
      return NextResponse.json(
        { error: "Cette boutique n'a pas encore de compte gérant." },
        { status: 404 },
      );
    }
    const userId = gerant.id as string;

    if (motDePasse) await changerMotDePasseGerant(admin, userId, motDePasse);

    if (emailBrut && emailBrut !== gerant.email) {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email: emailBrut,
        // Sans cela, le gérant devrait confirmer la nouvelle adresse par
        // email pour pouvoir se reconnecter — or on ne lui en envoie aucun.
        email_confirm: true,
      });
      if (error) throw new Error(messageErreurAuth(error.message));

      // `profiles.email` est la copie lisible affichée dans l'interface :
      // la laisser sur l'ancienne adresse ferait mentir tous les écrans.
      const { error: erreurProfil } = await admin
        .from("profiles").update({ email: emailBrut }).eq("id", userId);
      if (erreurProfil) throw new Error(erreurProfil.message);
    }

    return NextResponse.json({ ok: true, email: emailBrut || gerant.email });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
