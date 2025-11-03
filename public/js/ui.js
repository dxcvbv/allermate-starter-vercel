/* ui.js — small helpers */
export function setActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  for (const el of document.querySelectorAll('.topnav a, .sidebar .item, .tabbar a')) {
    const href = el.getAttribute('href');
    if (href && href.endsWith(path)) { el.classList.add('active'); el.setAttribute('aria-current','page'); }
  }
}
export function toast(msg, ms=1800){
  const el = document.querySelector('.toast') || (()=>{ const d=document.createElement('div'); d.className='toast'; document.body.appendChild(d); return d; })();
  el.textContent = msg; el.classList.add('show'); setTimeout(()=> el.classList.remove('show'), ms);
}
document.addEventListener('DOMContentLoaded', setActiveNav);
