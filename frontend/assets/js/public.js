document.addEventListener('DOMContentLoaded', () => {
  marked.use({
    renderer: {
      link({ href, title, text }) {
        return `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`;
      },
    },
  });

  const el = document.getElementById('note-content');
  if (!el) return;
  const raw = JSON.parse(el.dataset.content);
  el.innerHTML = DOMPurify.sanitize(marked.parse(raw, { breaks: true }));
});
