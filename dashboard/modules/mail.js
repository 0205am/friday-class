import { $, escapeHTML as esc, openDialog, announce } from "./ui.js";
export function setupMail(ctx) {
  let selected = ctx.state.mails[0]?.id;
  function detail() {
    const mail = ctx.state.mails.find((m) => m.id === selected);
    $("#mail-detail").innerHTML = mail
      ? `<h3>${esc(mail.subject)}</h3><p class="helper">보낸 사람: ${esc(mail.from)} · 예시 메일</p><p>${esc(mail.body)}</p><label>답장 초안 (예시 · 수정 가능)<textarea id="mail-draft" maxlength="5000">${esc(mail.draft)}</textarea></label><button id="copy-draft" class="subtle">초안 복사</button>`
      : '<div class="empty">미회신 예시 메일이 없어요.</div>';
    if (!mail) return;
    $("#mail-draft").oninput = (e) => {
      mail.draft = e.target.value;
      ctx.save();
    };
    $("#copy-draft").onclick = async () => {
      try {
        await navigator.clipboard.writeText(mail.draft);
        announce("초안을 복사했습니다.");
      } catch {
        announce("복사할 수 없어요. 초안을 선택해 직접 복사해 주세요.");
        $("#mail-draft").select();
      }
    };
  }
  function render() {
    $("#mail-open").textContent =
      `✉ 미회신 ${ctx.state.mails.length}건 · ${ctx.state.mails[0]?.subject ?? "메일 없음"} · 초안 보기`;
    $("#mail-list").innerHTML = ctx.state.mails
      .map(
        (m) =>
          `<button data-mail="${m.id}" class="${m.id === selected ? "selected" : ""}">${esc(m.subject)}</button>`,
      )
      .join("");
    detail();
  }
  $("#mail-open").onclick = () => {
    render();
    openDialog($("#mail-dialog"));
  };
  $("#mail-list").onclick = (e) => {
    const b = e.target.closest("[data-mail]");
    if (b) {
      selected = b.dataset.mail;
      render();
    }
  };
  render();
  return { render };
}
