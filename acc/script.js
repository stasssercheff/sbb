// =============================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =============================
window.lang = "ru";
window.translations = {};
let staffManualAdjustments = {}; // корректировки вручную


// =============================
// ЗАГРУЗКА GOOGLE SHEETS
// =============================
async function loadSchedule() {
  const url =
    "https://opensheet.elk.sh/1CH8GI2Pp6qMY6Lx0tiTqEukdYTJpMdNSV7ncIiVKHwA/salary";

  const res = await fetch(url);
  const data = await res.json();
  window.scheduleRaw = data;
}

// =============================
// ФУНКЦИЯ Т (ПЕРЕВОД)
// =============================
window.t = function (key) {
  if (!window.translations || !key) return key;
  const node = window.translations[key];
  if (!node) return key;
  const lang = window.lang || "ru";
  return node[lang] ?? node["ru"] ?? Object.values(node)[0] ?? key;
};


// =============================
// ПРЕОБРАЗОВАНИЕ ТАБЛИЦЫ
// =============================
function processSalary(startDay, endDay) {
  const rows = window.scheduleRaw;
  const summary = {};

  rows.forEach((row) => {
    const day = Number(row.day);
    if (day < startDay || day > endDay) return;

    const name = row.name;
    if (!summary[name]) {
      summary[name] = {
        shifts: 0,
        tip: 0,
        bonus: 0,
        total: 0,
      };
    }

    summary[name].shifts += Number(row.shift || 0);
    summary[name].tip += Number(row.tip || 0);
    summary[name].bonus += Number(row.bonus || 0);
  });

  // применяем корректировки
  for (const name in staffManualAdjustments) {
    if (!summary[name]) {
      summary[name] = { shifts: 0, tip: 0, bonus: 0, total: 0 };
    }
    const adj = staffManualAdjustments[name];
    summary[name].manual = adj; // сумма + комментарий
  }

  // итог
  for (const name in summary) {
    const s = summary[name];
    s.total =
      s.shifts * 100 +
      s.tip +
      s.bonus +
      (s.manual ? Number(s.manual.amount) : 0);
  }

  return summary;
}


// =============================
// ВВОД КОРРЕКТИРОВКИ
// =============================
function askManualAdjustment(name) {
  const amount = prompt(`Корректировка для ${name} (плюс или минус):`, "0");
  if (amount === null) return; // отмена

  const comment = prompt("Причина корректировки (по желанию):", "");

  staffManualAdjustments[name] = {
    amount: Number(amount),
    comment: comment
  };

  generateSummary(); // обновить вывод
}


// =============================
// ОТОБРАЖЕНИЕ НА СТРАНИЦЕ (ТЕКСТ, НЕ ТАБЛИЦА)
// =============================
function renderSalarySummary(start, end, summary) {
  let html = `<div class="salary-text">`;

  html += `<div><b>Период:</b> ${start}-${end}</div><br>`;

  for (const name in summary) {
    const s = summary[name];

    html += `
      <div class="person-block">
        <b>${name}</b><br>
        Смены: ${s.shifts}<br>
        Чаевые: ${s.tip}<br>
        Бонусы: ${s.bonus}<br>
    `;

    if (s.manual) {
      html += `
        Корректировка: ${s.manual.amount} <br>
        ${s.manual.comment ? `Причина: ${s.manual.comment}<br>` : ""}
      `;
    }

    html += `<b>Итого: ${s.total}</b><br>`;

    // кнопка корректировок
    html += `
      <button onclick="askManualAdjustment('${name}')">Корректировка</button>
      <hr>
    `;
  }

  html += `</div>`;
  document.getElementById("salarySummary").innerHTML = html;
}


// =============================
// ТГ — ОТПРАВКА ТЕКСТОМ (ВЕРТИКАЛЬНО)
// =============================
function buildTelegramMessage(start, end, summary) {
  let msg = `Период: ${start}-${end}\n\n`;

  for (const name in summary) {
    const s = summary[name];

    msg += `${name}\n`;
    msg += `Смены: ${s.shifts}\n`;
    msg += `Чаевые: ${s.tip}\n`;
    msg += `Бонусы: ${s.bonus}\n`;

    if (s.manual) {
      msg += `Корректировка: ${s.manual.amount}\n`;
      if (s.manual.comment) msg += `Причина: ${s.manual.comment}\n`;
    }

    msg += `ИТОГО: ${s.total}\n`;
    msg += `----------------------\n`;
  }

  return msg;
}

async function sendSalaryToTelegram(start, end, summary) {
  const message = buildTelegramMessage(start, end, summary);

  fetch(window.sendConfig.salaryURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}


// =============================
// ГЕНЕРАЦИЯ ОТЧЁТА
// =============================
async function generateSummary() {
  const year = Number(document.getElementById("yearSelect").value);
  const month = Number(document.getElementById("monthSelect").value);
  const half = Number(document.getElementById("halfSelect").value);

  const start = half === 1 ? 1 : 16;
  const end = half === 1 ? 15 : new Date(year, month + 1, 0).getDate();

  const summary = processSalary(start, end);
  renderSalarySummary(start, end, summary);

  window.currentSummary = summary;
  window.currentPeriod = { start, end };
}


// =============================
// ИНИЦИАЛИЗАЦИЯ
// =============================
document.getElementById("generateBtn").onclick = generateSummary;

document.getElementById("sendSalaryToTelegram").onclick = () => {
  if (!window.currentSummary) return alert("Сначала сформируйте расчёт!");
  sendSalaryToTelegram(window.currentPeriod.start, window.currentPeriod.end, window.currentSummary);
};

loadSchedule();
