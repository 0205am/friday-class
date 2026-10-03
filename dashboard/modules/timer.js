import { remainingSeconds } from "./core.js";
import { $, announce } from "./ui.js";
export function setupTimer() {
  let mode = "집중",
    seconds = 0,
    deadline = 0,
    running = false,
    paused = false;
  const focus = $("#focus-min"),
    rest = $("#break-min");
  const paint = () => {
    $("#timer-mode").textContent = mode;
    $("#timer-display").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    $("#timer-pause").disabled = !running;
    focus.disabled = rest.disabled = running || paused;
    $("#timer-start").disabled = running;
  };
  const valid = () =>
    [focus, rest].every(
      (input) =>
        Number(input.value) >= 0.1 &&
        Number(input.value) <= 240 &&
        input.validity.valid,
    );
  $("#timer-start").onclick = () => {
    if (!valid()) {
      $("#timer-message").textContent =
        "집중·휴식 시간을 0.1~240분으로 설정해 주세요.";
      return;
    }
    if (!paused)
      seconds = Math.round(
        Number(mode === "집중" ? focus.value : rest.value) * 60,
      );
    deadline = Date.now() + seconds * 1000;
    running = true;
    paused = false;
    $("#timer-message").textContent = `${mode} 중입니다.`;
    paint();
  };
  $("#timer-pause").onclick = () => {
    seconds = remainingSeconds(deadline);
    running = false;
    paused = true;
    $("#timer-message").textContent =
      "일시정지했습니다. 시작을 눌러 이어가세요.";
    paint();
  };
  $("#timer-reset").onclick = () => {
    running = false;
    paused = false;
    seconds = 0;
    mode = "집중";
    $("#timer-message").textContent =
      "초기화했습니다. 시간을 설정하고 시작하세요.";
    paint();
  };
  const tick = () => {
    if (!running) return;
    seconds = remainingSeconds(deadline);
    if (seconds === 0) {
      running = false;
      paused = false;
      const ended = mode;
      mode = mode === "집중" ? "휴식" : "집중";
      $("#timer-message").textContent =
        `${ended} 시간이 끝났어요. ${mode}은 시작 버튼을 눌러 시작하세요.`;
      announce($("#timer-message").textContent);
    }
    paint();
  };
  setInterval(tick, 250);
  document.addEventListener("visibilitychange", tick);
  paint();
}
