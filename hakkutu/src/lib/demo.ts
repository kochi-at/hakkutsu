import type { Appraisal } from '../../shared/schema';

// Deliberately fixed: demo mode never claims to analyze the submitted photo.
export const demoAppraisal: Appraisal = {
  name: '月喰らいの銀匙',
  rarity: 'SR',
  category: '儀式具',
  observedFeatures: ['銀色の光沢（サンプル）', '湾曲した柄（サンプル）', '浅いくぼみ（サンプル）'],
  lore: '千年前、夜を長引かせるために月をすくったとされる祭具。柄の歪みは、満月の重みに耐えた痕跡である。最後の所有者は名もなき料理人。王国が滅んだ夜も、彼の厨房だけは温かな光に包まれていたという。',
  ability: 'これで口にしたスープは、必ず「懐かしい味」がする。',
  drawback: '使用者は、誰の味だったのか思い出せなくなる。',
  rarityReason: '月に触れる力を宿す一方、大切な記憶を代償とする希少な儀式具。',
  appraiserComment: '食洗機への投入は、月神への宣戦布告にあたります。',
};
