// js/auth.js
import { supabase } from '/js/supa.js';

export function requireAuth(redirectTo='/index.html') {
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) window.location.replace(redirectTo);
  });
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, full_name, description }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, description },
      emailRedirectTo: `${window.location.origin}/home.html`
    }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
}

// BEFORE (what you likely have)
// await supabase.from('profiles').upsert({ id: user.id, ... }, { onConflict: 'id' })

export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const full_name = user.user_metadata?.full_name || null;
  const description = user.user_metadata?.description || null;

  // AFTER: note user_id + onConflict:'user_id'
  await supabase
    .from('profiles')
    .upsert({ user_id: user.id, full_name, description }, { onConflict: 'user_id' });
}
