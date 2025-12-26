// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Максим": { position: "Повар", rate: 700 },
  "Повар": { position: "Повар", rate: 600 },
  "Баха": { position: "Повар", rate: 650 },
  "Ирина": { position: "Кондитер", rate: 650 }
};

const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Максим": { name: "Maksim", position: "Cook", rate: 700 },
  "Повар": { name: "Cook", position: "Cook", rate: 600 },
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

// ====== НОВОЕ: парсер значения смены ======
function parseShiftValue(cell) {
  if (!cell) return 0;
  const v = String(cell).trim().replace(",", ".");
  if (v === "3") return 1; // заготовочная смена
  const num = parseFloat(v);
  if (!isNaN(num) && num >= 0 && num <= 2) return num;
  return 0;
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
  const shiftValue = parseShiftValue(cell);

  if (shiftValue > 0 && shiftValue < 1) { td.classList.add("shift-partial"); } 
  if (shiftValue > 1) { td.classList.add("shift-double"); }
  if (cell === "1" || cell === "3") td.classList.add("shift-1");
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
        const shiftValue = parseShiftValue(csvData[r][c]);

        if (shiftValue > 0) {
          if (!summary[worker]) {
            summary[worker] = {
              shifts: 0,
              rate: employeesRU[worker].rate,
              total: 0,
              manualAmount: 0
            };
          }

          summary[worker].shifts += shiftValue;
          summary[worker].total += shiftValue * employeesRU[worker].rate;
        }
      }
    }
  }

  // корректировки
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

function parseManualAmount(text) {
  if (!text) return 0;
  const m = String(text).match(/([+-]?\d+(?:[.,]\d{1,2})?)/);
  if (!m) return 0;
  return Math.round(parseFloat(m[1].replace(",", ".")));
}

// ================== ОТОБРАЖЕНИЕ ОТЧЕТА ==================
function renderSalarySummary(start, end, summary) {
  const container = document.getElementById("salarySummary");
  container.innerHTML = "";

  const heading = document.createElement("div");
  heading.textContent = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "8px";
  container.appendChild(heading);

  const names = Object.keys(summary).sort((a, b) => a.localeCompare(b, "ru"));
  const totalDiv = document.createElement("div");
  totalDiv.style.fontWeight = "700";
  totalDiv.style.marginTop = "12px";

  names.forEach(name => {
    const s = summary[name];
    const pos = employeesRU[name]?.position || "";

    const div = document.createElement("div");
    div.style.whiteSpace = "pre-line";
    div.style.marginBottom = "8px";
    div.style.padding = "6px 8px";
    div.style.border = "1px solid #e0e0e0";
    div.style.borderRadius = "6px";
    div.style.backgroundColor = "#fafafa";

    const textBefore = `${name} (${pos})\nСмен: ${s.shifts}\nСтавка: ${s.rate}`;

    const input = document.createElement("input");
    input.type = "number";
    input.value = s.manualAmount || 0;
    input.style.marginTop = "4px";
    input.style.width = "100px";

    const totalLine = document.createElement("div");

    const updateBlock = () => {
      s.manualAmount = parseInt(input.value) || 0;
      const base = Math.round(s.shifts * s.rate);
      const total = base + s.manualAmount;

      totalLine.textContent =
        (s.manualAmount ? `Корректировка: ${s.manualAmount}\n` : "") +
        `К выплате: ${total}`;

      div.textContent = textBefore + "\n";
      div.appendChild(totalLine);
      div.appendChild(input);

      let sumAll = 0;
      names.forEach(n => {
        const sw = summary[n];
        sumAll += Math.round(sw.shifts * sw.rate) + (sw.manualAmount || 0);
      });
      totalDiv.textContent = `Итого к выплате: ${sumAll}`;
    };

    input.addEventListener("input", updateBlock);
    updateBlock();
    container.appendChild(div);
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

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", () => {
  loadSchedule();
  document.getElementById("generateBtn").addEventListener("click", generateSalary);
});
