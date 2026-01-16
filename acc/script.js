// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Максим": { position: "Повар", rate: 700 },
  "Вадим": { position: "Повар", rate: 600 },
  "Денис": { position: "Повар", rate: 600 },
  "Ирина": { position: "Кондитер", rate: 700 }
};

const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Максим": { name: "Maksim", position: "Cook", rate: 700 },
  "Вадим": { name: "Vadim", position: "Cook", rate: 600 },
  "Денис": { name: "Denis", position: "Cook", rate: 600 },
  "Ирина": { name: "Irina", position: "Pastry", rate: 700 }
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

// ================== СОХРАНЕНИЕ PNG ГРАФИКА ==================
function generateScheduleImage() {
  if (!csvData || !csvData.length) {
    alert("График не загружен");
    return;
  }

  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = +document.getElementById("yearSelect").value;

  const start = half === "1"
    ? new Date(year, month, 1)
    : new Date(year, month, 16);

  const end = half === "1"
    ? new Date(year, month, 15)
    : new Date(year, month + 1, 0);

  const headerRow = csvData[0];

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.backgroundColor = "#ffffff";
  table.style.fontSize = "12px";

  const tbody = document.createElement("tbody");

  const headerTr = document.createElement("tr");
  const empty = document.createElement("td");
  empty.textContent = "Employee";
  empty.style.fontWeight = "600";
  empty.style.padding = "4px 6px";
  empty.style.border = "1px solid #ccc";
  headerTr.appendChild(empty);

  for (let c = 1; c < headerRow.length; c++) {
    const date = parseDate(headerRow[c]);
    if (date && date >= start && date <= end) {
      const td = document.createElement("td");
      td.textContent = headerRow[c];
      td.style.fontWeight = "600";
      td.style.padding = "4px 6px";
      td.style.border = "1px solid #ccc";
      headerTr.appendChild(td);
    }
  }
  tbody.appendChild(headerTr);

  for (let r = 1; r < csvData.length; r++) {
    const ruName = csvData[r][0]?.trim();
    if (!ruName) continue;

    const tr = document.createElement("tr");

    const en = employeesEN[ruName] || { name: ruName };
    const nameTd = document.createElement("td");
    nameTd.textContent = en.name;
    nameTd.style.padding = "4px 6px";
    nameTd.style.border = "1px solid #ccc";
    tr.appendChild(nameTd);

    for (let c = 1; c < headerRow.length; c++) {
      const date = parseDate(headerRow[c]);
      if (date && date >= start && date <= end) {
        const val = csvData[r][c];
        const td = document.createElement("td");
        td.textContent = val;
        td.style.textAlign = "center";
        td.style.padding = "4px 6px";
        td.style.border = "1px solid #ccc";

        if (val === "1") td.style.backgroundColor = "#a6e6a6";
        else if (val === "0") td.style.backgroundColor = "#f0f0f0";
        else if (val === "VR") td.style.backgroundColor = "#ffd966";
        else if (val === "Б") td.style.backgroundColor = "#ff9999";

        tr.appendChild(td);
      }
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  document.body.appendChild(table);

  html2canvas(table, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true
  }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "schedule.png";
    link.click();
    table.remove();
  });
}

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", async () => {
  await loadSchedule();
  document.getElementById("generateBtn").onclick = generateSalary;
  document.getElementById("sendSalaryToTelegram").onclick = sendSalary;
  document.getElementById("downloadImageBtn").onclick = generateScheduleImage;
});
