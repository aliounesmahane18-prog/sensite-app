import { create } from "zustand";
import { CartItem, Product } from "@/types";
interface CartStore {
  items: CartItem[];
  boutique_id: string | null;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}
export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  boutique_id: null,
  addItem: (product: Product) => {
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) return { items: state.items.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i), boutique_id: product.boutique_id };
      return { items: [...state.items, { product, quantity: 1 }], boutique_id: product.boutique_id };
    });
  },
  removeItem: (productId: string) => set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) })),
  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) { get().removeItem(productId); return; }
    set((state) => ({ items: state.items.map((i) => i.product.id === productId ? { ...i, quantity } : i) }));
  },
  clearCart: () => set({ items: [], boutique_id: null }),
  total: () => get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}));
