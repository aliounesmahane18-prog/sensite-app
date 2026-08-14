# SENsite-APP 🛍️
**Boutiques en ligne + Commandes WhatsApp — Dakar, Sénégal**
*Développé par Ali.IA Solutions*

---

## 🎯 Concept

SaaS de vitrine catalogue en ligne pour boutiques informelles de Dakar.
- **Ali.IA Solutions** crée les comptes boutiques et perçoit l'abonnement mensuel en espèces
- **Gérant** gère ses produits et reçoit les commandes sur WhatsApp
- **Client** parcourt le catalogue et commande en 1 clic via WhatsApp

---

## 🏗️ Stack

| Couche | Outil |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Base de données + Auth | Supabase |
| Déploiement | Vercel |
| Style | Tailwind CSS |
| Panier | Zustand |

---

## 👥 Rôles utilisateurs

| Rôle | Accès |
|---|---|
| `super_admin` | Dashboard `/admin` — gère toutes les boutiques, crée les comptes |
| `manager` | Dashboard `/dashboard` — gère ses produits et voit ses commandes |
| `employee` | Dashboard `/dashboard` — lecture seule |

---

## 🚀 Installation

### 1. Cloner le projet
```bash
git clone https://github.com/[ton-username]/sensite-app.git
cd sensite-app
npm install
```

### 2. Supabase
1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor** et exécuter `supabase-schema.sql`
3. Créer les buckets Storage : `product-images`, `boutique-logos`, `boutique-banners` (tous publics)
4. Exécuter la section **STORAGE : politiques RLS** de `supabase-schema.sql`
   (sans elle, l'envoi de photos depuis le dashboard échoue : un bucket public
   n'autorise que la *lecture*)
5. Copier l'URL et les clés API : **Settings → API**

### 3. Variables d'environnement
```bash
cp .env.example .env.local
# Remplir avec tes clés Supabase
```

### 4. Créer le compte Super Admin Ali
Dans le dashboard Supabase → **Authentication → Users**, créer un utilisateur, puis dans **SQL Editor** :
```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES ('UUID_DU_COMPTE_AUTH', 'ali@aliia-solutions.com', 'Alioune Gueye', 'super_admin');
```

### 5. Lancer en local
```bash
npm run dev
# → http://localhost:3000
```

---

## 📦 Déploiement Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login

# Déployer
vercel --prod
```

Ajouter dans Vercel Dashboard → **Environment Variables** :

| Variable | Sensitive ? | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ❌ **non** | URL du projet, lue par le navigateur |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ **non** | Clé publique, protégée par RLS |
| `NEXT_PUBLIC_APP_URL` | ❌ non | `https://ton-app.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ oui | Clé secrète, serveur uniquement |

> ⚠️ **Ne coche pas « Sensitive » sur les variables `NEXT_PUBLIC_*`.**
> Une variable *Sensitive* n'est pas lisible pendant le build : Next.js ne peut
> donc pas l'injecter dans le bundle navigateur, et le client Supabase se
> retrouve sans clé (`supabaseKey is required`, page blanche).
>
> L'app se défend désormais contre ce cas : la config publique est aussi
> injectée à chaque requête par le serveur (`components/public-env-script.tsx`),
> et une page d'erreur explicite remplace la page blanche. Mais la bonne
> configuration reste de laisser ces variables non-Sensitive.

---

## 🩺 Page blanche sur `/login` ?

Ouvre la console du navigateur :

| Symptôme | Cause | Correctif |
|---|---|---|
| `supabaseKey is required` | Variables `NEXT_PUBLIC_*` absentes du bundle | Décocher « Sensitive » dans Vercel, puis **Redeploy** |
| Écran « Configuration incomplète » | Idem, détecté proprement par l'app | Idem |
| `new row violates row-level security policy` à l'envoi d'une photo | Politiques Storage manquantes | Exécuter la section STORAGE de `supabase-schema.sql` |

---

## 🗺️ Routes

| Route | Description |
|---|---|
| `/` | Page d'accueil publique |
| `/login` | Connexion |
| `/admin` | Dashboard Super Admin |
| `/admin/boutique/nouvelle` | Créer une boutique (compte gérant inclus) |
| `/dashboard` | Dashboard gérant/employé |
| `/dashboard/produits` | Gestion produits |
| `/dashboard/produits/nouveau` | Ajouter un produit |
| `/dashboard/produits/[id]/modifier` | Modifier un produit |
| `/dashboard/commandes` | Voir les commandes |
| `/boutique/[slug]` | **Page catalogue publique** (pour les clients) |

### Routes API

| Route | Accès | Rôle |
|---|---|---|
| `POST /api/admin/boutiques` | Super admin (`Authorization: Bearer <token>`) | Crée compte gérant + boutique + profil, renvoie le mot de passe généré |
| `POST /api/orders` | Public | Enregistre une commande ; recalcule les prix depuis la base |

Les deux utilisent la clé service role **côté serveur uniquement**
(`lib/supabase-admin.ts`), jamais depuis le navigateur.

---

## 💰 Modèle économique

- Paiement mensuel en **espèces** à Ali.IA Solutions
- Ali active manuellement l'abonnement dans le dashboard `/admin`
- Prix configurable par boutique (défaut : 5 000 FCFA/mois)
- Si pas payé → suspension → catalogue inaccessible aux clients

---

## ✅ Checklist lancement

### Supabase
- [ ] Créer le projet sur supabase.com
- [ ] Exécuter `supabase-schema.sql` dans SQL Editor
- [ ] Créer les 3 buckets Storage (publics)
- [ ] Copier URL + clés API

### Local
- [ ] `npm install`
- [ ] Créer `.env.local` avec les clés
- [ ] Créer le compte super_admin Ali
- [ ] `npm run dev` — tester

### GitHub
- [ ] `git init && git add . && git commit -m "feat: SENsite-APP initial"`
- [ ] Créer le repo et pousser

### Vercel
- [ ] Connecter le repo GitHub
- [ ] Ajouter les variables d'environnement
- [ ] `vercel --prod`

### Tests finaux
- [ ] ✅ Connexion super admin → `/admin`
- [ ] ✅ Créer une boutique test → noter le mot de passe affiché **une seule fois**
- [ ] ✅ Activer l'abonnement de la boutique (sinon le catalogue reste invisible)
- [ ] ✅ Connexion gérant → `/dashboard`
- [ ] ✅ Ajouter un produit avec photo
- [ ] ✅ Modifier puis masquer ce produit
- [ ] ✅ Ouvrir `/boutique/[slug]` → voir le catalogue
- [ ] ✅ Ajouter au panier → commander → WhatsApp s'ouvre
- [ ] ✅ La commande apparaît dans `/dashboard/commandes`
- [ ] ✅ Tester sur mobile Chrome

---

*Ali.IA Solutions — Dakar 🇸🇳*
