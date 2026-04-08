document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('note-content');
  if (!el) return;
  const raw = JSON.parse(el.dataset.content);
  el.innerHTML = DOMPurify.sanitize(marked.parse(raw, { breaks: true }));
});
