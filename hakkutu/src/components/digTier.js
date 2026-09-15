export function digTier(rarity) {
  if (rarity >= 4.5) return "レジェンド";
  if (rarity >= 3.5) return "ゴールド";
  if (rarity >= 2.5) return "シルバー";
  if (rarity >= 1.5) return "ブロンズ";
  return "カス";
}
