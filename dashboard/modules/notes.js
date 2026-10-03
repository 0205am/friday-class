import { clampPosition } from "./core.js";
import {
  $,
  escapeHTML as esc,
  id,
  edit,
  textArea,
  confirmDelete,
} from "./ui.js";
export function setupNotes(ctx) {
  const board = $("#note-board");
  let drag;
  let activeId;
  function editor(note) {
    edit(
      note ? "메모 수정" : "메모 추가",
      textArea("메모 내용", "text", note?.text),
      (data) => {
        if (!data.text.trim()) return "메모를 입력해 주세요.";
        if (note) note.text = data.text;
        else
          ctx.state.notes.push({
            id: id(),
            text: data.text,
            x: (ctx.state.notes.length % 3) * 240,
            y: Math.floor(ctx.state.notes.length / 3) * 180,
            color: ["lilac", "blue", "yellow"][ctx.state.notes.length % 3],
          });
        ctx.save();
        render();
      },
    );
  }
  function position(note, node) {
    node.style.zIndex = note.id === activeId ? 2 : 1;
    const small = window.matchMedia("(max-width:700px)").matches;
    if (small) {
      node.style.left = "0px";
      node.style.top = `${ctx.state.notes.indexOf(note) * 190}px`;
    } else {
      const p = clampPosition(
        note.x,
        note.y,
        board.clientWidth,
        board.clientHeight,
        node.offsetWidth,
        node.offsetHeight,
      );
      node.style.left = p.x + "px";
      node.style.top = p.y + "px";
    }
  }
  function render() {
    board.style.setProperty(
      "--note-count",
      Math.max(1, ctx.state.notes.length),
    );
    board.style.minHeight =
      window.innerWidth > 700
        ? `${Math.max(240, ...ctx.state.notes.map((n) => n.y + 180))}px`
        : "";
    board.innerHTML = ctx.state.notes.length
      ? ctx.state.notes
          .map(
            (n) =>
              `<article class="note ${n.color}" data-note="${n.id}"><div class="note-top"><button class="grip" data-grip="${n.id}" aria-label="메모 이동: 방향키 사용">⠿</button><div><button data-edit="${n.id}" aria-label="메모 수정">수정</button><button data-delete="${n.id}" aria-label="메모 삭제">삭제</button></div></div><p>${esc(n.text)}</p></article>`,
          )
          .join("")
      : '<div class="empty">생각을 붙일 공간이에요.<br>메모를 추가해 보세요.</div>';
    ctx.state.notes.forEach((n) =>
      position(n, board.querySelector(`[data-note="${n.id}"]`)),
    );
  }
  window.addEventListener("resize", render);
  board.addEventListener("focusin", (e) => {
    const node = e.target.closest("[data-note]");
    if (!node) return;
    activeId = node.dataset.note;
    board
      .querySelectorAll(".note")
      .forEach((n) => (n.style.zIndex = n === node ? 2 : 1));
  });
  $("#add-note").onclick = () => editor();
  board.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const n = ctx.state.notes.find(
      (n) => n.id === (b.dataset.edit || b.dataset.delete),
    );
    if (b.dataset.edit) editor(n);
    if (b.dataset.delete)
      confirmDelete(() => {
        ctx.state.notes = ctx.state.notes.filter((v) => v.id !== n.id);
        ctx.save();
        render();
      });
  };
  board.onpointerdown = (e) => {
    const grip = e.target.closest("[data-grip]");
    if (!grip) return;
    const n = ctx.state.notes.find((n) => n.id === grip.dataset.grip);
    const node = grip.closest(".note");
    activeId = n.id;
    node.style.zIndex = 2;
    drag = {
      n,
      node,
      grip,
      startX: e.clientX,
      startY: e.clientY,
      x: parseFloat(node.style.left) || 0,
      y: parseFloat(node.style.top) || 0,
    };
    grip.setPointerCapture(e.pointerId);
  };
  board.onpointermove = (e) => {
    if (!drag) return;
    if (window.innerWidth <= 700) return;
    const p = clampPosition(
      drag.x + e.clientX - drag.startX,
      drag.y + e.clientY - drag.startY,
      board.clientWidth,
      board.clientHeight,
      drag.node.offsetWidth,
      drag.node.offsetHeight,
    );
    drag.node.style.left = p.x + "px";
    drag.node.style.top = p.y + "px";
    drag.n.x = p.x;
    drag.n.y = p.y;
  };
  const end = (e) => {
    if (!drag) return;
    if (window.innerWidth <= 700) {
      const from = ctx.state.notes.indexOf(drag.n);
      const to = Math.max(
        0,
        Math.min(
          ctx.state.notes.length - 1,
          from + Math.round((e.clientY - drag.startY) / 190),
        ),
      );
      const [note] = ctx.state.notes.splice(from, 1);
      ctx.state.notes.splice(to, 0, note);
    }
    ctx.save();
    drag = undefined;
    render();
  };
  board.onpointerup = end;
  board.onpointercancel = () => {
    drag = undefined;
    render();
  };
  board.onkeydown = (e) => {
    const b = e.target.closest("[data-grip]");
    if (
      !b ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    const n = ctx.state.notes.find((n) => n.id === b.dataset.grip);
    if (window.innerWidth <= 700) {
      const i = ctx.state.notes.indexOf(n),
        next = Math.max(
          0,
          Math.min(
            ctx.state.notes.length - 1,
            i + (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1),
          ),
        );
      ctx.state.notes.splice(i, 1);
      ctx.state.notes.splice(next, 0, n);
    } else {
      const node = b.closest(".note"),
        p = clampPosition(
          n.x + (e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0),
          n.y + (e.key === "ArrowUp" ? -16 : e.key === "ArrowDown" ? 16 : 0),
          board.clientWidth,
          board.clientHeight,
          node.offsetWidth,
          node.offsetHeight,
        );
      Object.assign(n, p);
    }
    ctx.save();
    render();
    board.querySelector(`[data-grip="${n.id}"]`)?.focus();
  };
  new ResizeObserver(() =>
    ctx.state.notes.forEach((n) => {
      const node = board.querySelector(`[data-note="${n.id}"]`);
      if (node) position(n, node);
    }),
  ).observe(board);
  render();
  return { render };
}
