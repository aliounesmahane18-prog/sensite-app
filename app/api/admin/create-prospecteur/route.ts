import { randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

function generatePassword(): string {
  // Alphabet sans caractères ambigus (0/O, 1/l/I) : le mot de passe est souvent
  // relu à voix haute ou transmis par WhatsApp.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const body = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `SEN-${body}!`;
}

/**
 * Crée un compte prospecteur : utilisateur auth + profil + fiche prospecteur.
 *
 * Tout passe par la clé service role côté serveur : les règles RLS interdisent
 * (à raison) d'insérer un profil portant l'id d'un autre utilisateur, et cette
 * clé ne doit jamais atteindre le navigateur.
 *
 * Aucun email n'est envoyé : `auth.admin.createUser()` n'en envoie pas, et on
 * ne déclenche rien d'autre. Le mot de passe temporaire est renvoyé à l'admin
 * et affiché une seule fois, comme pour la création de boutique — le relais se
 * fait par WhatsApp, ce qui est plus fiable qu'un email à Dakar.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if ("response" in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const nom = String(payload.nom ?? "").trim();
  const prenom = String(payload.prenom ?? "").trim();
  const telephone = String(payload.telephone ?? "").trim();
  const ville = String(payload.ville ?? "").trim();
  const quartier = String(payload.quartier ?? "").trim();

  if (!email || !nom || !ville || !quartier) {
    return NextResponse.json(
      { error: "Email, nom, ville et quartier sont obligatoires." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const password = generatePassword();

  // 1. Compte auth
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !created?.user) {
    const message = userError?.message ?? "Impossible de créer le compte.";
    return NextResponse.json(
      {
        error: /already|exist/i.test(message)
          ? "Un compte existe déjà avec cette adresse email."
          : message,
      },
      { status: 400 },
    );
  }
  const userId = created.user.id;

  // À partir d'ici, toute erreur doit supprimer le compte auth : sinon l'email
  // reste pris et l'admin ne peut pas réessayer.
  try {
    // 2. Profil
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      email,
      full_name: [prenom, nom].filter(Boolean).join(" ") || nom,
      role: "prospecteur",
    });
    if (profileError) throw new Error(profileError.message);

    // 3. Fiche prospecteur — suspendue tant que l'admin ne l'active pas
    const { data: prospecteur, error: prospError } = await admin
      .from("prospecteurs")
      .insert({
        user_id: userId,
        nom,
        prenom: prenom || null,
        telephone: telephone || null,
        ville,
        quartier,
        is_active: false,
        created_by: auth.userId,
      })
      .select("*")
      .single();
    if (prospError || !prospecteur) {
      await admin.from("profiles").delete().eq("id", userId);
      throw new Error(prospError?.message ?? "Création de la fiche prospecteur impossible.");
    }

    return NextResponse.json({
      prospecteur,
      compte: { email, password },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
