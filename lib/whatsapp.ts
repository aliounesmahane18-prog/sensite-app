/**
 * Utilitaires WhatsApp, utilisables côté serveur comme côté navigateur.
 *
 * Ce module ne dépend de rien : c'est volontaire. Il est importé par des
 * composants client, et `lib/landing.ts` — qui crée un client Supabase —
 * n'a rien à faire dans le bundle du navigateur.
 */

/**
 * Numéro de contact SENsite-APP utilisé quand `NEXT_PUBLIC_WHATSAPP_CONTACT`
 * n'est pas définie dans l'environnement.
 *
 * Ce n'est pas une valeur de test : c'est le vrai numéro de contact, en dur,
 * pour que le formulaire de la page d'accueil fonctionne même sur un
 * déploiement où la variable n'a pas encore été renseignée. La variable
 * d'environnement reste prioritaire, elle permet d'en changer sans toucher
 * au code.
 */
export const WHATSAPP_CONTACT_DEFAUT = "221777777357";

/** Numéro au format attendu par wa.me : chiffres uniquement. */
export function numeroWhatsapp(brut: string): string {
  return brut.replace(/\D/g, "");
}

/** Numéro de contact effectif : la variable d'environnement, sinon le défaut. */
export function contactWhatsapp(depuisEnv: string): string {
  return numeroWhatsapp(depuisEnv) || WHATSAPP_CONTACT_DEFAUT;
}
