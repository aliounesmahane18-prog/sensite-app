export type UserRole = "super_admin" | "manager" | "employee";
export type BoutiqueCategory =
  | "pret_a_porter"
  | "electromenager"
  | "bazar"
  | "quincaillerie"
  | "bijouterie"
  | "autre";
export type SubscriptionStatus = "pending" | "active" | "suspended" | "cancelled";
export type OrderStatus = "new" | "confirmed" | "processing" | "delivered" | "cancelled";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  boutique_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Boutique {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: BoutiqueCategory;
  whatsapp_number: string;
  logo_url: string | null;
  banner_url: string | null;
  address: string | null;
  quartier: string | null;
  color_primary: string;
  is_active: boolean;
  subscription_status: SubscriptionStatus;
  subscription_start: string | null;
  subscription_end: string | null;
  monthly_price: number;
  created_at: string;
}

export interface Product {
  id: string;
  boutique_id: string;
  name: string;
  description: string | null;
  price: number;
  old_price: number | null;
  image_url: string | null;
  image_urls: string[];
  category: string | null;
  is_available: boolean;
  is_featured: boolean;
  stock_quantity: number | null;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  boutique_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  items: OrderItem[];
  total_amount: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
