import { dateKey, calendarDays, validateEvent } from "./core.js";
import { renderGoogleCalendar } from "./google.js";
import {
  $,
  escapeHTML as esc,
  id,
  edit,
  textField,
  textArea,
  confirmDelete,
} from "./ui.js";
export function setupSchedule(ctx) {
  let selected = dateKey(),
    month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const format = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  function select(key) {
    selected = key;
    month = new Date(key + "T12:00:00");
    month.setDate(1);
    render();
    ctx.onDateChange?.(selected);
  }
  function editor(event) {
    if (ctx.liveCalendar) return;
    edit(
      event ? "일정 수정" : "일정 추가",
      textField("제목", "title", event?.title) +
        textField("날짜", "date", event?.date ?? selected, "date") +
        `<div class="time-fields">${textField("시작 시간", "start", event?.start ?? "09:00", "time")}${textField("종료 시간", "end", event?.end ?? "10:00", "time")}</div>` +
        textArea("메모", "memo", event?.memo),
      (data) => {
        const error = validateEvent(data);
        if (error) return error;
        if (event)
          ctx.state.events = ctx.state.events.map((e) =>
            e.id === event.id ? { ...e, ...data } : e,
          );
        else ctx.state.events.push({ ...data, id: id() });
        select(data.date);
        ctx.save();
        render();
      },
    );
  }
  function render() {
    $("#add-event").disabled = !!ctx.liveCalendar;
    $("#add-event").title = ctx.liveCalendar
      ? "실제 일정은 현재 읽기 전용입니다."
      : "";
    $("#header-date").textContent = format(dateKey());
    $("#selected-date").textContent = format(selected);
    $("#schedule-title").textContent =
      selected === dateKey() ? "오늘의 일정" : "선택한 날의 일정";
    $("#month-title").textContent =
      `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
    $("#month-days").innerHTML = calendarDays(
      month.getFullYear(),
      month.getMonth(),
    )
      .map((key) =>
        key
          ? `<button data-date="${key}" class="${key === selected ? "selected" : ""}" aria-label="${key}" aria-pressed="${key === selected}" ${key === dateKey() ? 'aria-current="date"' : ""}>${Number(key.slice(-2))}</button>`
          : "<span></span>",
      )
      .join("");
    const start = new Date(selected + "T12:00:00");
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    $("#week").innerHTML = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      const key = dateKey(day);
      return `<button data-date="${key}" class="${selected === key ? "selected" : ""}" aria-pressed="${selected === key}" aria-label="${key}">${day.getMonth() + 1}.${day.getDate()}<small>${["일", "월", "화", "수", "목", "금", "토"][day.getDay()]}</small></button>`;
    }).join("");
    if (ctx.liveCalendar) {
      $("#agenda").innerHTML = renderGoogleCalendar(ctx.liveCalendar);
      return;
    }
    const events = ctx.state.events
      .filter((e) => e.date === selected)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (!events.length) {
      $("#agenda").innerHTML =
        '<div class="empty">이날은 등록된 일정이 없어요.<br>일정 추가로 하루를 계획해 보세요.</div>';
      return;
    }
    const minutes = (time) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const min = Math.min(
        8,
        ...events.map((e) => Math.floor(minutes(e.start) / 60)),
      ),
      max = Math.max(18, ...events.map((e) => Math.ceil(minutes(e.end) / 60)));
    const hourHeight = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--timeline-hour",
      ),
    );
    const lanes = [];
    const placed = events.map((e) => {
      let lane = lanes.findIndex((end) => end <= minutes(e.start));
      if (lane < 0) lane = lanes.length;
      lanes[lane] = minutes(e.end);
      return { e, lane };
    });
    $("#agenda").innerHTML =
      Array.from(
        { length: max - min },
        (_, i) =>
          `<div class="hour"><span>${String(min + i).padStart(2, "0")}:00</span><i></i></div>`,
      ).join("") +
      `<div class="event-track" style="--lanes:${lanes.length}">${placed.map(({ e, lane }) => `<article class="event" style="top:${((minutes(e.start) - min * 60) / 60) * hourHeight}px;height:${Math.max(72, ((minutes(e.end) - minutes(e.start)) / 60) * hourHeight)}px;left:calc(${lane} * 100% / ${lanes.length});width:calc(100% / ${lanes.length} - 4px)"><span class="event-time">${esc(e.start)}–${esc(e.end)}</span><strong>${esc(e.title)}</strong><div class="event-tools"><button data-edit="${e.id}" aria-label="${esc(e.title)} 일정 수정">수정</button><button data-delete="${e.id}" aria-label="${esc(e.title)} 일정 삭제">삭제</button></div></article>`).join("")}</div>`;
  }
  $("#add-event").onclick = () => editor();
  $("#today").onclick = () => select(dateKey());
  $("#month-prev").onclick = () => {
    month.setMonth(month.getMonth() - 1);
    render();
  };
  $("#month-next").onclick = () => {
    month.setMonth(month.getMonth() + 1);
    render();
  };
  ["#month-days", "#week"].forEach(
    (selector) =>
      ($(selector).onclick = (e) => {
        const key = e.target.closest("[data-date]")?.dataset.date;
        if (key) select(key);
      }),
  );
  $("#agenda").onclick = (e) => {
    if (ctx.liveCalendar) return;
    const editId = e.target.closest("[data-edit]")?.dataset.edit,
      deleteId = e.target.closest("[data-delete]")?.dataset.delete;
    if (editId) editor(ctx.state.events.find((v) => v.id === editId));
    if (deleteId)
      confirmDelete(() => {
        ctx.state.events = ctx.state.events.filter((v) => v.id !== deleteId);
        ctx.save();
        render();
      });
  };
  render();
  return { render, selected: () => selected };
}
