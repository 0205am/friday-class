export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const calendarDays = (year, month) => [
  ...Array(new Date(year, month, 1).getDay()).fill(null),
  ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) =>
    dateKey(new Date(year, month, i + 1)),
  ),
];
export const validateEvent = (e) =>
  !e.title.trim()
    ? "제목을 입력해 주세요."
    : !/^\d{4}-\d{2}-\d{2}$/.test(e.date)
      ? "날짜를 선택해 주세요."
      : !e.start || !e.end || e.start >= e.end
        ? "종료 시간은 시작 시간보다 늦어야 합니다."
        : "";
export function reorder(items, from, to) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length)
    return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
export const clampPosition = (x, y, w, h, nw, nh) => ({
  x: Math.max(0, Math.min(x, Math.max(0, w - nw))),
  y: Math.max(0, Math.min(y, Math.max(0, h - nh))),
});
export const remainingSeconds = (deadline, now = Date.now()) =>
  Math.max(0, Math.ceil((deadline - now) / 1000));
export function loadState(storage, fallback) {
  const raw = storage.getItem("personal-dashboard-v1");
  if (!raw) return fallback;
  const state = JSON.parse(raw);
  if (
    !["events", "todos", "notes", "mails"].every((key) =>
      Array.isArray(state[key]),
    )
  )
    throw Error("저장된 데이터 형식이 잘못되었습니다.");
  return state;
}
export const saveState = (storage, state) =>
  storage.setItem("personal-dashboard-v1", JSON.stringify(state));
