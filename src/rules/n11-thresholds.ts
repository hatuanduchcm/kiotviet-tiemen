// Programmatic thresholds for the N11 rule (values in VND)
export const N11_THRESHOLDS: Record<string, number> = {
  // Main product categories (used by applyN11Rule)
  SUIT: 38_200_000,
  JACKET: 31_900_000,
  MANTO: 41_500_000,
  GILE: 10_600_000,
  QUAN: 10_000_000,
  SOMI: 12_100_000,
};

export default N11_THRESHOLDS;
