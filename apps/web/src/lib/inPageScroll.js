/**
 * Défilement fluide vers une ancre de la vitrine.
 * Courbe ease-in-out (plus naturelle que le saut natif).
 * Respecte `prefers-reduced-motion` (design system §5).
 */

/** @type {number} */
let activeAnimation = 0;

/** @returns {boolean} */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param {string | null | undefined} href
 * @returns {string | null} id sans `#`, ou null si ce n'est pas une ancre interne
 */
export function inPageAnchorId(href) {
  if (!href || href[0] !== '#') return null;
  const id = href.slice(1);
  return id.length > 0 ? id : null;
}

/**
 * Durée proportionnelle à la distance (sauts courts = plus vifs).
 * @param {number} distancePx
 * @returns {number}
 */
export function scrollDurationMs(distancePx) {
  const abs = Math.abs(distancePx);
  return Math.round(Math.min(920, Math.max(480, 380 + abs * 0.38)));
}

/**
 * Ease-in-out cubique — accélère puis ralentit à l’arrivée.
 * @param {number} t 0…1
 * @returns {number}
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * @param {HTMLElement} el
 * @returns {number}
 */
function targetScrollY(el) {
  const marginTop = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return window.scrollY + el.getBoundingClientRect().top - marginTop;
}

/**
 * @param {HTMLElement} el
 */
function focusTarget(el) {
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus({ preventScroll: true });
}

/**
 * @param {string} id
 */
export function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;

  if (activeAnimation) {
    cancelAnimationFrame(activeAnimation);
    activeAnimation = 0;
  }

  if (prefersReducedMotion()) {
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    focusTarget(target);
    return;
  }

  const startY = window.scrollY;
  const endY = Math.max(0, targetScrollY(target));
  const distance = endY - startY;
  if (Math.abs(distance) < 2) {
    focusTarget(target);
    return;
  }

  const duration = scrollDurationMs(distance);
  const startTime = performance.now();

  /** @param {number} now */
  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, startY + distance * easeInOutCubic(t));
    if (t < 1) {
      activeAnimation = requestAnimationFrame(step);
      return;
    }
    activeAnimation = 0;
    focusTarget(target);
  };

  activeAnimation = requestAnimationFrame(step);
}

/**
 * Intercepte un clic sur un lien `#section` pour éviter le saut brutal.
 * @param {import('react').MouseEvent<HTMLAnchorElement>} event
 */
export function onInPageAnchorClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const id = inPageAnchorId(event.currentTarget.getAttribute('href'));
  if (!id || !document.getElementById(id)) return;
  event.preventDefault();
  window.history.replaceState(null, '', `#${id}`);
  scrollToId(id);
}
