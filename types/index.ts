export type UserRole = "super_admin" | "manager" | "employee";
export type BoutiqueCategory = "pret_a_porter" | "electromenager" | "bazar" | "quincaillerie" | "bijouterie" | "autre";
export type SubscriptionStatus = "pending" | "active" | "suspended" | "cancelled";
export type OrderStatus = "new" | "confirmed" | "processing" | "delivered" | "cancelled";

export interface Product {
  id: string;
  boutique_id: string;
  name: string;
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

export interface CartItem {
  product: Product;
  quantity: number;
}
