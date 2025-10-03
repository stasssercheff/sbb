// script.js

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpNWtZImdMKoOxbV6McfEXEB67ck7nzA1EcBXNOFdnDTK4o9gniAuz82paEdGAyRSlo6dFKO9zCyLP/pub?gid=0&single=true&output=csv";

const employees = {
  "Стас": { position: "Шеф", rate: 1300 },
  "Максим": { position: "Повар", rate: 650 },
  "Борис": { position: "Повар", rate: 600 },
  "Повар": { position: "Повар", rate: 600 },
  "Ирина": { position: "Кондитер", rate: 650 },
  "Тимофей": { position: "Кондитер", rate: 650 }
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
  const parts = s.split(".");
  if (parts.length === 3) return new Date(+parts[2], +parts[1]-1, +parts[0]);
  return null;
}

// ================== ОТОБРАЖЕНИЕ ГРАФИКА ==================
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

        if (rIdx > 1) {
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
    console.error("Ошибка загрузки CSV:", err);
  }
}

// ================== РАСЧЁТ ЗАРПЛАТЫ ==================
function calculateSalary(periodStart, periodEnd) {
  const summary = {};

  for (let r = 2; r < csvData.length; r++) {
    const date = parseDate(csvData[r][0]);
    if (!date) continue;

    if (date >= periodStart && date <= periodEnd) {
      for (let c = 1; c < csvData[r].length; c++) {
        let worker = csvData[1][c].trim();
        if (!worker) worker = "Повар"; // пустые → "Повар"
        if (!employees[worker]) continue;

        if (csvData[r][c].trim() === "1") {
          if (!summary[worker]) summary[worker] = { shifts: 0, rate: employees[worker].rate, total: 0 };
          summary[worker].shifts++;
          summary[worker].total += employees[worker].rate;
        }
      }
    }
  }
  return summary;
}

function formatSalaryMessage(start, end, summary) {
  let msg = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\n\n`;
  let total = 0;
  for (let w in summary) {
    const s = summary[w];
    msg += `${w} (${employees[w].position})\nСмен: ${s.shifts}\nСтавка: ${s.rate}\nК выплате: ${s.total}\n\n`;
    total += s.total;
  }
  msg += `Итого к выплате: ${total}`;
  return msg;
}

// ================== КНОПКИ ==================
function generateSalary() {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;

  const year = new Date().getFullYear();
  let start, end;

  if (half === "1") {
    start = new Date(year, month, 1);
    end = new Date(year, month, 15);
  } else {
    start = new Date(year, month, 16);
    end = new Date(year, month + 1, 0);
  }

  const summary = calculateSalary(start, end);
  const msg = formatSalaryMessage(start, end, summary);
  document.getElementById("salarySummary").textContent = msg;
}

function generateScheduleImage() {
  const table = document.getElementById("schedule");
  html2canvas(table, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "schedule.png";
    link.click();
  });
}

async function sendSalaryMessage() {
  const msg = document.getElementById("salarySummary").textContent;
  if (!msg.trim()) {
    alert("Сначала сформируйте ЗП");
    return;
  }

  try {
    await fetch("https://shbb1.stassser.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "-1003149716465", text: msg })
    });
    alert("✅ ЗП отправлена");
  } catch (err) {
    console.error(err);
    alert("❌ Ошибка отправки");
  }
}

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("current-date").textContent = new Date().toLocaleDateString("ru-RU");

  loadSchedule();

  document.getElementById("generateBtn").addEventListener("click", generateSalary);
  document.getElementById("downloadImageBtn").addEventListener("click", generateScheduleImage);
  document.getElementById("sendSalaryToTelegram").addEventListener("click", sendSalaryMessage);
});
