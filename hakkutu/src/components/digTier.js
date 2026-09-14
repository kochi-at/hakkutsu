export function digTier(rarity) {
  if (rarity >= 4.5) return "国宝級";
  if (rarity >= 3.5) return "重要文化財級";
  if (rarity >= 2.5) return "貴重資料級";
  return "一般資料級";
}
