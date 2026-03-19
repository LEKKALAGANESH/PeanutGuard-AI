'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport matches the given media query.
 * Defaults to false during SSR to avoid hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** True when viewport is >= 1024px (Tailwind `lg`). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
