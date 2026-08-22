import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LONGUEUR_MOT_DE_PASSE_MIN } from "./gerant-partage";

/**
 * Création et mise à jour du compte de connexion d'un gérant.
 *
 * Réservé au serveur : toutes ces opérations passent par la clé service role
 * (`admin.auth.admin.*`), qui ne doit jamais atteindre le navigateur.
 *
 * Le lien gérant ↔ boutique est porté par `profiles.boutique_id` avec
 * `role = 'manager'`. C'est déjà ce que lit /dashboard pour savoir quelle
 * boutique afficher : il n'existe volontairement pas de second lien qui
 * pourrait le contredire.
 */

export { LONGUEUR_MOT_DE_PASSE_MIN, emailMasque } from "./gerant-partage";

/** Mot de passe lisible, à dicter au téléphone ou à envoyer sur WhatsApp. */
export function genererMotDePasse(): string {
  // Alphabet sans caractères ambigus (0/O, 1/l/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const corps = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `SEN-${corps}!`;
}

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valide un mot de passe fourni par l'interface. `null` signifie « aucun
 * mot de passe choisi » : l'appelant en générera un.
 */
export function verifierMotDePasse(brut: unknown): { motDePasse: string | null; erreur?: string } {
  if (brut === undefined || brut === null || String(brut).trim() === "") {
    return { motDePasse: null };
  }
  const motDePasse = String(brut);
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN) {
    return {
      motDePasse: null,
      erreur: `Le mot de passe doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères`,
    };
  }
  return { motDePasse };
}

/**
 * Traduit les erreurs de Supabase Auth en messages utilisables.
 *
 * Le message brut (« A user with this email address has already been
 * registered ») est en anglais et ne dit pas quoi faire.
 */
export function messageErreurAuth(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("already been registered") || m.includes("already exists") || m.includes("duplicate")) {
    return "Cet email est déjà utilisé par un autre compte";
  }
  if (m.includes("password") && m.includes("least")) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères`;
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Adresse email invalide";
  }
  return brut;
}

interface Params {
  admin: SupabaseClient;
  email: string;
  motDePasse: string | null;
  nomComplet?: string | null;
  boutiqueId: string;
}

/**
 * Crée le compte auth du gérant et son profil, rattachés à la boutique.
 *
 * En cas d'échec après la création du compte auth, celui-ci est supprimé :
 * sinon l'email resterait pris et une nouvelle tentative échouerait sans
 * qu'on puisse rien y faire depuis l'interface.
 */
export async function creerCompteGerant({
  admin,
  email,
  motDePasse,
  nomComplet,
  boutiqueId,
}: Params): Promise<{ userId: string; email: string; motDePasse: string }> {
  const motDePasseFinal = motDePasse ?? genererMotDePasse();

  const { data: cree, error: erreurUser } = await admin.auth.admin.createUser({
    email,
    password: motDePasseFinal,
    // Sans cela, le gérant devrait valider un email avant de pouvoir se
    // connecter — or on ne lui envoie aucun email.
    email_confirm: true,
  });
  if (erreurUser || !cree?.user) {
    throw new Error(messageErreurAuth(erreurUser?.message ?? "Création du compte impossible."));
  }

  const userId = cree.user.id;
  const { error: erreurProfil } = await admin.from("profiles").insert({
    id: userId,
    email,
    full_name: nomComplet || null,
    role: "manager",
    boutique_id: boutiqueId,
  });

  if (erreurProfil) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(erreurProfil.message);
  }

  return { userId, email, motDePasse: motDePasseFinal };
}

/** Remplace le mot de passe d'un gérant existant. */
export async function changerMotDePasseGerant(
  admin: SupabaseClient,
  userId: string,
  motDePasse: string,
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, { password: motDePasse });
  if (error) throw new Error(messageErreurAuth(error.message));
}

