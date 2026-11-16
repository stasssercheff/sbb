// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Dani": { position: "Повар", rate: 700 },
  "Hieu": { position: "Повар", rate: 700 },
  "Hai": { position: "Повар", rate: 700 },
  "Ирина": { position: "Кондитер", rate: 750 }


  
};



const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Dani": { name: "Dani", position: "Cook", rate: 700 },
  "Hieu": { name: "Hieu", position: "Cook", rate: 700 },
  "Hai": { name: "Hai", position: "Cook", rate: 700 },
  "Ирина": { name: "Irina", position: "Pastry", rate: 750 }
};

let csvData = [];
/** Абсолютные даты колонок графика (с годом), индекс = номер колонки CSV */
let headerDates = [];
/** Строки шапки: год (опционально), дата, день */
let scheduleLayout = { yearRow: -1, dateRow: 0, dayRow: 1, headerRows: new Set([0, 1]) };

// ================== ВСПОМОГАТЕЛЬНЫЕ ==================
function cleanCell(cell) {
  if (!cell) return "";
  return String(cell).replace(/\r/g, "").replace(/^"|"$/g, "").trim();
}

function parseCSV(text) {
  const delimiter = text.includes(";") ? ";" : ",";
  return text.trim().split("\n").map(r => r.split(delimiter).map(cleanCell));
}

function rowLabel(row) {
  return String(row?.[0] || "").trim().toLowerCase();
}

function isYearLabel(label) {
  return label === "год" || label === "year" || label === "năm";
}

function isDateLabel(label) {
  return label === "дата" || label === "date" || label === "ngày";
}

function isDayLabel(label) {
  return label === "день" || label === "day" || label === "dow" || label === "thứ";
}

function looksLikeYearRow(row) {
  if (!row) return false;
  if (isYearLabel(rowLabel(row))) return true;
  let years = 0;
  let checked = 0;
  for (let i = 1; i < Math.min(row.length, 40); i++) {
    const v = String(row[i] || "").trim();
    if (!v) continue;
    checked++;
    if (/^\d{4}$/.test(v)) years++;
  }
  return checked >= 3 && years / checked >= 0.5;
}

function detectScheduleLayout(rows) {
  let yearRow = -1;
  let dateRow = -1;
  let dayRow = -1;

  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const label = rowLabel(rows[r]);
    if (yearRow < 0 && (isYearLabel(label) || looksLikeYearRow(rows[r]))) {
      yearRow = r;
      continue;
    }
    if (dateRow < 0 && isDateLabel(label)) {
      dateRow = r;
      continue;
    }
    if (dayRow < 0 && isDayLabel(label)) {
      dayRow = r;
    }
  }

  if (dateRow < 0) dateRow = yearRow >= 0 ? yearRow + 1 : 0;
  if (dayRow < 0) dayRow = dateRow + 1;

  const headerRows = new Set([dateRow, dayRow]);
  if (yearRow >= 0) headerRows.add(yearRow);

  return { yearRow, dateRow, dayRow, headerRows };
}

/** День/месяц[/год] из заголовка ячейки графика */
function parseDayMonth(s) {
  if (!s) return null;
  s = String(s).trim().replace(/\.$/, "").replace(/\s+$/, "");
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return { day: +m[1], month: +m[2] - 1, year: +m[3] };
  m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m) return { day: +m[1], month: +m[2] - 1, year: null };
  return null;
}

/**
 * Даты в таблице без года идут подряд (сен 2025 → дек 2026).
 * Без года 01.11 2025 и 01.11 2026 сливались бы в один период.
 * Если сверху есть строка «Год» — берём год из неё.
 */
function assignHeaderDates(dateRow, startYear, yearRow) {
  const dates = new Array(dateRow.length).fill(null);
  let year = startYear;
  let prev = null;

  for (let c = 1; c < dateRow.length; c++) {
    const p = parseDayMonth(dateRow[c]);
    if (!p) continue;

    const yearCell = yearRow ? String(yearRow[c] || "").trim() : "";
    const yearFromRow = /^\d{4}$/.test(yearCell) ? +yearCell : null;

    if (p.year != null) {
      year = p.year;
    } else if (yearFromRow != null) {
      year = yearFromRow;
    } else if (prev && new Date(year, p.month, p.day) < prev) {
      year += 1;
    }

    const d = new Date(year, p.month, p.day);
    dates[c] = d;
    prev = d;
  }
  return dates;
}

function buildHeaderDates(dateRow, preferredYear, yearRow) {
  const target = preferredYear || new Date().getFullYear();

  // Если строка «Год» заполнена — этого достаточно
  if (yearRow) {
    const fromRow = assignHeaderDates(dateRow, target - 1, yearRow);
    const filled = fromRow.filter(Boolean).length;
    if (filled > 0) return fromRow;
  }

  let fallback = null;
  for (const startYear of [target - 1, target, target - 2]) {
    const dates = assignHeaderDates(dateRow, startYear, null);
    const years = dates.filter(Boolean).map(d => d.getFullYear());
    if (!years.length) continue;
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    if (minY <= target && target <= maxY) {
      if (maxY === target) return dates;
      if (!fallback) fallback = dates;
    }
  }
  return fallback || assignHeaderDates(dateRow, target - 1, null);
}

function refreshHeaderDates() {
  if (!csvData.length) return;
  scheduleLayout = detectScheduleLayout(csvData);
  const yearHint = +document.getElementById("yearSelect")?.value || new Date().getFullYear();
  const dateRow = csvData[scheduleLayout.dateRow] || csvData[0];
  const yearRow = scheduleLayout.yearRow >= 0 ? csvData[scheduleLayout.yearRow] : null;
  headerDates = buildHeaderDates(dateRow, yearHint, yearRow);
}

function parseDate(s) {
  const p = parseDayMonth(s);
  if (!p) return null;
  if (p.year != null) return new Date(p.year, p.month, p.day);
  return new Date(new Date().getFullYear(), p.month, p.day);
}

function dateAtColumn(c) {
  return headerDates[c] || null;
}

/** Сколько смен в ячейке: 1 и 3 = целая, 0.5 / 0,5 = полсмены */
function parseShiftValue(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  // «3» в графике — особый код полной смены (не три смены)
  if (s === "1" || s === "3") return 1;
  const normalized = s.replace(",", ".");
  if (!/^\d*\.?\d+$/.test(normalized)) return 0;
  const n = parseFloat(normalized);
  if (isNaN(n) || n <= 0) return 0;
  return n;
}

function formatShifts(n) {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function shiftCellClass(cell) {
  const s = String(cell ?? "").trim();
  if (s === "1") return "shift-1";
  if (s === "0") return "shift-0";
  if (s === "VR") return "shift-VR";
  if (s === "3") return "shift-3";
  const value = parseShiftValue(s);
  if (value > 0 && value < 1) return "shift-partial";
  if (value > 1) return "shift-double";
  return "";
}

function shiftCellBackground(cell) {
  const s = String(cell ?? "").trim();
  if (s === "1") return "#a6e6a6";
  if (s === "0") return "#f0f0f0";
  if (s === "VR") return "#ffd966";
  if (s === "3") return "#b4c6e7";
  if (s === "Б") return "#ff9999";
  const value = parseShiftValue(s);
  // полсмены — заметный оранжевый, не путать с зелёной полной сменой
  if (value > 0 && value < 1) return "#ffb347";
  if (value > 1) return "#5dde26";
  return "";
}

function getPeriodFromUI() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = +document.getElementById("yearSelect").value;
  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  return { month, half, year, start, end };
}

/** Те же ячейки, что на PNG: первая колонка — имя (EN), дальше даты периода */
function buildScheduleSliceAoA(start, end) {
  refreshHeaderDates();
  const dateRow = csvData[scheduleLayout.dateRow] || csvData[0];
  const aoa = [];
  const head = ["Employee"];
  for (let c = 1; c < dateRow.length; c++) {
    const date = dateAtColumn(c);
    if (date && date >= start && date <= end) head.push(dateRow[c]);
  }
  aoa.push(head);

  for (let r = 0; r < csvData.length; r++) {
    if (scheduleLayout.headerRows.has(r)) continue;
    const ruName = csvData[r][0].trim();
    if (!employeesEN[ruName] && !employeesRU[ruName]) continue;
    const en = employeesEN[ruName] || { name: ruName, position: "", rate: 0 };
    const row = [en.name];
    for (let c = 1; c < dateRow.length; c++) {
      const date = dateAtColumn(c);
      if (date && date >= start && date <= end) {
        row.push(csvData[r][c]);
      }
    }
    aoa.push(row);
  }
  return aoa;
}

function buildScheduleSliceTableElement(start, end) {
  const aoa = buildScheduleSliceAoA(start, end);
  const table = document.createElement("table");
  table.style.backgroundColor = "#ffffff";
  const tbody = document.createElement("tbody");

  aoa.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    row.forEach((cell, cIdx) => {
      const td = document.createElement("td");
      td.textContent = cell;
      if (rIdx > 0 && cIdx > 0) {
        const bg = shiftCellBackground(cell);
        if (bg) td.style.backgroundColor = bg;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

// ================== ЗАГРУЗКА ГРАФИКА ==================
async function loadSchedule() {
  const resp = await fetch(CSV_URL);
  const text = await resp.text();
  csvData = parseCSV(text);
  refreshHeaderDates();

  const tableBody = document.getElementById("schedule").querySelector("tbody");
  tableBody.innerHTML = "";
  const today = new Date();
  const todayCols = new Set();
  for (let c = 1; c < headerDates.length; c++) {
    const date = dateAtColumn(c);
    if (date && isSameDay(date, today)) todayCols.add(c);
  }

  csvData.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    const isHeader = scheduleLayout.headerRows.has(rIdx);
    const isEmployeeRow = !isHeader;

    row.forEach((cell, cIdx) => {
      const td = document.createElement("td");
      td.textContent = cell;

      if (isEmployeeRow && cIdx > 0) {
        const cls = shiftCellClass(cell);
        if (cls) td.classList.add(cls);
      }
      // подсветка «сегодня» — Год / Дата / День, не столбец смен
      if (todayCols.has(cIdx) && isHeader) {
        td.classList.add("today");
        if (rIdx === scheduleLayout.dateRow) td.title = "Сегодня";
      }

      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  // график длинный — сразу прокрутить к сегодняшней колонке
  requestAnimationFrame(() => scrollScheduleToToday());
}

function scrollScheduleToToday() {
  const todayCell = document.querySelector("#schedule td.today");
  const container = document.querySelector(".table-container");
  if (!todayCell || !container) return;

  const cellRect = todayCell.getBoundingClientRect();
  const contRect = container.getBoundingClientRect();
  const delta = cellRect.left - contRect.left - contRect.width / 2 + cellRect.width / 2;
  container.scrollLeft += delta;
}

// ================== ЛОКАЛЬНЫЕ КОРРЕКТИРОВКИ ==================
const MANUAL_KEY = "salaryManualText_v1";

function loadManuals() {
  try {
    return JSON.parse(localStorage.getItem(MANUAL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveManuals(obj) {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(obj));
}

function setManualText(worker, value) {
  const all = loadManuals();
  if (!value) delete all[worker];
  else all[worker] = String(value);
  saveManuals(all);
}

function parseManualAmount(text) {
  if (!text) return 0;
  const m = String(text).match(/([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ================== РАСЧЁТ ЗАРПЛАТЫ ==================
function calculateSalary(periodStart, periodEnd) {
  refreshHeaderDates();
  const summary = {};
  const headerRow = csvData[0];

  for (let r = 1; r < csvData.length; r++) {
    const worker = csvData[r][0]?.trim();
    if (!worker || !employeesRU[worker]) continue;

    for (let c = 1; c < headerRow.length; c++) {
      const date = dateAtColumn(c);
      if (!date) continue;

      if (date >= periodStart && date <= periodEnd) {
        const shiftValue = parseShiftValue(csvData[r][c]);
        if (shiftValue > 0) {
          if (!summary[worker]) {
            summary[worker] = {
              shifts: 0,
              rate: employeesRU[worker].rate,
              manualAmount: 0
            };
          }
          summary[worker].shifts += shiftValue;
        }
      }
    }
  }

  const manuals = loadManuals();
  for (let w in summary) {
    // убираем хвосты float (0.1+0.2) и подтягиваем ручные корректировки
    summary[w].shifts = Math.round(summary[w].shifts * 100) / 100;
    summary[w].manualAmount = parseManualAmount(manuals[w]);
  }

  return summary;
}

function salaryTotal(s) {
  return Math.round(s.shifts * s.rate) + (s.manualAmount || 0);
}

// ================== ФОРМАТ СООБЩЕНИЯ ==================
function formatSalaryMessageEN(start, end, summary) {
  let msg = `Salary report ${start.toLocaleDateString("en-GB")} - ${end.toLocaleDateString("en-GB")}\n\n`;
  let total = 0;

  for (let w in summary) {
    const s = summary[w];
    const en = employeesEN[w];
    const sum = salaryTotal(s);

    msg += `${en.name} (${en.position})\n`;
    msg += `Shifts: ${formatShifts(s.shifts)}\nRate: ${s.rate}\n`;
    if (s.manualAmount) msg += `Adjustment: ${s.manualAmount}\n`;
    msg += `Total: ${sum}\n\n`;

    total += sum;
  }

  msg += `Total payout: ${total}`;
  return msg;
}

// ================== ОТОБРАЖЕНИЕ ==================
function renderSalarySummary(start, end, summary) {
  const container = document.getElementById("salarySummary");
  container.innerHTML = "";

  const names = Object.keys(summary).sort((a, b) => a.localeCompare(b, "ru"));

  const totalDiv = document.createElement("div");
  totalDiv.style.fontWeight = "700";
  totalDiv.style.marginTop = "12px";

  names.forEach(name => {
    const s = summary[name];
    const pos = employeesRU[name].position;

    const block = document.createElement("div");
    block.style.border = "1px solid #ddd";
    block.style.borderRadius = "6px";
    block.style.padding = "8px";
    block.style.marginBottom = "8px";
    block.style.whiteSpace = "pre-line";

    block.textContent = `${name} (${pos})\nСмен: ${formatShifts(s.shifts)}\nСтавка: ${s.rate}`;

    const totalLine = document.createElement("div");
    totalLine.style.marginTop = "4px";
    block.appendChild(totalLine);

    const input = document.createElement("input");
    input.type = "number";
    input.value = s.manualAmount || 0;
    input.style.marginTop = "6px";
    input.style.width = "120px";
    block.appendChild(input);

    const recalc = () => {
      s.manualAmount = parseInt(input.value) || 0;

      // 🔴 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ
      setManualText(name, s.manualAmount);

      const sum = salaryTotal(s);
      totalLine.textContent =
        (s.manualAmount ? `Корректировка: ${s.manualAmount}\n` : "") +
        `К выплате: ${sum}`;

      let all = 0;
      names.forEach(n => {
        all += salaryTotal(summary[n]);
      });
      totalDiv.textContent = `Итого к выплате: ${all}`;
    };

    input.addEventListener("input", recalc);
    recalc();

    container.appendChild(block);
  });

  container.appendChild(totalDiv);
}

// ================== КНОПКИ ==================
function generateSalary() {
  const { start, end } = getPeriodFromUI();
  const summary = calculateSalary(start, end);
  renderSalarySummary(start, end, summary);
}

// ================== PNG + XLSX (один фрагмент графика) ==================
function generateScheduleImage(callback = null) {
  const { start, end, year, month, half } = getPeriodFromUI();
  const table = buildScheduleSliceTableElement(start, end);
  document.body.appendChild(table);

  const pad = (n) => String(n).padStart(2, "0");
  const pngName = `schedule_${year}-${pad(month + 1)}_${half === "1" ? "01-15" : "16-31"}.png`;

  html2canvas(table, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = pngName;
    link.click();
    table.remove();
    if (callback) callback();
  });
}

function downloadScheduleXlsx() {
  if (typeof XLSX === "undefined") {
    alert("Не загрузилась библиотека для Excel. Проверьте сеть и обновите страницу.");
    return;
  }
  const { start, end, year, month, half } = getPeriodFromUI();
  const aoa = buildScheduleSliceAoA(start, end);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Schedule");

  const pad = (n) => String(n).padStart(2, "0");
  const fileName = `schedule_${year}-${pad(month + 1)}_${half === "1" ? "01-15" : "16-31"}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function downloadSchedulePngAndXlsx() {
  downloadScheduleXlsx();
  generateScheduleImage();
}

function syncManualAdjustmentsFromUI() {
  const blocks = document.querySelectorAll("#salarySummary > div");

  blocks.forEach(block => {
    const input = block.querySelector("input[type='number']");
    if (!input) return;

    const nameMatch = block.textContent.match(/^(.+?) \(/);
    if (!nameMatch) return;

    const worker = nameMatch[1].trim();
    setManualText(worker, input.value);
  });
}

// ================== ОТПРАВКА ==================
async function sendSalary() {
  const { start, end } = getPeriodFromUI();
  const summary = calculateSalary(start, end);
  const msg = formatSalaryMessageEN(start, end, summary);

  await fetch("https://shbb1.stassser.workers.dev/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: "-1002937581100",
      text: msg
    })
  });

  alert("Отправлено");
}

// ================== ДАТА И ПЕРИОД ПО УМОЛЧАНИЮ ==================
/** Предшествующий расчётный период: 1–15 → прошлый 16–31; 16–31 → текущий 1–15 */
function selectPrecedingSalaryPeriod(now = new Date()) {
  const day = now.getDate();
  let year;
  let month;
  let half;

  if (day <= 15) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = prev.getFullYear();
    month = prev.getMonth();
    half = "2";
  } else {
    year = now.getFullYear();
    month = now.getMonth();
    half = "1";
  }

  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  const halfSelect = document.getElementById("halfSelect");

  if (yearSelect) {
    const hasYear = [...yearSelect.options].some(o => +o.value === year);
    if (!hasYear) {
      const opt = document.createElement("option");
      opt.value = String(year);
      opt.textContent = String(year);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = String(year);
  }
  if (monthSelect) monthSelect.value = String(month);
  if (halfSelect) halfSelect.value = half;
}

function showTodayDate() {
  const dateEl = document.getElementById("current-date");
  if (!dateEl) return;
  const lang = localStorage.getItem("lang") || "ru";
  const locales = { ru: "ru-RU", en: "en-GB", vi: "vi-VN" };
  dateEl.textContent = new Date().toLocaleDateString(locales[lang] || "ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", async () => {
  showTodayDate();
  selectPrecedingSalaryPeriod();
  await loadSchedule();
  document.getElementById("generateBtn").onclick = generateSalary;
  document.getElementById("sendSalaryToTelegram").onclick = sendSalary;
  document.getElementById("downloadImageBtn").onclick = downloadSchedulePngAndXlsx;
});
