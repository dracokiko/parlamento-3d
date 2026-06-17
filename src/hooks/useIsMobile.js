import { useState, useEffect } from 'react';

const QUERY = '(max-width: 767px), (max-width: 1024px) and (orientation: portrait)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const fn = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', fn);
    return () => mql.removeEventListener('change', fn);
  }, []);
  return isMobile;
}