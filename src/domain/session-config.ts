// Product-tunable session settings in one place. Change the label keys
// (and ar/en strings) to rename the actions without touching screens.
export const SESSION_CONFIG = {
  /** Hard cap per session; setup blocks above it. Mirrored in firestore.rules (beneficiaryCount <= 100). */
  maxBeneficiaries: 100,
  /** Firestore `in` accepts at most 30 values, so area queries are chunked. */
  areaQueryChunk: 30,
  /** "تم" in Arabic. A check means "processed in this session", never "assistance delivered". */
  checkLabelKey: 'sessionLabels.check',
  ignoreLabelKey: 'sessionLabels.ignore',
} as const;
