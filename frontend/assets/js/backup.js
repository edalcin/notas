export function initBackup() {
  document.getElementById('btn-download-backup')?.addEventListener('click', downloadBackup);

  const fileInput = document.getElementById('restore-file-input');
  fileInput?.addEventListener('change', () => {
    const btn = document.getElementById('btn-restore');
    const label = document.getElementById('restore-file-label');
    if (!fileInput.files.length) return;
    const name = fileInput.files[0].name;
    if (label) label.textContent = `📄 ${name}`;
    if (btn) btn.hidden = false;
  });

  document.getElementById('btn-restore')?.addEventListener('click', restoreBackup);
}

async function downloadBackup() {
  const btn = document.getElementById('btn-download-backup');
  if (btn) { btn.disabled = true; btn.textContent = 'Preparando…'; }
  try {
    const res = await fetch('/api/backup');
    if (!res.ok) throw new Error('Falha ao gerar backup');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Erro ao baixar backup: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Baixar backup'; }
  }
}

async function restoreBackup() {
  const fileInput = document.getElementById('restore-file-input');
  if (!fileInput?.files.length) return;

  if (!confirm(
    'ATENÇÃO: Esta ação substituirá TODOS os dados atuais pelo arquivo de backup selecionado.\n\n' +
    'Esta operação não pode ser desfeita.\n\nDeseja continuar?'
  )) return;

  const btn = document.getElementById('btn-restore');
  if (btn) { btn.disabled = true; btn.textContent = 'Restaurando…'; }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('confirm', 'REPLACE');

  try {
    const res = await fetch('/api/restore', { method: 'POST', body: formData });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Falha no restore');
    }
    alert('Restore concluído com sucesso!\n\nA página será recarregada.');
    location.reload();
  } catch (err) {
    alert('Erro no restore: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Restaurar'; }
  }
}
