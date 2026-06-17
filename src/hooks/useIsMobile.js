import { useState, useEffect } from 'react';

const QUERY = '(max-width: 767px), (min-width: 768px) and (orientation: portrait)';
const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (orientation: portrait)';
const TOUCH_QUERY = '(pointer: coarse)';

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

export function useIsTabletPortrait() {
  const [is, setIs] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(TABLET_PORTRAIT_QUERY).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(TABLET_PORTRAIT_QUERY);
    const fn = (e) => setIs(e.matches);
    mql.addEventListener('change', fn);
    return () => mql.removeEventListener('change', fn);
  }, []);
  return is;
}

export function useIsTouch() {
  const [is, setIs] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(TOUCH_QUERY).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(TOUCH_QUERY);
    const fn = (e) => setIs(e.matches);
    mql.addEventListener('change', fn);
    return () => mql.removeEventListener('change', fn);
  }, []);
  return is;
}