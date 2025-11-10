// js/home.js
import { supabase } from '/js/supa.js';
import { requireAuth, signOut, ensureProfile } from '/js/auth.js';

requireAuth();
document.getElementById('signOut')?.addEventListener('click', signOut);

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  await ensureProfile();
  const first = (user?.user_metadata?.full_name || 'there').split(' ')[0];
  document.getElementById('greetingName').textContent = first;

  const { data: rows, error } = await supabase
    .from('histories')
    .select('id,type,summary,created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const list = document.getElementById('recentList');
  const empty = document.getElementById('recentEmpty');

  if (error || !rows || rows.length === 0) {
    empty.style.display = 'block';
    return;
  }

  list.innerHTML = rows.map(i => `
    <li class="row">
      <span class="muted">${new Date(i.created_at).toLocaleString()}</span>
      <strong class="tag">${i.type}</strong>
      <span>${i.summary || ''}</span>
    </li>
  `).join('');
})();
