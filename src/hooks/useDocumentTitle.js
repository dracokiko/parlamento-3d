import { useEffect } from 'react';

const SUFIXO = ' · Parlamento 3D';

/** Define o <title> da página enquanto o componente está montado. */
export function useDocumentTitle(titulo) {
  useEffect(() => {
    if (!titulo) return;
    const anterior = document.title;
    document.title = titulo + SUFIXO;
    return () => { document.title = anterior; };
  }, [titulo]);
}
