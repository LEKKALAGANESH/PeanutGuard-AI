/**
 * Disease label mapping for PeanutGuard classification models.
 *
 * The index order MUST match the model output logits exactly.
 * Index 0 = healthy, indices 1-18 = disease/disorder classes.
 */
export const DISEASE_LABELS: string[] = [
  'healthy',
  'early_leaf_spot',
  'late_leaf_spot',
  'rust',
  'white_mold',
  'aspergillus_aflatoxin',
  'web_blotch',
  'collar_rot',
  'rosette_virus',
  'bud_necrosis',
  'peanut_mottle',
  'bacterial_wilt',
  'root_knot_nematode',
  'iron_chlorosis',
  'nitrogen_deficiency',
  'calcium_deficiency',
  'boron_deficiency',
  'drought_stress',
  'herbicide_injury',
];

/** Total number of classification classes (healthy + 18 diseases/disorders). */
export const NUM_CLASSES = 19;
