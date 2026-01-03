// ======================
// CONFIG TELEGRAM
// ======================
const TELEGRAM_BOT_TOKEN = "PASTE_YOUR_BOT_TOKEN_HERE";
const TELEGRAM_CHAT_ID = ""; // ← ВСТАВИШЬ ПОТОМ
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// ======================
// GOOGLE SHEET
// ======================
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

// ======================
// EMPLOYEES
// ======================
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
  "Ирина": { name: "Irina", position: "Pastry Chef", rate: 650 }
};

let csvData = [];

// ================== HELPERS ==================
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
  s = s.trim().replace(/\.$/, "");
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m) return new Date(new Date().getFullYear(), +m[2] - 1, +m[1]);
  return null;
}

function parseShiftValue(cell) {
  if (!cell) return 0;
  const v = String(cell).trim().replace(",", ".");
  if (v === "3") return 1;
  const num = parseFloat(v);
  if (!isNaN(num) && num >= 0 && num <= 2) return num;
  return 0;
}

// ================== LOAD SCHEDULE ==================
async function loadSchedule() {
  const resp = await fetch(CSV_URL);
  const text = await resp.text();
  csvData = parseCSV(text);

  const tbody = document.querySelector("#schedule tbody");
  tbody.innerHTML = "";

  csvData.forEach((row, r) => {
    const tr = document.createElement("tr");
    row.forEach((cell, c) => {
      const td = document.createElement("td");
      td.textContent = cell;

      if (r > 0 && c > 0) {
        const v = parseShiftValue(cell);
        if (v > 0 && v < 1) td.classList.add("shift-partial");
        if (v > 1) td.classList.add("shift-double");
        if (cell === "1" || cell === "3") td.classList.add("shift-1");
        if (cell === "0") td.classList.add("shift-0");
        if (cell === "VR") td.classList.add("shift-VR");
        if (cell === "Б") td.classList.add("shift-Б");
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ================== MANUAL CORRECTIONS ==================
const MANUAL_KEY = "salaryManualText_v1";

function loadManuals() {
  try {
    return JSON.parse(localStorage.getItem(MANUAL_KEY)) || {};
  } catch {
    return {};
  }
}

function parseManualAmount(text) {
  if (!text) return 0;
  const m = String(text).match(/([+-]?\d+)/);
  return m ? parseInt(m[1]) : 0;
}

// ================== SALARY CALC ==================
function calculateSalary(start, end) {
  const summary = {};
  const header = csvData[0];

  for (let r = 1; r < csvData.length; r++) {
    const worker = csvData[r][0];
    if (!employeesRU[worker]) continue;

    for (let c = 1; c < header.length; c++) {
      const d = parseDate(header[c]);
      if (!d || d < start || d > end) continue;

      const v = parseShiftValue(csvData[r][c]);
      if (!v) continue;

      if (!summary[worker]) {
        summary[worker] = { shifts: 0, total: 0 };
      }

      summary[worker].shifts += v;
      summary[worker].total += v * employeesRU[worker].rate;
    }
  }

  const manuals = loadManuals();
  for (const w in summary) {
    const m = parseManualAmount(manuals[w]);
    summary[w].manual = m;
    summary[w].total += m;
  }

  return summary;
}

// ================== TELEGRAM MESSAGE ==================
function sendToTelegram(start, end, summary) {
  if (!TELEGRAM_CHAT_ID) {
    console.warn("Telegram chat_id not set");
    return;
  }

  let text = `💰 *Salary Report*\n`;
  text += `📅 ${start.toLocaleDateString("en-GB")} – ${end.toLocaleDateString("en-GB")}\n\n`;

  let grandTotal = 0;

  Object.keys(summary).forEach(w => {
    const en = employeesEN[w];
    const s = summary[w];
    const base = Math.round(s.total - (s.manual || 0));
    const total = Math.round(s.total);
    grandTotal += total;

    text += `*${en.name}* (${en.position})\n`;
    text += `Shifts: ${s.shifts}\n`;
    text += `Base: ${base}\n`;
    if (s.manual) text += `Adjustment: ${s.manual}\n`;
    text += `Total: ${total}\n\n`;
  });

  text += `*TOTAL PAYOUT: ${grandTotal}*`;

  fetch(TELEGRAM_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown"
    })
  });
}

// ================== BUTTON ==================
function generateSalary() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  sendToTelegram(start, end, summary);
}

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  loadSchedule();
  document.getElementById("generateBtn").addEventListener("click", generateSalary);
});
