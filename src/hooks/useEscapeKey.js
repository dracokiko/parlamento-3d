import { useEffect } from 'react';

/** Chama onClose quando a tecla Escape é premida enquanto ativo=true. */
export function useEscapeKey(onClose, ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, ativo]);
}
