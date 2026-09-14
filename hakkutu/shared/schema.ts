import { z } from 'zod';

export const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR'] as const;
export const AppraisalSchema = z.object({
  name: z.string(),
  rarity: z.enum(RARITIES),
  category: z.string(),
  observedFeatures: z.array(z.string()),
  lore: z.string(),
  ability: z.string(),
  drawback: z.string(),
  rarityReason: z.string(),
  appraiserComment: z.string(),
}).strict();

export const ValidatedAppraisalSchema = AppraisalSchema.extend({
  name: z.string().min(1).max(60),
  category: z.string().min(1).max(30),
  observedFeatures: z.array(z.string().min(1).max(150)).min(1).max(5),
  lore: z.string().min(1).max(800),
  ability: z.string().min(1).max(250),
  drawback: z.string().min(1).max(250),
  rarityReason: z.string().min(1).max(250),
  appraiserComment: z.string().min(1).max(250),
});

export type Appraisal = z.infer<typeof AppraisalSchema>;
export type Mode = 'demo' | 'ai';
export type RelicRecord = {
  id: string;
  createdAt: string;
  mode: Mode;
  image: string;
  appraisal: Appraisal;
};

export const rarityNames: Record<Appraisal['rarity'], string> = {
  N: 'COMMON', R: 'RARE', SR: 'SUPER RARE', SSR: 'EPIC', UR: 'LEGENDARY',
};
