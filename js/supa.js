/**
 * public/js/supa.js
 * Minimal Supabase integration for a static site.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  console.error('[supa] Missing SUPABASE_URL / SUPABASE_ANON_KEY globals. Set them before loading supa.js')
}

export const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

/** Auth helpers **/
export async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

export async function requireUser(redirectTo = 'signin.html') {
  const user = await currentUser();
  if (!user) {
    if (redirectTo) location.href = redirectTo;
    throw new Error('Not signed in');
  }
  return user;
}

export async function signInOrSignUp(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { user: data.user };
  // If invalid login, try sign-up
  if (error.message && error.message.toLowerCase().includes('invalid')) {
    const reg = await supabase.auth.signUp({ email, password });
    if (reg.error) return { error: reg.error };
    return { user: reg.data.user };
  }
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Profiles **/
export async function loadProfile() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveProfile(payload) {
  const user = await requireUser();
  const row = { user_id: user.id, ...payload, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) throw error;
  return true;
}

/** History **/
export async function listHistory(limit = 200) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('histories')
    .select('id,date,food,trigger,severity,notes')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function addHistory({ date, food='', trigger='', severity='', notes='' }) {
  const user = await requireUser();
  if (!date) throw new Error('date is required (YYYY-MM-DD)')
  const { error } = await supabase.from('histories').insert([{
    user_id: user.id, date, food, trigger, severity, notes
  }]);
  if (error) throw error;
  return true;
}
