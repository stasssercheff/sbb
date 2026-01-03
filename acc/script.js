// ======================
// CONFIG
// ======================
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

// ======================
// HELPERS
// ======================
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
  const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m2) return new Date(new Date().getFullYear(), +m2[2] - 1, +m2[1]);
  return null;
}

// ======================
// LOAD SCHEDULE
// ======================
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
        if (cell === "1") td.classList.add("shift-1");
        if (cell === "0") td.classList.add("shift-0");
        if (cell === "VR") td.classList.add("shift-VR");
        if (cell === "Б") td.classList.add("shift-Б");
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ======================
// SALARY CALC
// ======================
function calculateSalary(start, end) {
  const summary = {};
  const header = csvData[0];

  for (let r = 1; r < csvData.length; r++) {
    const name = csvData[r][0];
    if (!employeesRU[name]) continue;

    for (let c = 1; c < header.length; c++) {
      const d = parseDate(header[c]);
      if (!d || d < start || d > end) continue;
      if (csvData[r][c] === "1") {
        summary[name] ??= { shifts: 0, rate: employeesRU[name].rate, manualAmount: 0 };
        summary[name].shifts++;
      }
    }
  }

  const manuals = loadManuals();
  for (const w in summary) {
    summary[w].manualAmount = parseManualAmount(manuals[w]);
  }

  return summary;
}

// ======================
// MANUAL ADJUSTMENTS
// ======================
const MANUAL_KEY = "salaryManualText_v1";

function loadManuals() {
  try { return JSON.parse(localStorage.getItem(MANUAL_KEY)) || {}; }
  catch { return {}; }
}

function saveManuals(o) {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(o));
}

function parseManualAmount(t) {
  if (!t) return 0;
  const m = t.match(/([+-]?\d+)/);
  return m ? parseInt(m[1]) : 0;
}

// ======================
// RENDER SALARY (FIXED INPUT)
// ======================
function renderSalarySummary(start, end, summary) {
  const container = document.getElementById("salarySummary");
  container.innerHTML = "";

  const names = Object.keys(summary);

  const totalDiv = document.createElement("div");
  totalDiv.style.fontWeight = "700";

  names.forEach(name => {
    const s = summary[name];
    const div = document.createElement("div");
    div.style.border = "1px solid #ddd";
    div.style.padding = "8px";
    div.style.marginBottom = "8px";

    const info = document.createElement("div");
    info.style.whiteSpace = "pre-line";
    info.textContent =
      `${name} (${employeesRU[name].position})\n` +
      `Смен: ${s.shifts}\nСтавка: ${s.rate}`;
    div.appendChild(info);

    const totalLine = document.createElement("div");
    totalLine.style.marginTop = "4px";

    const input = document.createElement("input");
    input.type = "number";
    input.value = s.manualAmount || 0;
    input.style.width = "100px";

    const update = () => {
      s.manualAmount = parseInt(input.value) || 0;
      totalLine.textContent =
        (s.manualAmount ? `Корректировка: ${s.manualAmount}\n` : "") +
        `К выплате: ${s.shifts * s.rate + s.manualAmount}`;

      let sum = 0;
      names.forEach(n => {
        const sw = summary[n];
        sum += sw.shifts * sw.rate + (sw.manualAmount || 0);
      });
      totalDiv.textContent = `Итого к выплате: ${sum}`;
    };

    input.addEventListener("input", update);
    update();

    div.appendChild(totalLine);
    div.appendChild(input);
    container.appendChild(div);
  });

  container.appendChild(totalDiv);
}

// ======================
// AUTO SCROLL TO TODAY (FIXED)
// ======================
function scrollToToday() {
  const today = new Date();
  const header = document.querySelector("#schedule tbody tr");
  if (!header) return;

  const cells = header.children;
  let idx = 0;

  for (let i = 1; i < cells.length; i++) {
    const d = parseDate(cells[i].textContent);
    if (d && d >= today) {
      idx = i;
      break;
    }
  }

  const row = document.querySelector("#schedule tbody tr:nth-child(2)");
  if (row && row.children[idx]) {
    row.children[idx].scrollIntoView({ behavior: "smooth", inline: "center" });
  }
}

// ======================
// START
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  await loadSchedule();
  scrollToToday();

  document.getElementById("generateBtn")
    .addEventListener("click", () => {
      const m = +monthSelect.value;
      const h = halfSelect.value;
      const y = new Date().getFullYear();
      const s = h === "1" ? new Date(y, m, 1) : new Date(y, m, 16);
      const e = h === "1" ? new Date(y, m, 15) : new Date(y, m + 1, 0);
      renderSalarySummary(s, e, calculateSalary(s, e));
    });
});
