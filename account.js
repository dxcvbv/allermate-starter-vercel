// js/account.js
import { supabase } from '/js/supa.js';
import { requireAuth, signOut } from '/js/auth.js';

requireAuth();
document.getElementById('signOut')?.addEventListener('click', signOut);

const emailEl = document.getElementById('email');
const fullNameEl = document.getElementById('fullName');
const descEl = document.getElementById('description');
const avatarEl = document.getElementById('avatar');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const dialog = document.getElementById('editDialog');
const editBtn = document.getElementById('editProfileBtn');
const editErr = document.getElementById('editError');

editBtn.addEventListener('click', () => dialog.showModal());
document.getElementById('saveProfile').addEventListener('click', async (e) => {
  e.preventDefault();
  editErr.style.display = 'none';
  try {
    const full_name = document.getElementById('edit_full_name').value.trim();
    const description = document.getElementById('edit_description').value.trim();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: uerr } = await supabase.auth.updateUser({ data: { full_name, description } });
    if (uerr) throw uerr;
    await supabase.from('profiles').upsert({ id: user.id, full_name, description }, { onConflict: 'id' });
    await hydrate();
    dialog.close();
  } catch (err) {
    editErr.textContent = err.message || String(err);
    editErr.style.display = 'block';
  }
});

document.getElementById('historyType').addEventListener('change', (e) => loadHistory(e.target.value));
document.getElementById('downloadCsv').addEventListener('click', downloadCsv);

async function hydrate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  emailEl.textContent = user.email;
  fullNameEl.textContent = user.user_metadata?.full_name || '—';
  descEl.textContent = user.user_metadata?.description || '—';
  avatarEl.textContent = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase();

  document.getElementById('edit_full_name').value = user.user_metadata?.full_name || '';
  document.getElementById('edit_description').value = user.user_metadata?.description || '';

  const { data: profile } = await supabase.from('profiles').select('survey').single();
  renderSurvey(profile?.survey);

  await loadHistory('');
}

function renderSurvey(survey) {
  const el = document.getElementById('surveyResults');
  if (!survey) { el.textContent = 'No survey on file yet.'; return; }
  const allergens = (survey.allergens || []).join(', ') || '—';
  const dietary = (survey.dietary || []).join(', ') || '—';
  el.innerHTML = `
    <div><strong>Allergens:</strong> ${allergens}</div>
    <div><strong>Dietary:</strong> ${dietary}</div>
  `;
}

async function loadHistory(type='') {
  let query = supabase.from('histories').select('id,type,summary,created_at').order('created_at', { ascending:false }).limit(50);
  if (type) query = query.eq('type', type);
  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    historyList.innerHTML = '';
    historyEmpty.style.display = 'block';
    return;
  }
  historyEmpty.style.display = 'none';
  historyList.innerHTML = rows.map(i => `
    <li class="row">
      <span class="muted">${new Date(i.created_at).toLocaleString()}</span>
      <strong class="tag">${i.type}</strong>
      <span>${i.summary || ''}</span>
    </li>
  `).join('');
}

async function downloadCsv() {
  const { data: rows } = await supabase.from('histories').select('created_at,type,summary').order('created_at', { ascending:false });
  const csv = ['created_at,type,summary', ...(rows||[]).map(r => `"${r.created_at}","${r.type}","${(r.summary||'').replace(/"/g,'""')}"`)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'allermate-history.csv' });
  a.click(); URL.revokeObjectURL(url);
}

hydrate();
