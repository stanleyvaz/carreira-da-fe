// Paleta de capas por tema (gradientes suaves, sem símbolos religiosos decorativos).
const P: Record<string, [string, string]> = {
  fe: ["#f2994a", "#c0562b"], oracao: ["#6d7bd6", "#3b3f8f"], perdao: ["#4fb3a9", "#237a74"], familia: ["#e87aa0", "#a7456f"],
  casamento: ["#d98aa8", "#8f4a72"], relacionamentos: ["#58a6d8", "#2c6896"], trabalho: ["#8fa86a", "#52703a"], sabedoria: ["#c9a24a", "#8a6a1f"],
  "dominio-proprio": ["#7f8fa6", "#46546a"], honestidade: ["#5fb28a", "#2f7a57"], generosidade: ["#e8935a", "#b0572b"], perseveranca: ["#a07ad6", "#5f3f9a"],
  "conhecimento-biblico": ["#c98a5a", "#7d4a26"], "personagens-biblicos": ["#b5875a", "#6e4a2a"], "ensinamentos-de-jesus": ["#d4a059", "#8f5e22"],
};
export function gradientFor(slug?: string | null) {
  const [a, b] = P[slug ?? ""] ?? ["#c99a63", "#7a5230"];
  return `linear-gradient(145deg, ${a}, ${b})`;
}
export const RING_COLORS = { reflections: "#f5a65b", steps: "#4ec3b5", activities: "#b99cf7" } as const;
