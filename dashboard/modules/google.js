import { $, escapeHTML as esc, announce } from "./ui.js";
export function renderGoogleCalendar(model) {
  if (model.loading)
    return '<div class="empty" role="status">기본 캘린더를 불러오는 중이에요.</div>';
  if (model.error)
    return `<div class="empty" role="status">${esc(model.error)}</div>`;
  if (!model.events.length)
    return '<div class="empty">기본 캘린더에 이날 일정이 없어요.</div>';
  const time = (value) =>
    new Date(value).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `<div class="live-agenda">${model.events.map((e) => `<article class="live-event"><span class="event-time">${e.allDay ? "종일" : esc(time(e.start)) + " – " + esc(time(e.end))}</span><strong>${esc(e.title)}</strong></article>`).join("")}</div>`;
}
export async function setupGoogle(ctx, schedule) {
  let configured = false,
    connected = false,
    request = 0;
  const status = $("#google-status"),
    connect = $("#google-connect"),
    view = $("#google-calendar"),
    example = $("#google-example"),
    disconnect = $("#google-disconnect");
  const controls = () => {
    connect.disabled = !configured;
    view.hidden = !connected;
    disconnect.hidden = !connected;
    example.hidden = !ctx.liveCalendar;
    view.textContent = ctx.liveCalendar ? "일정 새로고침" : "기본 캘린더 보기";
  };
  async function load(date) {
    const sequence = ++request;
    ctx.liveCalendar = { loading: true, events: [] };
    controls();
    schedule.render();
    try {
      const response = await fetch(
        "/api/google/calendar?date=" + encodeURIComponent(date),
        { cache: "no-store" },
      );
      const data = await response.json();
      if (sequence !== request) return;
      if (!response.ok)
        throw Error(data.error ?? "일정을 불러오지 못했습니다.");
      ctx.liveCalendar = { events: data.events };
      status.textContent = "기본 캘린더 · 실제 데이터 · 읽기 전용 · 한국 시간";
    } catch (error) {
      if (sequence !== request) return;
      ctx.liveCalendar = { events: [], error: error.message };
      status.textContent =
        "일정을 불러오지 못했어요. 새로고침 또는 다시 연결해 주세요.";
    }
    controls();
    schedule.render();
  }
  function restore() {
    request++;
    ctx.liveCalendar = null;
    controls();
    schedule.render();
  }
  ctx.onDateChange = (date) => {
    if (ctx.liveCalendar) void load(date);
  };
  connect.onclick = () => {
    location.href = "/api/google/login";
  };
  view.onclick = () => void load(schedule.selected());
  example.onclick = () => {
    restore();
    status.textContent = connected
      ? "Google 연결됨 · 예시 일정 표시 중"
      : "예시 모드";
  };
  disconnect.onclick = async () => {
    disconnect.disabled = true;
    try {
      const response = await fetch("/api/google/logout", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      connected = false;
      restore();
      status.textContent = "연결 해제됨 · 예시 모드";
      if (!result.revoked)
        announce(
          "대시보드에서는 로그아웃했습니다. Google 계정 설정에서 접근 권한 해제도 확인해 주세요.",
        );
    } catch {
      announce("연결 해제를 확인하지 못했어요. 다시 시도해 주세요.");
    } finally {
      disconnect.disabled = false;
    }
  };
  try {
    const response = await fetch("/api/google/status", { cache: "no-store" });
    if (!response.ok) throw Error("Status unavailable");
    const data = await response.json();
    configured = data.configured;
    connected = data.connected;
    status.textContent = connected
      ? "Google 연결됨 · 예시 일정 표시 중"
      : configured
        ? "예시 모드 · Google 연결 가능"
        : "예시 모드 · Google 연결 설정 필요";
  } catch {
    status.textContent = "예시 모드 · Google 연결 상태를 확인할 수 없어요.";
  }
  controls();
  const url = new URL(location.href);
  const auth = url.searchParams.get("auth");
  if (auth) {
    announce(
      auth === "connected"
        ? "Google 계정이 연결됐습니다. 기본 캘린더 보기를 눌러 주세요."
        : "Google 연결을 완료하지 못했습니다. 허용 계정과 권한 설정을 확인해 주세요.",
    );
    url.searchParams.delete("auth");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
}
