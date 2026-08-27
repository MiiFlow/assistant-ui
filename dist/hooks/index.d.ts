export { U as UseAutoScrollOptions, a as UseAutoScrollReturn, u as useAttachments, b as useAutoScroll, c as useBrandingCSSVars, d as useMessageComposer, e as useScrollLock, f as useStreaming } from '../use-branding-css-vars-CR2tjSV8.js';
import 'react';
import '../streaming-BfLEgW5u.js';
import '../branding-NieTEGQf.js';

/**
 * Whether the viewer has asked for reduced motion.
 *
 * The reasoning stream drives shimmer, a live meter and a blinking caret from
 * inline `animation` declarations, and a media query cannot override an inline
 * style — so the decision has to be made in JS and the effect simply not
 * applied. Starts `false` so server rendering and the first client paint agree.
 */
declare function usePrefersReducedMotion(): boolean;

export { usePrefersReducedMotion };
