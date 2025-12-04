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

const MANUAL_KEY = "salaryManualText_v1";

// ---------- helpers ----------
function loadManuals() {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to load manuals:", e);
    return {};
  }
}
function saveManuals(obj) {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn("Failed to save manuals:", e);
  }
}
function setManualText(worker, text) {
  const all = loadManuals();
  if (!text || String(text).trim() === "") {
    delete all[worker];
  } else {
    all[worker] = String(text);
  }
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

// ================== CSV helpers ==================
function cleanCell(cell) {
  if (!cell) return "";
  return String(cell)
    .replace(/\r/g, "")
    .replace(/^"|"$/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
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

// ================== load schedule ==================
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

// ================== calculate salary ==================
function calculateSalary(periodStart, periodEnd) {
  const summary = {};
  if (!csvData || !csvData.length) return summary;

  const headerRow = csvData[0];

  for (let r = 1; r < csvData.length; r++) {
    const rawWorker = csvData[r][0];
    const worker = rawWorker ? rawWorker.trim() : "";
    if (!worker) continue;

    for (let c = 1; c < headerRow.length; c++) {
      const date = parseDate(headerRow[c]);
      if (!date) continue;
      if (date >= periodStart && date <= periodEnd) {
        const shift = (csvData[r][c] || "").trim();
        if (shift === "1") {
          if (!summary[worker]) summary[worker] = { shifts: 0, rate: (employeesRU[worker] && employeesRU[worker].rate) || 0, total: 0 };
          summary[worker].shifts++;
          summary[worker].total += (employeesRU[worker] && employeesRU[worker].rate) || 0;
        }
      }
    }
  }

  const manuals = loadManuals();
  Object.keys(manuals).forEach(worker => {
    const text = manuals[worker];
    const amount = parseManualAmount(text);
    if (summary[worker]) {
      summary[worker].manualText = text;
      summary[worker].manualAmount = amount;
      summary[worker].total = Number(summary[worker].total || 0) + Number(amount || 0);
    } else {
      if (text.trim() !== "") {
        const rate = (employeesRU[worker] && employeesRU[worker].rate) || 0;
        summary[worker] = {
          shifts: 0,
          rate,
          total: Number(amount || 0),
          manualText: text,
          manualAmount: amount
        };
      }
    }
  });

  Object.keys(summary).forEach(w => {
    summary[w].shifts = summary[w].shifts || 0;
    summary[w].rate = summary[w].rate || 0;
    summary[w].total = Number(summary[w].total) || 0;
    summary[w].manualText = summary[w].manualText || "";
    summary[w].manualAmount = Number(summary[w].manualAmount || 0);
  });

  return summary;
}

// ================== formatting ==================
function formatSalaryMessageEN(start, end, summary) {
  let msg = `Salary report for the period ${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}\n\n`;
  let grand = 0;

  const names = Object.keys(summary).sort((a,b) => {
    const A = (employeesEN[a] && employeesEN[a].name) || a;
    const B = (employeesEN[b] && employeesEN[b].name) || b;
    return A.localeCompare(B, 'en');
  });

  names.forEach(w => {
    const s = summary[w];
    const en = employeesEN[w] || { name: w, position: "" };
    let line = `${en.name} ${en.position ? "(" + en.position + ")" : ""} — ${s.total}`;
    if (s.manualText) line += ` (${s.manualText})`;
    msg += line + "\n";
    grand += Number(s.total) || 0;
  });

  msg += `\nTotal payout: ${grand}`;
  return msg;
}

function formatSalaryMessageRU(start, end, summary) {
  let msg = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\n\n`;
  let total = 0;
  const names = Object.keys(summary).sort((a,b) => a.localeCompare(b, 'ru'));
  names.forEach(w => {
    const s = summary[w];
    const pos = (employeesRU[w] && employeesRU[w].position) || "";
    let line = `${w} ${pos ? "(" + pos + ")" : ""} — ${s.total}`;
    if (s.manualText) line += ` (${s.manualText})`;
    msg += line + "\n";
    total += Number(s.total) || 0;
  });
  msg += `\nИтого к выплате: ${total}`;
  return msg;
}

// ================== render summary (COMPACT) ==================
function renderSalarySummary(start, end, summary) {
  const container = document.getElementById("salarySummary");
  container.innerHTML = "";

  const heading = document.createElement("div");
  heading.textContent = `ЗП за период ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "4px";
  container.appendChild(heading);

  // actions
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "6px";
  actions.style.marginBottom = "6px";

  const regen = document.createElement("button");
  regen.textContent = "Regenerate";
  regen.addEventListener("click", () => {
    const newSummary = calculateSalary(start, end);
    renderSalarySummary(start, end, newSummary);
  });
  actions.appendChild(regen);

  const copyEN = document.createElement("button");
  copyEN.textContent = "Copy EN";
  copyEN.addEventListener("click", () => {
    const txt = formatSalaryMessageEN(start, end, summary);
    navigator.clipboard?.writeText(txt)
      .then(() => alert("English report copied"))
      .catch(() => prompt("Copy manually:", txt));
  });
  actions.appendChild(copyEN);

  const copyRU = document.createElement("button");
  copyRU.textContent = "Copy RU";
  copyRU.addEventListener("click", () => {
    const txt = formatSalaryMessageRU(start, end, summary);
    navigator.clipboard?.writeText(txt)
      .then(() => alert("Русский отчёт скопирован"))
      .catch(() => prompt("Скопируйте вручную:", txt));
  });
  actions.appendChild(copyRU);

  container.appendChild(actions);

  // compact list
  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "6px";
  list.style.marginBottom = "8px";

  const namesSet = new Set([...Object.keys(summary), ...Object.keys(employeesRU)]);
  const names = Array.from(namesSet).sort((a,b) => a.localeCompare(b, 'ru'));

  names.forEach(name => {
    const s = summary[name] || { shifts: 0, rate: (employeesRU[name] && employeesRU[name].rate) || 0, total: 0, manualText: "", manualAmount: 0 };
    const pos = (employeesRU[name] && employeesRU[name].position) || "";

    const block = document.createElement("div");
    block.style.padding = "5px 6px";
    block.style.border = "1px solid #ccc";
    block.style.borderRadius = "4px";
    block.style.background = "#f5f5f5";
    block.style.lineHeight = "1.2";

    block.innerHTML = `
      <div style="font-weight:600; margin-bottom:2px;">${name} ${pos ? "(" + pos + ")" : ""}</div>
      <div>Смен: ${s.shifts}</div>
      <div>Ставка: ${s.rate}</div>
      <div>К выплате: <b>${s.total}</b>${s.manualText ? ` (${s.manualText})` : ''}</div>
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.value = getManualText(name);
    input.placeholder = "-300 аванс или +500";
    input.style.width = "100%";
    input.style.marginTop = "4px";
    input.style.boxSizing = "border-box";
    input.style.padding = "2px 4px";
    input.style.fontSize = "13px";

    input.addEventListener("change", (e) => {
      const val = e.target.value;
      setManualText(name, val);
      const newSummary = calculateSalary(start, end);
      renderSalarySummary(start, end, newSummary);
    });

    block.appendChild(input);
    list.appendChild(block);
  });

  container.appendChild(list);

  // grand total
  let grand = 0;
  Object.values(summary).forEach(s => grand += Number(s.total) || 0);
  const totalDiv = document.createElement("div");
  totalDiv.style.marginTop = "4px";
  totalDiv.style.fontWeight = "700";
  totalDiv.textContent = `Итого к выплате: ${grand}`;
  container.appendChild(totalDiv);

  const note = document.createElement("div");
  note.style.marginTop = "4px";
  note.style.fontSize = "12px";
  note.innerHTML = `<i>Ручные корректировки сохраняются локально в браузере.</i>`;
  container.appendChild(note);
}

// ================== generate action ==================
function generateSalary() {
  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  const halfSelect = document.getElementById("halfSelect");

  const month = +monthSelect.value;
  const half = halfSelect.value;
  const year = +yearSelect.value || new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  renderSalarySummary(start, end, summary);
}

// ================== generate schedule image ==================
function generateScheduleImage(callback = null) {
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;
  const year = new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const headerRow = csvData[0] || [];
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
    const ruName = (csvData[r][0] || "").trim();
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

// ================== send to Telegram ==================
async function sendSalary() {
  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  const halfSelect = document.getElementById("halfSelect");

  const month = +monthSelect.value;
  const half = halfSelect.value;
  const year = +yearSelect.value || new Date().getFullYear();

  const start = half === "1" ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = half === "1" ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const summary = calculateSalary(start, end);
  const msgEN = formatSalaryMessageEN(start, end, summary);

  if (!msgEN.trim()) {
    alert("Please generate the salary first");
    return;
  }

  try {
    await fetch("https://shbb1.stassser.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "-1003149716465", text: msgEN })
    });
    alert("✅ Salary report sent");
  } catch (err) {
    console.error(err);
    alert("❌ Error sending salary report");
  }
}

// ================== START ==================
document.addEventListener("DOMContentLoaded", () => {
  const currentDateEl = document.getElementById("current-date");
  if (currentDateEl) currentDateEl.textContent = new Date().toLocaleDateString("ru-RU");

  (function() {
    const monthSelect = document.getElementById("monthSelect");
    const halfSelect = document.getElementById("halfSelect");
    const yearSelect = document.getElementById("yearSelect");
    if (!monthSelect || !halfSelect || !yearSelect) return;

    const now = new Date();
    monthSelect.value = now.getMonth();
    halfSelect.value = now.getDate() <= 15 ? "1" : "2";

    const yOpt = Array.from(yearSelect.options).find(o => +o.value === now.getFullYear());
    if (yOpt) yearSelect.value = now.getFullYear();
  })();

  loadSchedule().then(() => {
    const today = new Date();
    const table = document.getElementById("schedule");
    const headerRow = table.querySelector("thead tr") || table.querySelector("tbody tr");
    if (headerRow) {
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
    }

    generateSalary();
  });

  const genBtn = document.getElementById("generateBtn");
  if (genBtn) genBtn.addEventListener("click", generateSalary);

  const downloadBtn = document.getElementById("downloadImageBtn");
  if (downloadBtn) downloadBtn.addEventListener("click", generateScheduleImage);

  const sendBtn = document.getElementById("sendSalaryToTelegram");
  if (sendBtn) sendBtn.addEventListener("click", sendSalary);
});
