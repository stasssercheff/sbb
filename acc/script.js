// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Макс Р": { position: "Повар", rate: 700 },
  "Макс Ж": { position: "Повар", rate: 600 },
  "Баха": { position: "Повар", rate: 650 },
  "Ирина": { position: "Кондитер", rate: 650 }
};

const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Макс Р": { name: "Maks R", position: "Cook", rate: 700 },
  "Макс Ж": { name: "Maks G", position: "Cook", rate: 600 },
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
          if (!summary[worker]) summary[worker] = {
            shifts: 0,
            rate: employeesRU[worker].rate,
            total: 0,
            manualAmount: 0
          };
          summary[worker].shifts++;
          summary[worker].total += employeesRU[worker].rate;
        }
      }
    }
  }

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
  if (!text || String(text).trim() === "") delete all[worker];
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
function formatSalaryMessageEN(start, end, summary) {
  let msg =
    `Salary report for the period ${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}\n\n`;

  let total = 0;

  for (let w in summary) {
    const s = summary[w];
    const en = employeesEN[w];

    msg +=
      `${en.name} (${en.position})\n` +
      `Shifts: ${s.shifts}\n` +
      `Rate: ${s.rate}\n` +
      `Adjustment: ${s.manualAmount || 0}\n` +
      `Total: ${s.total}\n\n`;

    total += s.total;
  }

  msg += `Total payout: ${total}`;
  return msg;
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
      body: JSON.stringify({
        chat_id: "-1003149716465",
        text: msg
      })
    });
    alert("✅ Salary report sent");
  } catch (err) {
    console.error(err);
    alert("❌ Error sending salary report");
  }
}

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sendSalaryToTelegram")
    .addEventListener("click", sendSalary);
});
