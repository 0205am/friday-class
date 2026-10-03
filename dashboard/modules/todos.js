import { reorder } from "./core.js";
import {
  $,
  escapeHTML as esc,
  id,
  edit,
  textField,
  confirmDelete,
} from "./ui.js";
export function setupTodos(ctx) {
  let dragging;
  function editor(todo) {
    edit(
      todo ? "할 일 수정" : "할 일 추가",
      textField("할 일", "text", todo?.text),
      (data) => {
        if (!data.text.trim()) return "할 일을 입력해 주세요.";
        if (todo) todo.text = data.text.trim();
        else
          ctx.state.todos.push({
            id: id(),
            text: data.text.trim(),
            done: false,
          });
        ctx.save();
        render();
      },
    );
  }
  function move(from, to) {
    ctx.state.todos = reorder(ctx.state.todos, from, to);
    ctx.save();
    render();
  }
  function render() {
    $("#todo-list").innerHTML = ctx.state.todos.length
      ? ctx.state.todos
          .map(
            (t, i) =>
              `<div class="todo-row ${t.done ? "done" : ""}" data-id="${t.id}"><button class="grip icon" draggable="true" data-drag="${i}" aria-label="${esc(t.text)} 이동 손잡이">⠿</button><label><input type="checkbox" data-check="${t.id}" ${t.done ? "checked" : ""}><span>${esc(t.text)}</span></label><div class="row-actions"><button data-edit="${t.id}" aria-label="${esc(t.text)} 할 일 수정">수정</button><button data-delete="${t.id}" aria-label="${esc(t.text)} 할 일 삭제">삭제</button><button data-move="${i}" data-to="${i - 1}" aria-label="${esc(t.text)} 위로" ${i === 0 ? "disabled" : ""}>↑</button><button data-move="${i}" data-to="${i + 1}" aria-label="${esc(t.text)} 아래로" ${i === ctx.state.todos.length - 1 ? "disabled" : ""}>↓</button></div></div>`,
          )
          .join("")
      : '<div class="empty">아직 할 일이 없어요.<br>첫 할 일을 추가해 보세요.</div>';
  }
  $("#add-todo").onclick = () => editor();
  $("#todo-list").onchange = (e) => {
    const t = ctx.state.todos.find((t) => t.id === e.target.dataset.check);
    if (t) {
      t.done = e.target.checked;
      ctx.save();
      render();
      $("#todo-list").querySelector(`[data-check="${t.id}"]`)?.focus();
    }
  };
  $("#todo-list").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const t = ctx.state.todos.find(
      (t) => t.id === (b.dataset.edit || b.dataset.delete),
    );
    if (b.dataset.edit) editor(t);
    if (b.dataset.delete)
      confirmDelete(() => {
        ctx.state.todos = ctx.state.todos.filter((v) => v.id !== t.id);
        ctx.save();
        render();
      });
    if (b.dataset.move !== undefined)
      move(Number(b.dataset.move), Number(b.dataset.to));
  };
  $("#todo-list").ondragstart = (e) => {
    const b = e.target.closest("[data-drag]");
    if (b) {
      dragging = Number(b.dataset.drag);
      e.dataTransfer.setData("text/plain", "todo");
    }
  };
  $("#todo-list").ondragover = (e) => e.preventDefault();
  $("#todo-list").ondrop = (e) => {
    e.preventDefault();
    const row = e.target.closest("[data-id]");
    if (row && dragging !== undefined)
      move(
        dragging,
        ctx.state.todos.findIndex((t) => t.id === row.dataset.id),
      );
    dragging = undefined;
  };
  $("#todo-list").ondragend = () => (dragging = undefined);
  render();
  return { render };
}
