export function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('modal-confirm');
  const msg = document.getElementById('modal-confirm-message');
  const btnOk = document.getElementById('btn-confirm-ok');
  const btnCancel = document.getElementById('btn-confirm-cancel');
  if (!modal || !msg || !btnOk || !btnCancel) return;

  msg.textContent = message;
  modal.hidden = false;

  function close() {
    modal.hidden = true;
    btnOk.removeEventListener('click', confirm);
    btnCancel.removeEventListener('click', cancel);
  }
  function confirm() { close(); onConfirm(); }
  function cancel() { close(); }

  btnOk.addEventListener('click', confirm);
  btnCancel.addEventListener('click', cancel);
  modal.addEventListener('click', e => { if (e.target === modal) cancel(); }, { once: true });
}
