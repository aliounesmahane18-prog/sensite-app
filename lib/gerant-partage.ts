/**
 * Règles du compte gérant partagées entre le serveur et le navigateur.
 *
 * Ce module ne dépend de rien — surtout pas de `node:crypto`, contrairement à
 * `lib/compte-gerant.ts` qui, lui, est réservé au serveur. Les composants
 * client importent ici, sinon le bundle navigateur embarquerait du code
 * Node et le build échouerait.
 */

export const LONGUEUR_MOT_DE_PASSE_MIN = 8;

/** `gerant@exemple.com` → `ge***@exemple.com`. */
export function emailMasque(email: string): string {
  const [avant, apres] = email.split("@");
  if (!apres) return email;
  const debut = avant.slice(0, 2);
  return `${debut}${"*".repeat(Math.max(3, avant.length - 2))}@${apres}`;
}
