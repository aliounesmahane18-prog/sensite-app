-- ============================================
-- SENSITE-APP — Schéma Supabase complet
-- Ali.IA Solutions — Dakar, Sénégal
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE : profiles (liée à auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin', 'manager', 'employee')),
  boutique_id UUID, -- null pour super_admin
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : boutiques
-- ============================================
CREATE TABLE boutiques (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, -- URL unique ex: /boutique/mode-dakar
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('pret_a_porter', 'electromenager', 'bazar', 'quincaillerie', 'bijouterie', 'autre')),
  whatsapp_number TEXT NOT NULL, -- numéro WhatsApp du gérant
  logo_url TEXT,
  banner_url TEXT,
  address TEXT,
  quartier TEXT, -- ex: Medina, Plateau, Parcelles...
  -- Thème : 3 couleurs personnalisables depuis /dashboard/parametres
  color_primary TEXT DEFAULT '#F97316',   -- header, boutons
  color_secondary TEXT DEFAULT '#1C1917', -- footer, fonds
  color_accent TEXT DEFAULT '#EAB308',    -- badges, textes mis en avant
  theme_preset TEXT DEFAULT 'custom',     -- nom du préréglage choisi
  is_active BOOLEAN DEFAULT TRUE,
  -- Abonnement (géré manuellement par Ali)
  subscription_status TEXT DEFAULT 'pending' CHECK (subscription_status IN ('pending', 'active', 'suspended', 'cancelled')),
  subscription_start DATE,
  subscription_end DATE,
  monthly_price INTEGER DEFAULT 5000, -- en FCFA
  -- Méta
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : products
-- ============================================
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- en FCFA
  old_price INTEGER, -- prix barré (promo)
  image_url TEXT,
  image_urls TEXT[] DEFAULT '{}', -- images supplémentaires
  category TEXT, -- sous-catégorie libre
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE, -- mis en avant
  stock_quantity INTEGER, -- null = illimité
  has_variants BOOLEAN DEFAULT FALSE, -- taille, couleur...
  variants JSONB DEFAULT '[]'::jsonb, -- [{name, values: []}]
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : orders (commandes reçues via WhatsApp)
-- ============================================
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT NOT NULL, -- ex: SEN-00123
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  items JSONB NOT NULL, -- [{product_id, name, price, quantity}]
  total_amount INTEGER NOT NULL, -- en FCFA
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'processing', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : subscriptions_payments (historique paiements espèces)
-- ============================================
CREATE TABLE subscription_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL, -- en FCFA
  month_paid DATE NOT NULL, -- mois concerné
  payment_date DATE NOT NULL,
  received_by UUID REFERENCES profiles(id), -- super_admin qui a reçu
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_boutiques_slug ON boutiques(slug);
CREATE INDEX idx_boutiques_category ON boutiques(category);
CREATE INDEX idx_boutiques_active ON boutiques(is_active);
CREATE INDEX idx_products_boutique ON products(boutique_id);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_orders_boutique ON orders(boutique_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Profiles : chacun voit son profil
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Super admin voit tout
CREATE POLICY "superadmin_all_boutiques" ON boutiques FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "superadmin_all_products" ON products FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "superadmin_all_orders" ON orders FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "superadmin_all_payments" ON subscription_payments FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

-- Manager voit sa boutique
CREATE POLICY "manager_own_boutique" ON boutiques FOR SELECT
  USING ((SELECT boutique_id FROM profiles WHERE id = auth.uid()) = id);

-- Manager modifie sa boutique (logo, couleurs, infos) depuis /dashboard/parametres.
-- Sans cette politique, l'UPDATE ne touche AUCUNE ligne et ne lève AUCUNE erreur :
-- l'écran affiche « Sauvegardé ! » alors que rien n'est écrit.
CREATE POLICY "manager_update_own_boutique" ON boutiques FOR UPDATE TO authenticated
  USING ((SELECT boutique_id FROM profiles WHERE id = auth.uid()) = id)
  WITH CHECK ((SELECT boutique_id FROM profiles WHERE id = auth.uid()) = id);

-- Une politique UPDATE porte sur la ligne entière : sans garde-fou, un gérant
-- pourrait activer son propre abonnement et utiliser le service gratuitement.
-- Une policy RLS ne sait pas comparer OLD et NEW, d'où ce trigger.
-- Attention : dans une fonction SECURITY DEFINER, `current_user` vaut le
-- propriétaire de la fonction et non l'appelant — on lit donc le rôle dans les
-- claims JWT, qui sont propres à la requête entrante.
CREATE OR REPLACE FUNCTION public.protect_boutique_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  jwt_role text;
  caller_role text;
BEGIN
  jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';

  -- Pas de claims = accès SQL direct (éditeur Supabase, migrations) ; et les
  -- routes serveur utilisent la clé service role. Les deux gardent la main.
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'authenticated' THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role = 'super_admin' THEN
      RETURN NEW;
    END IF;
  END IF;

  NEW.slug                := OLD.slug;
  NEW.is_active           := OLD.is_active;
  NEW.subscription_status := OLD.subscription_status;
  NEW.subscription_start  := OLD.subscription_start;
  NEW.subscription_end    := OLD.subscription_end;
  NEW.monthly_price       := OLD.monthly_price;
  NEW.created_by          := OLD.created_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_boutiques_protect_admin_fields ON boutiques;
CREATE TRIGGER tr_boutiques_protect_admin_fields
  BEFORE UPDATE ON boutiques
  FOR EACH ROW EXECUTE FUNCTION public.protect_boutique_admin_fields();

CREATE POLICY "manager_own_products" ON products FOR ALL 
  USING ((SELECT boutique_id FROM profiles WHERE id = auth.uid()) = boutique_id);

CREATE POLICY "manager_own_orders" ON orders FOR ALL 
  USING ((SELECT boutique_id FROM profiles WHERE id = auth.uid()) = boutique_id);

-- Employee voit sa boutique (lecture seule)
CREATE POLICY "employee_view_products" ON products FOR SELECT 
  USING ((SELECT boutique_id FROM profiles WHERE id = auth.uid()) = boutique_id);

-- Page publique catalogue : tout le monde peut voir produits d'une boutique active
CREATE POLICY "public_view_products" ON products FOR SELECT USING (
  EXISTS (SELECT 1 FROM boutiques WHERE id = boutique_id AND is_active = TRUE AND subscription_status = 'active')
);

-- C'est CETTE politique qui applique le modèle économique : une boutique dont
-- l'abonnement n'est pas payé devient invisible via l'API, pas seulement dans
-- l'interface. Ne jamais la doubler d'une politique en USING (true) : ça
-- rendrait publiques les boutiques suspendues, avec leur monthly_price et leur
-- numéro WhatsApp.
CREATE POLICY "public_view_boutique" ON boutiques FOR SELECT USING (is_active = TRUE AND subscription_status = 'active');

-- ============================================
-- FONCTION : trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_boutiques_updated BEFORE UPDATE ON boutiques FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONNÉES INITIALES : super admin Ali
-- (à exécuter après avoir créé le compte dans Supabase Auth)
-- Remplacer 'VOTRE_UUID_AUTH' par l'UUID de ton compte
-- ============================================
-- INSERT INTO profiles (id, email, full_name, role)
-- VALUES ('VOTRE_UUID_AUTH', 'ali@aliia-solutions.com', 'Ali Alioune Gueye', 'super_admin');

-- ============================================
-- STORAGE : buckets pour images
-- ============================================
-- À créer dans Supabase Dashboard > Storage :
-- Bucket "boutique-logos" (public)
-- Bucket "product-images" (public)
-- Bucket "boutique-banners" (public)

-- ============================================
-- STORAGE : politiques RLS
-- ============================================
-- Indispensable : RLS est active sur storage.objects. Sans ces politiques,
-- AUCUN envoi de photo depuis le dashboard ne fonctionne (les buckets publics
-- n'autorisent que la LECTURE).
--
-- Un gérant n'écrit que dans le dossier portant l'id de sa boutique
-- (chemin : "<boutique_id>/<fichier>"), le super admin gère tous les buckets.

CREATE POLICY "product_images_insert_own_boutique"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "product_images_update_own_boutique"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "product_images_delete_own_boutique"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Logos : même principe. Ne JAMAIS créer ces politiques sans préciser
-- `TO authenticated` — une politique sans rôle s'applique à PUBLIC, donc à
-- `anon` : n'importe quel visiteur pourrait écraser le logo d'une boutique.
CREATE POLICY "boutique_logos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'boutique-logos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "boutique_logos_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'boutique-logos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'boutique-logos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "boutique_logos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'boutique-logos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "public_read_logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'boutique-logos');

CREATE POLICY "product_images_superadmin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id IN ('product-images', 'boutique-logos', 'boutique-banners')
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    bucket_id IN ('product-images', 'boutique-logos', 'boutique-banners')
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ============================================
-- NOTE : commandes (table `orders`)
-- ============================================
-- Les clients d'un catalogue ne sont pas authentifiés. Plutôt que d'ouvrir une
-- politique d'insertion au rôle `anon`, les commandes sont enregistrées par la
-- route serveur `POST /api/orders`, qui utilise la clé service role et
-- recalcule les prix depuis la base. Aucune politique `anon` n'est donc
-- nécessaire ici — et c'est volontaire.
