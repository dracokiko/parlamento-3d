import { useState, useEffect } from 'react';

const MOBILE_QUERY          = '(max-width: 767px), (min-width: 768px) and (orientation: portrait)';
const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (orientation: portrait)';

function useMql(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const fn = (e) => setMatches(e.matches);
    mql.addEventListener('change', fn);
    return () => mql.removeEventListener('change', fn);
  }, [query]);
  return matches;
}

export function useIsMobile()        { return useMql(MOBILE_QUERY); }
export function useIsTabletPortrait() { return useMql(TABLET_PORTRAIT_QUERY); }
