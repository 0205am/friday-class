import { dateKey, loadState, saveState } from "./modules/core.js";
import { announce } from "./modules/ui.js";
import { setupSchedule } from "./modules/schedule.js";
import { setupTodos } from "./modules/todos.js";
import { setupNotes } from "./modules/notes.js";
import { setupMail } from "./modules/mail.js";
import { setupTimer } from "./modules/timer.js";
import { setupGoogle } from "./modules/google.js";
const today = dateKey();
const sample = {
  events: [
    {
      id: "e1",
      title: "하루 계획",
      date: today,
      start: "09:30",
      end: "10:30",
      memo: "예시 일정",
    },
    {
      id: "e2",
      title: "예시 미팅",
      date: today,
      start: "11:00",
      end: "12:00",
      memo: "예시 일정",
    },
    {
      id: "e3",
      title: "개인 작업",
      date: today,
      start: "15:00",
      end: "16:30",
      memo: "예시 일정",
    },
  ],
  todos: [
    { id: "t1", text: "오늘 할 일 정리", done: false },
    { id: "t2", text: "아이디어 메모", done: false },
    { id: "t3", text: "일정 확인", done: false },
  ],
  notes: [
    {
      id: "n1",
      text: "오늘의 아이디어\n생각을 자유롭게 적어 보세요.",
      x: 20,
      y: 20,
      color: "lilac",
    },
    {
      id: "n2",
      text: "다음에 할 것\n이번 주 계획 정리",
      x: 280,
      y: 20,
      color: "blue",
    },
    {
      id: "n3",
      text: "기억할 메모\n작은 아이디어도 남겨두기",
      x: 540,
      y: 20,
      color: "yellow",
    },
  ],
  mails: [
    {
      id: "m1",
      subject: "예시 일정 확인 요청",
      from: "sample@example.com",
      body: "안녕하세요.\n다음 주 예시 미팅 가능 시간을 확인 부탁드립니다.",
      draft: "안녕하세요. 일정 확인 후 회신드리겠습니다.",
    },
    {
      id: "m2",
      subject: "예시 자료 검토 요청",
      from: "demo@example.com",
      body: "예시 자료에 대한 의견을 부탁드립니다.",
      draft: "안녕하세요. 자료를 검토한 뒤 의견을 전달드리겠습니다.",
    },
  ],
};
const emptyPreview =
  new URLSearchParams(location.search).get("state") === "empty";
let state = structuredClone(sample);
try {
  state = emptyPreview
    ? { events: [], todos: [], notes: [], mails: [] }
    : loadState(localStorage, state);
} catch {
  announce(
    "저장된 내용을 불러올 수 없어 예시 데이터를 표시합니다. 기존 저장 내용은 그대로 둡니다.",
  );
}
const ctx = {
  state,
  save() {
    if (emptyPreview) {
      announce("빈 상태 미리보기에서는 변경 내용을 저장하지 않습니다.");
      return;
    }
    try {
      saveState(localStorage, this.state);
    } catch {
      announce(
        "저장할 수 없어요. 현재 화면에는 반영되지만 다시 열면 유지되지 않을 수 있습니다.",
      );
    }
  },
};
const schedule = setupSchedule(ctx);
setupTodos(ctx);
setupNotes(ctx);
setupMail(ctx);
setupTimer();
if (!emptyPreview) void setupGoogle(ctx, schedule);
else
  document.querySelector("#google-status").textContent =
    "빈 상태 미리보기 · Google 연결 제외";
if (emptyPreview)
  announce("빈 상태 미리보기입니다. 원래 저장 내용은 바뀌지 않습니다.");
