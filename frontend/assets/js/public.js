document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('note-content');
  if (!el) return;
  const raw = JSON.parse(el.dataset.content);
  el.innerHTML = DOMPurify.sanitize(marked.parse(raw, { breaks: true }));
  el.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
});
