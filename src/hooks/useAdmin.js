import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAdmin() {
  const [session, setSession] = useState(undefined); // undefined = a carregar

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function entrar(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  return {
    session,
    loading: session === undefined,
    autenticado: !!session,
    entrar,
    sair,
  };
}
