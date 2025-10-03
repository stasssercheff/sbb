// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employeesRU = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Максим": { position: "Повар", rate: 650 },
  "Борис": { position: "Повар", rate: 600 },
  "Мигель": { position: "Повар", rate: 600 },
  "Ирина": { position: "Кондитер", rate: 650 },
  "Тимофей": { position: "Кондитер", rate: 650 }
};

const employeesEN = {
  "Стас": { name: "Stas", position: "Chef", rate: 1300 },
  "Максим": { name: "Maxim", position: "Cook", rate: 650 },
  "Борис": { name: "Boris", position: "Cook", rate: 600 },
  "Мигель": { name: "Miguel", position: "Cook", rate: 600 },
  "Ирина": { name: "Irina", position: "Pastry", rate: 650 },
  "Тимофей": { name: "Timofey", position: "Pastry", rate: 650 }
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
          if (!summary[worker]) summary[worker] = { shifts: 0, rate: employeesRU[worker].rate, total: 0 };
          summary[worker].shifts++;
          summary[worker].total += employeesRU[worker].rate;
        }
      }
    }
  }
  return summary;
}

// ================== ТЕКСТ ЗАРПЛАТЫ ==================
function formatSalaryMessageRU(start, end, summary) {
  let msg = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\n\n`;
  let total = 0;
  for (let w in summary) {
    const s = summary[w];
    msg += `${w} (${employeesRU[w].position})\nСмен: ${s.shifts}\nСтавка: ${s.rate}\nК выплате: ${s.total}\n\n`;
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
    const en = employeesEN[w];
    msg += `${en.name} (${en.position})\nShifts: ${s.shifts}\nRate: ${s.rate}\nTotal: ${s.total}\n\n`;
    total += s.total;
  }
  msg += `Total payout: ${total}`;
  return msg;
}

// ================== КНОПКИ ==================
function generateSalary() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  const msg = formatSalaryMessageRU(start, end, summary);
  document.getElementById("salarySummary").textContent = msg;
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
  table.style.backgroundColor = "#ffffff"; // белый фон
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

  loadSchedule();

  document.getElementById("generateBtn").addEventListener("click", generateSalary);
  document.getElementById("downloadImageBtn").addEventListener("click", generateScheduleImage);
  document.getElementById("sendSalaryToTelegram").addEventListener("click", sendSalary);
});
