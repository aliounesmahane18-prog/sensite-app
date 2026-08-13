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
4. Copier l'URL et les clés API : **Settings → API**

### 3. Variables d'environnement
```bash
cp .env.local.example .env.local
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
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` = `https://ton-app.vercel.app`

---

## 🗺️ Routes

| Route | Description |
|---|---|
| `/` | Page d'accueil publique |
| `/login` | Connexion |
| `/admin` | Dashboard Super Admin |
| `/admin/boutique/nouvelle` | Créer une boutique |
| `/admin/boutique/[id]` | Gérer une boutique |
| `/dashboard` | Dashboard gérant/employé |
| `/dashboard/produits` | Gestion produits |
| `/dashboard/produits/nouveau` | Ajouter un produit |
| `/dashboard/commandes` | Voir les commandes |
| `/boutique/[slug]` | **Page catalogue publique** (pour les clients) |

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
- [ ] ✅ Créer une boutique test
- [ ] ✅ Connexion gérant → `/dashboard`
- [ ] ✅ Ajouter un produit avec photo
- [ ] ✅ Ouvrir `/boutique/[slug]` → voir le catalogue
- [ ] ✅ Ajouter au panier → commander → WhatsApp s'ouvre
- [ ] ✅ Tester sur mobile Chrome

---

*Ali.IA Solutions — Dakar 🇸🇳*
