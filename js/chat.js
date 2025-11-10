// js/chat.js
import { supabase } from '/js/supa.js';
import { requireAuth, signOut, ensureProfile } from '/js/auth.js';

requireAuth();
document.getElementById('signOut')?.addEventListener('click', signOut);

const messagesEl = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('chatInput');
const typingEl = document.getElementById('typing');

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderBubble(role, text) {
  const div = document.createElement('div');
  div.className = `bubble ${role === 'user' ? 'user' : 'bot'}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

async function insertHistory(user_id, userText, botText) {
  const summary = `${userText.slice(0, 140)} → ${botText.slice(0, 160)}`;
  await supabase.from('histories').insert([{ user_id, type: 'chat', summary }]);
}

async function getContext() {
  const { data: { user } } = await supabase.auth.getUser();
  await ensureProfile();
  const { data: profile } = await supabase
    .from('profiles')
    .select('survey, full_name')
    .eq('user_id', user.id)
    .single();
  return {
    user_id: user.id,
    email: user.email,
    full_name: profile?.full_name || null,
    survey: profile?.survey || null
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  renderBubble('user', text);
  input.value = '';
  typingEl.style.display = 'inline';

  try {
    const ctx = await getContext();
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        context: {
          email: ctx.email,
          full_name: ctx.full_name,
          survey: ctx.survey
        }
      })
    });

    if (!res.ok) {
      const msg = `Chat API error: ${res.status}`;
      renderBubble('bot', msg);
      typingEl.style.display = 'none';
      return;
    }

    const data = await res.json();
    const reply = data.reply || data.message || 'Sorry, I did not receive a response.';
    renderBubble('bot', reply);
    typingEl.style.display = 'none';

    await insertHistory(ctx.user_id, text, reply);
  } catch (err) {
    typingEl.style.display = 'none';
    renderBubble('bot', 'Network error. Please try again.');
    console.error(err);
  }
});
