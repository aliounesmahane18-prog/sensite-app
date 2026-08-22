import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage, slugify } from "@/lib/utils";
import type { BoutiqueCategory } from "@/types";
import { CLES_SECTEURS } from "@/lib/secteurs";
import { creerCompteGerant, emailValide, verifierMotDePasse } from "@/lib/compte-gerant";

export const dynamic = "force-dynamic";

// Liste partagée avec les formulaires : une seule définition à faire évoluer,
// et elle est alignée sur la contrainte CHECK de la base.
const CATEGORIES = CLES_SECTEURS as BoutiqueCategory[];

/**
 * Crée une boutique complète : compte auth du gérant + boutique + profil lié.
 *
 * Tout se fait côté serveur avec la clé service role, pour deux raisons :
 * les règles RLS interdisent (à raison) au super admin d'insérer un profil
 * portant l'id d'un autre utilisateur, et la clé service role ne doit jamais
 * transiter par le navigateur.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if ("response" in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const whatsappNumber = String(payload.whatsapp_number ?? "").trim();
  const managerEmail = String(payload.manager_email ?? "").trim().toLowerCase();
  const managerName = String(payload.manager_name ?? "").trim();
  const quartier = String(payload.quartier ?? "").trim();
  const category = String(payload.category ?? "bazar") as BoutiqueCategory;
  const monthlyPrice = Number(payload.monthly_price ?? 5000);

  if (!name || !whatsappNumber || !managerEmail) {
    return NextResponse.json(
      { error: "Nom de la boutique, numéro WhatsApp et email du gérant sont obligatoires." },
      { status: 400 },
    );
  }
  if (!emailValide(managerEmail)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }
  // Mot de passe absent : la route en génère un, comme avant.
  const { motDePasse, erreur: erreurMdp } = verifierMotDePasse(payload.manager_password);
  if (erreurMdp) return NextResponse.json({ error: erreurMdp }, { status: 400 });
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Catégorie inconnue." }, { status: 400 });
  }
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return NextResponse.json({ error: "Prix mensuel invalide." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const slug = slugify(name) || `boutique-${Date.now()}`;

  const { data: existing } = await admin.from("boutiques").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `Une boutique utilise déjà l'adresse /boutique/${slug}. Choisis un autre nom.` },
      { status: 409 },
    );
  }

  const { data: boutique, error: boutiqueError } = await admin
    .from("boutiques")
    .insert({
      name,
      slug,
      category,
      whatsapp_number: whatsappNumber,
      quartier: quartier || null,
      monthly_price: Math.round(monthlyPrice),
      subscription_status: "pending",
      created_by: auth.userId,
      created_by_role: "super_admin",
    })
    .select()
    .single();
  if (boutiqueError || !boutique) {
    return NextResponse.json(
      { error: boutiqueError?.message ?? "Création de la boutique impossible." },
      { status: 400 },
    );
  }

  // Le compte gérant vient après la boutique : `profiles.boutique_id` a
  // besoin de son id. Si la création échoue (email déjà pris, par exemple),
  // la boutique est supprimée — sinon l'admin se retrouverait avec une
  // boutique vide et un slug pris.
  try {
    const compte = await creerCompteGerant({
      admin,
      email: managerEmail,
      motDePasse,
      nomComplet: managerName,
      boutiqueId: boutique.id as string,
    });

    return NextResponse.json({
      boutique: { id: boutique.id, name: boutique.name, slug: boutique.slug },
      manager: { email: compte.email, password: compte.motDePasse },
    });
  } catch (err) {
    await admin.from("boutiques").delete().eq("id", boutique.id);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
