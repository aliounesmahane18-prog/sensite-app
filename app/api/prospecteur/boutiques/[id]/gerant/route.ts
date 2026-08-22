import { NextResponse, type NextRequest } from "next/server";
import { requireProspecteurActif } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/utils";
import {
  changerMotDePasseGerant,
  creerCompteGerant,
  emailValide,
  LONGUEUR_MOT_DE_PASSE_MIN,
  verifierMotDePasse,
} from "@/lib/compte-gerant";

export const dynamic = "force-dynamic";

/**
 * Compte de connexion du gérant d'une boutique suivie par un prospecteur.
 *
 * POST   : crée le compte (email + mot de passe).
 * PATCH  : remplace le mot de passe.
 *
 * La clé service role contourne les règles RLS : l'appartenance de la
 * boutique au prospecteur est donc revérifiée explicitement à chaque appel.
 * Sans cette vérification, un prospecteur actif pourrait changer le mot de
 * passe du gérant de n'importe quelle boutique.
 */
async function boutiqueDuProspecteur(boutiqueId: string, prospecteurId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("boutiques")
    .select("id, name")
    .eq("id", boutiqueId)
    .eq("prospecteur_id", prospecteurId)
    .maybeSingle();
  return data;
}

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

/**
 * Compte gérant actuel de la boutique, ou `null` s'il n'y en a pas.
 *
 * Passe par le serveur parce que les règles RLS de `profiles` n'autorisent
 * pas un prospecteur à lire le profil d'un gérant.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProspecteurActif(request);
  if ("response" in auth) return auth.response;

  try {
    const boutique = await boutiqueDuProspecteur(params.id, auth.prospecteurId);
    if (!boutique) {
      return NextResponse.json(
        { error: "Cette boutique ne fait pas partie de tes boutiques." },
        { status: 403 },
      );
    }
    const gerant = await gerantDeLaBoutique(params.id);
    return NextResponse.json({ gerant: gerant ? { email: gerant.email } : null });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProspecteurActif(request);
  if ("response" in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const nomComplet = String(payload.full_name ?? "").trim();

  if (!emailValide(email)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }
  const { motDePasse, erreur } = verifierMotDePasse(payload.password);
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

  try {
    const boutique = await boutiqueDuProspecteur(params.id, auth.prospecteurId);
    if (!boutique) {
      return NextResponse.json(
        { error: "Cette boutique ne fait pas partie de tes boutiques." },
        { status: 403 },
      );
    }

    const existant = await gerantDeLaBoutique(params.id);
    if (existant) {
      return NextResponse.json(
        { error: `Cette boutique a déjà un compte gérant (${existant.email}).` },
        { status: 409 },
      );
    }

    const compte = await creerCompteGerant({
      admin: getSupabaseAdmin(),
      email,
      motDePasse,
      nomComplet,
      boutiqueId: params.id,
    });

    return NextResponse.json({
      gerant: { email: compte.email, password: compte.motDePasse },
    });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProspecteurActif(request);
  if ("response" in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const { motDePasse, erreur } = verifierMotDePasse(payload.password);
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });
  if (!motDePasse) {
    return NextResponse.json(
      { error: `Le mot de passe doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères` },
      { status: 400 },
    );
  }

  try {
    const boutique = await boutiqueDuProspecteur(params.id, auth.prospecteurId);
    if (!boutique) {
      return NextResponse.json(
        { error: "Cette boutique ne fait pas partie de tes boutiques." },
        { status: 403 },
      );
    }

    const gerant = await gerantDeLaBoutique(params.id);
    if (!gerant) {
      return NextResponse.json(
        { error: "Cette boutique n'a pas encore de compte gérant." },
        { status: 404 },
      );
    }

    await changerMotDePasseGerant(getSupabaseAdmin(), gerant.id as string, motDePasse);
    return NextResponse.json({ ok: true, email: gerant.email });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
