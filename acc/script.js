// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Максим": { position: "Повар", rate: 700 },
  "Повар": { position: "Повар", rate: 600 },
  "Баха": { position: "Повар", rate: 700 },
  "Ирина": { position: "Кондитер", rate: 650 }
};

const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Максим": { name: "Maksim", position: "Cook", rate: 700 },
  "Повар": { name: "Cook", position: "Cook", rate: 600 },
  "Баха": { name: "Baha", position: "Cook", rate: 700 },
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
          if (!summary[worker]) {
            summary[worker] = {
              shifts: 0,
              rate: employeesRU[worker].rate,
              manualAmount: 0
            };
          }
          summary[worker].shifts++;
        }
      }
    }
  }

  const manuals = loadManuals();
  for (let w in summary) {
    summary[w].manualAmount = parseManualAmount(manuals[w]);
  }

  return summary;
}

// ================== ФОРМАТ СООБЩЕНИЯ ==================
function formatSalaryMessageEN(start, end, summary) {
  let msg = `Salary report ${start.toLocaleDateString("en-GB")} - ${end.toLocaleDateString("en-GB")}\n\n`;
  let total = 0;

  for (let w in summary) {
    const s = summary[w];
    const en = employeesEN[w];
    const sum = s.shifts * s.rate + (s.manualAmount || 0);

    msg += `${en.name} (${en.position})\n`;
    msg += `Shifts: ${s.shifts}\nRate: ${s.rate}\n`;
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

    block.textContent = `${name} (${pos})\nСмен: ${s.shifts}\nСтавка: ${s.rate}`;

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

      const sum = s.shifts * s.rate + s.manualAmount;
      totalLine.textContent =
        (s.manualAmount ? `Корректировка: ${s.manualAmount}\n` : "") +
        `К выплате: ${sum}`;

      let all = 0;
      names.forEach(n => {
        const x = summary[n];
        all += x.shifts * x.rate + (x.manualAmount || 0);
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
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  renderSalarySummary(start, end, summary);
}

// ================== ОТПРАВКА ==================
async function sendSalary() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

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

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", async () => {
  await loadSchedule();
  document.getElementById("generateBtn").onclick = generateSalary;
  document.getElementById("sendSalaryToTelegram").onclick = sendSalary;
});
