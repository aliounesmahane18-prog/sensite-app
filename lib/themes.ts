export interface BoutiqueTheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  preview: string[];
}

export const THEME_PRESETS: BoutiqueTheme[] = [
  { name: "Orange Dakar 🌅", primary: "#F97316", secondary: "#1C1917", accent: "#EAB308", preview: ["#F97316", "#1C1917", "#EAB308"] },
  { name: "Bleu Océan 🌊", primary: "#2563EB", secondary: "#0F172A", accent: "#38BDF8", preview: ["#2563EB", "#0F172A", "#38BDF8"] },
  { name: "Or Bijouterie 💍", primary: "#D97706", secondary: "#1C1917", accent: "#FDE68A", preview: ["#D97706", "#1C1917", "#FDE68A"] },
  { name: "Rose Mode 👗", primary: "#EC4899", secondary: "#1F1014", accent: "#F9A8D4", preview: ["#EC4899", "#1F1014", "#F9A8D4"] },
  { name: "Vert Nature 🌿", primary: "#16A34A", secondary: "#052E16", accent: "#86EFAC", preview: ["#16A34A", "#052E16", "#86EFAC"] },
  { name: "Violet Royal 👑", primary: "#7C3AED", secondary: "#1E1030", accent: "#C4B5FD", preview: ["#7C3AED", "#1E1030", "#C4B5FD"] },
  { name: "Rouge Passion ❤️", primary: "#DC2626", secondary: "#1C0A0A", accent: "#FCA5A5", preview: ["#DC2626", "#1C0A0A", "#FCA5A5"] },
  { name: "Gris Moderne 🏙️", primary: "#374151", secondary: "#111827", accent: "#9CA3AF", preview: ["#374151", "#111827", "#9CA3AF"] },
];

// Icônes par catégorie pour l'arrière-plan
export const CATEGORY_ICONS: Record<string, string[]> = {
  pret_a_porter: ["👗", "👠", "👜", "🧣", "👒", "💄", "🧥", "👟", "💅", "🕶️", "👛", "🧤"],
  electromenager: ["🏠", "❄️", "📺", "💡", "🔌", "🧺", "🍳", "🌀", "🔧", "📱", "💻", "🎵"],
  bazar: ["🛍️", "📦", "⭐", "🎁", "🪴", "🕯️", "🧴", "🪞", "🧹", "🪣", "🎨", "🖼️"],
  quincaillerie: ["🔧", "🔨", "⚙️", "🪛", "🔩", "🪚", "🔑", "🪝", "📏", "🧱", "🪜", "💡"],
  bijouterie: ["💍", "💎", "⭐", "✨", "🪙", "📿", "🏆", "👑", "🌟", "💫", "🔮", "🪬"],
  autre: ["📦", "⭐", "🎯", "🌟", "💫", "✨", "🎪", "🎨", "🎭", "🎬", "🎮", "🎲"],
};

export function getThemeCSS(primary: string, secondary: string, accent: string) {
  return `
    --color-primary: ${primary};
    --color-secondary: ${secondary};
    --color-accent: ${accent};
  `;
}
