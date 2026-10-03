export const $ = (selector) => document.querySelector(selector);
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const id = () => crypto.randomUUID();
let toastTimeout;
export function announce(message) {
  $("#status").textContent = message;
  $("#status").hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ($("#status").hidden = true), 6000);
}
export function openDialog(dialog) {
  dialog.showModal();
}
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
let submitEditor;
$("#editor-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const error = submitEditor(Object.fromEntries(new FormData(e.target)));
  $("#editor-error").textContent = error || "";
  if (!error) $("#editor").close();
});
export function edit(title, fields, submit) {
  $("#editor-title").textContent = title;
  $("#editor-fields").innerHTML = fields;
  $("#editor-error").textContent = "";
  submitEditor = submit;
  openDialog($("#editor"));
  $("#editor-fields input, #editor-fields textarea")?.focus();
}
let deleteAction;
export function confirmDelete(action) {
  deleteAction = action;
  openDialog($("#delete-dialog"));
}
$("#delete-confirm").addEventListener("click", () => {
  deleteAction();
  $("#delete-dialog").close();
  announce("삭제했습니다.");
});
export const textField = (label, name, value = "", type = "text") =>
  `<label>${label}<input name="${name}" type="${type}" value="${escapeHTML(value)}" required ${type === "text" ? 'maxlength="100"' : ""}></label>`;
export const textArea = (label, name, value = "") =>
  `<label>${label}<textarea name="${name}" maxlength="2000">${escapeHTML(value)}</textarea></label>`;
