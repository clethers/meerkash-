/** The one shared "floating glass chrome" treatment for surfaces that aren't
 * built from the `.card` primitive (the top nav bar and bottom dock — both
 * sit directly on the ambient backdrop, not inside page content). Kept as a
 * single constant so the two surfaces always match. */
export const GLASS_SURFACE =
  'border border-white/60 dark:border-white/10 bg-white/40 dark:bg-brand-950/50 ' +
  'backdrop-blur-lg backdrop-saturate-150 ' +
  'shadow-[0_8px_30px_rgba(31,41,55,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] ' +
  'dark:shadow-[0_8px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]';
