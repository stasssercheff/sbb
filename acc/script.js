// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Максим Р": { position: "Повар", rate: 700 },
  "Максим Ж": { position: "Повар", rate: 600 },
  "Баха": { position: "Повар", rate: 650 },
  "Ирина": { position: "Кондитер", rate: 650 }
};

const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Максим Р": { name: "Maksim R", position: "Cook", rate: 700 },
  "Максим Ж": { name: "Maksim G", position: "Cook", rate: 600 },
  "Баха": { name: "Baha", position: "Cook", rate: 650 },
  "Ирина": { name: "Irina", position: "Pastry", rate: 650 }
};

let csvData = [];

// ================== ВСПОМОГАТЕЛЬНЫЕ ==================
function cleanCell(cell) {
  if (!cell) return "";
  return String(cell).replace(/\r/g, "").replace(/^"|"$/g, "").trim();
}

function parseCSV(text) {
  const delimiter = text.includes(";") ? ";" : ",";
  return text.trim().split("\n").map(r => r.split(delimiter).map(cleanCell));
}

function parseDate(s) {
  if (!s) return null;
  s = s.trim().replace(/\.$/, "").replace(/\s+$/, "");
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m) return new Date(new Date().getFullYear(), +m[2] - 1, +m[1]);
  return null;
}

// ================== ЗАГРУЗКА ГРАФИКА ==================
async function loadSchedule() {
  try {
    const resp = await fetch(CSV_URL);
    const text = await resp.text();
    csvData = parseCSV(text);

    const tableBody = document.getElementById("schedule").querySelector("tbody");
    tableBody.innerHTML = "";

    csvData.forEach((row, rIdx) => {
      const tr = document.createElement("tr");
      row.forEach((cell, cIdx) => {
        const td = document.createElement("td");
        td.textContent = cell;

        if (rIdx > 0 && cIdx > 0) {
          if (cell === "1") td.classList.add("shift-1");
          if (cell === "0") td.classList.add("shift-0");
          if (cell === "VR") td.classList.add("shift-VR");
          if (cell === "Б") td.classList.add("shift-Б");
        }

        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading CSV:", err);
  }
}

// ================== РАСЧЁТ ЗАРПЛАТЫ ==================
function calculateSalary(periodStart, periodEnd) {
  const summary = {};
  const headerRow = csvData[0];

  for (let r = 1; r < csvData.length; r++) {
    const worker = csvData[r][0]?.trim();
    if (!worker || !employeesRU[worker]) continue;

    for (let c = 1; c < headerRow.length; c++) {
      const date = parseDate(headerRow[c]);
      if (!date) continue;

      if (date >= periodStart && date <= periodEnd) {
        const shift = csvData[r][c].trim();
        if (shift === "1") {
          if (!summary[worker]) summary[worker] = { shifts: 0, rate: employeesRU[worker].rate, total: 0, manualAmount: 0 };
          summary[worker].shifts++;
          summary[worker].total += employeesRU[worker].rate;
        }
      }
    }
  }

  // добавляем корректировки
  const manuals = loadManuals();
  for (let w in manuals) {
    if (summary[w]) {
      summary[w].manualAmount = parseManualAmount(manuals[w]);
      summary[w].total += summary[w].manualAmount;
    }
  }

  return summary;
}

// ================== ЛОКАЛЬНЫЕ КОРРЕКТИРОВКИ ==================
const MANUAL_KEY = "salaryManualText_v1";

function loadManuals() {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) { return {}; }
}

function saveManuals(obj) {
  try { localStorage.setItem(MANUAL_KEY, JSON.stringify(obj)); } catch (e) {}
}

function setManualText(worker, text) {
  const all = loadManuals();
  if (text == null || String(text).trim() === "") delete all[worker];
  else all[worker] = String(text);
  saveManuals(all);
}

function getManualText(worker) {
  const all = loadManuals();
  return all[worker] || "";
}

function parseManualAmount(text) {
  if (!text) return 0;
  const m = String(text).match(/([+-]?\d+(?:[.,]\d{1,2})?)/);
  if (!m) return 0;
  const normalized = m[1].replace(",", ".");
  const v = parseFloat(normalized);
  return isNaN(v) ? 0 : Math.round(v);
}

// ================== ТЕКСТ ЗАРПЛАТЫ ==================
// ---- ПРАВКА: корректировка перед К выплате ----
function formatSalaryMessageRU(start, end, summary) {
  let msg = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\n\n`;
  let total = 0;
  for (let w in summary) {
    const s = summary[w];
    const manualPart = s.manualAmount ? `Корректировка: ${s.manualAmount}\n` : "";
    msg += `${w} (${employeesRU[w].position})\nСмен: ${s.shifts}\nСтавка: ${s.rate}\n${manualPart}К выплате: ${s.total}\n\n`;
    total += s.total;
  }
  msg += `Итого к выплате: ${total}`;
  return msg;
}

function formatSalaryMessageEN(start, end, summary) {
  let msg = `Salary report for the period ${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}\n\n`;
  let total = 0;
  for (let w in summary) {
    const s = summary[w];
    const manualPart = s.manualAmount ? `Adjustment: ${s.manualAmount}\n` : "";
    const en = employeesEN[w];
    msg += `${en.name} (${en.position})\nShifts: ${s.shifts}\nRate: ${s.rate}\n${manualPart}Total: ${s.total}\n\n`;
    total += s.total;
  }
  msg += `Total payout: ${total}`;
  return msg;
}








// ================== ОТОБРАЖЕНИЕ ОТЧЕТА ==================
// ---- КОРРЕКТИРОВКА ЗАРПЛАТЫ С ДИНАМИЧЕСКИМИ ИЗМЕНЕНИЯМИ ----
function renderSalarySummary(start, end, summary) {
  const container = document.getElementById("salarySummary");
  container.innerHTML = ""; // очищаем контейнер

  const heading = document.createElement("div");
  heading.textContent = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "8px";
  container.appendChild(heading);

  const names = Object.keys(summary).sort((a, b) => a.localeCompare(b, "ru"));

  const totalDiv = document.createElement("div");
  totalDiv.style.fontWeight = "700";
  totalDiv.style.marginTop = "12px";

  // Блок для каждого сотрудника
  names.forEach((name) => {
    const s = summary[name];
    const pos = (employeesRU[name] && employeesRU[name].position) || "";

    const div = document.createElement("div");
    div.style.whiteSpace = "pre-line";
    div.style.marginBottom = "8px";
    div.style.padding = "6px 8px";
    div.style.border = "1px solid #e0e0e0";
    div.style.borderRadius = "6px";
    div.style.backgroundColor = "#fafafa";

    // Базовый текст до корректировки
    const textBefore = `${name} (${pos})\nСмен: ${s.shifts}\nСтавка: ${s.rate}`;

    // input для корректировки с улучшенными стилями
    const input = document.createElement("input");
    input.type = "number";
    input.value = s.manualAmount || 0;
    input.placeholder = "Корректировка";
    input.style.marginTop = "4px";
    input.style.marginLeft = "0";
    input.style.width = "100px";
    input.style.padding = "4px 6px";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "4px";
    input.style.backgroundColor = "#f9f9f9";
    input.style.fontSize = "14px";
    input.style.transition = "all 0.2s";
    input.addEventListener("focus", () => input.style.borderColor = "#66afe9");
    input.addEventListener("blur", () => input.style.borderColor = "#ccc");

    const totalLine = document.createElement("div");
    totalLine.style.fontWeight = "500";
    totalLine.style.marginTop = "4px";

    // Функция обновления отображения
    const updateBlock = () => {
      s.manualAmount = parseInt(input.value) || 0;
      const totalForWorker = s.shifts * s.rate + s.manualAmount;

      totalLine.textContent =
        (s.manualAmount ? `Корректировка: ${s.manualAmount}\n` : "") +
        `К выплате: ${totalForWorker}`;

      // Общий блок
      div.textContent = textBefore + "\n";
      div.appendChild(totalLine);
      div.appendChild(input);

      // Пересчёт итогового totalAll
      let sumAll = 0;
      names.forEach((n) => {
        const sw = summary[n];
        sumAll += sw.shifts * sw.rate + (sw.manualAmount || 0);
      });
      totalDiv.textContent = `Итого к выплате: ${sumAll}`;
    };

    input.addEventListener("input", updateBlock);
    updateBlock();

    container.appendChild(div);
  });

  // Итог после всех сотрудников
  container.appendChild(totalDiv);
}

// ================== КНОПКИ ==================
function generateSalary() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  renderSalarySummary(start, end, summary);
}

// ================== СОХРАНЕНИЕ PNG ГРАФИКА ==================
function generateScheduleImage(callback = null) {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const headerRow = csvData[0];
  const table = document.createElement("table");
  table.style.backgroundColor = "#ffffff";
  const tbody = document.createElement("tbody");

  const header = document.createElement("tr");
  const empty = document.createElement("td");
  empty.textContent = "Employee";
  header.appendChild(empty);

  for (let c = 1; c < headerRow.length; c++) {
    const date = parseDate(headerRow[c]);
    if (date && date >= start && date <= end) {
      const th = document.createElement("td");
      th.textContent = headerRow[c];
      header.appendChild(th);
    }
  }
  tbody.appendChild(header);

  for (let r = 1; r < csvData.length; r++) {
    const tr = document.createElement("tr");
    const ruName = csvData[r][0].trim();
    const en = employeesEN[ruName] || { name: ruName, position: "", rate: 0 };
    const tdName = document.createElement("td");
    tdName.textContent = en.name;
    tr.appendChild(tdName);

    for (let c = 1; c < headerRow.length; c++) {
      const date = parseDate(headerRow[c]);
      if (date && date >= start && date <= end) {
        const td = document.createElement("td");
        td.textContent = csvData[r][c];
        if (csvData[r][c] === "1") td.style.backgroundColor = "#a6e6a6";
        else if (csvData[r][c] === "0") td.style.backgroundColor = "#f0f0f0";
        else if (csvData[r][c] === "VR") td.style.backgroundColor = "#ffd966";
        else if (csvData[r][c] === "Б") td.style.backgroundColor = "#ff9999";
        tr.appendChild(td);
      }
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  document.body.appendChild(table);

  html2canvas(table, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "schedule.png";
    link.click();
    table.remove();
    if (callback) callback();
  });
}

// ================== ОТПРАВКА ТЕКСТА В ТЕЛЕГРАМ ==================
async function sendSalary() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  const msg = formatSalaryMessageEN(start, end, summary);

  if (!msg.trim()) {
    alert("Please generate the salary first");
    return;
  }

  try {
    await fetch("https://shbb1.stassser.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "-1003149716465", text: msg })
    });
    alert("✅ Salary report sent");
  } catch (err) {
    console.error(err);
    alert("❌ Error sending salary report");
  }
}

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("current-date").textContent = new Date().toLocaleDateString("ru-RU");

  loadSchedule().then(() => {
    const today = new Date();
    const table = document.getElementById("schedule");
    const headerRow = table.querySelector("thead tr") || table.querySelector("tbody tr");
    if (!headerRow) return;

    let scrollToIdx = 0;
    const ths = headerRow.children;
    for (let i = 1; i < ths.length; i++) {
      const cellDate = parseDate(ths[i].textContent);
      if (cellDate && cellDate >= today) {
        scrollToIdx = i;
        break;
      }
    }

    const firstRow = table.querySelector("tbody tr");
    if (firstRow) {
      const td = firstRow.children[scrollToIdx];
      if (td) td.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  });

  document.getElementById("generateBtn").addEventListener("click", generateSalary);
  document.getElementById("downloadImageBtn").addEventListener("click", generateScheduleImage);
  document.getElementById("sendSalaryToTelegram").addEventListener("click", sendSalary);
});
