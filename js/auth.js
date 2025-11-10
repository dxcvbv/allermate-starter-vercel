// js/auth.js
import { supabase } from '/js/supa.js';

/** Redirect to `redirectTo` if there is no active session */
export function requireAuth(redirectTo = '/index.html') {
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) window.location.replace(redirectTo);
  });
}

/** Email+password sign-in */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Dedicated sign-up (keeps your email confirmation flow) */
export async function signUp({ email, password, full_name, description }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, description },
      emailRedirectTo: `${window.location.origin}/home.html`, // after confirming email
    },
  });
  if (error) throw error;
  return data;
}

/** Sign out and go back to landing */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
}

/** Ensure a row exists in public.profiles (your PK is user_id) */
export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const full_name = user.user_metadata?.full_name || null;
  const description = user.user_metadata?.description || null;

  await supabase
    .from('profiles')
    .upsert({ user_id: user.id, full_name, description }, { onConflict: 'user_id' });
}
