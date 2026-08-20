import { randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage, slugify } from "@/lib/utils";
import type { BoutiqueCategory } from "@/types";
import { CLES_SECTEURS } from "@/lib/secteurs";

export const dynamic = "force-dynamic";

// Liste partagée avec les formulaires : une seule définition à faire évoluer,
// et elle est alignée sur la contrainte CHECK de la base.
const CATEGORIES = CLES_SECTEURS as BoutiqueCategory[];

function generatePassword(): string {
  // Alphabet sans caractères ambigus (0/O, 1/l/I) : le mot de passe est
  // transmis oralement ou par WhatsApp au gérant.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const body = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `SEN-${body}!`;
}

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

  const password = generatePassword();
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: managerEmail,
    password,
    email_confirm: true,
  });
  if (userError || !created?.user) {
    return NextResponse.json(
      { error: userError?.message ?? "Impossible de créer le compte du gérant." },
      { status: 400 },
    );
  }
  const userId = created.user.id;

  // À partir d'ici, toute erreur doit supprimer le compte auth qu'on vient de
  // créer, sinon l'email reste pris et l'admin ne peut pas réessayer.
  try {
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
      throw new Error(boutiqueError?.message ?? "Création de la boutique impossible.");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      email: managerEmail,
      full_name: managerName || null,
      role: "manager",
      boutique_id: boutique.id,
    });
    if (profileError) {
      await admin.from("boutiques").delete().eq("id", boutique.id);
      throw new Error(profileError.message);
    }

    return NextResponse.json({
      boutique: { id: boutique.id, name: boutique.name, slug: boutique.slug },
      manager: { email: managerEmail, password },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
