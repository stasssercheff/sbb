document.addEventListener("DOMContentLoaded", () => {
  const chat_id = "-1002393080811";
  const worker_url = "https://shbb1.stassser.workers.dev/";
  const sendBtn = document.getElementById("sendBtn");
  const weekContainer = document.getElementById("week-container");
  const daySelect = document.getElementById("daySelect");
  const monthSelect = document.getElementById("monthSelect");
  const comment = document.getElementById("comment");

  window.goHome = () => (location.href = "https://stasssercheff.github.io/shbb/");
  window.goBack = () => {
    const current = window.location.pathname;
    const parent = current.substring(0, current.lastIndexOf("/"));
    const upper = parent.substring(0, parent.lastIndexOf("/"));
    window.location.href = upper + "/index.html";
  };

  // === Селекторы даты ===
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    daySelect.appendChild(opt);
  }
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  }

  // === Текущая дата ===
  const currentDateEl = document.getElementById("current-date");
  const today = new Date();
  currentDateEl.textContent = today.toLocaleDateString("ru-RU");

  // === Создание пустых блоков недели сразу ===
  function generateWeekBlocks() {
    weekContainer.innerHTML = "";
    const startDate = new Date(today.getFullYear(), 0, 1); // просто для генерации видимых блоков

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

      const dayBlock = document.createElement("div");
      dayBlock.className = "checklist-item";
      dayBlock.innerHTML = `
        <div class="day-label">${dateStr}</div>
        <div class="selectors">
          <label data-i18n="morning"></label>
          ${buildEmptySelect(8)}
          <label data-i18n="evening"></label>
          ${buildEmptySelect(8)}
          <label data-i18n="night"></label>
          ${buildEmptySelect(2)}
        </div>
      `;
      weekContainer.appendChild(dayBlock);
    }

    if (typeof switchLanguage === "function" && typeof currentLang !== "undefined") {
      switchLanguage(currentLang);
    }

    restoreState();
  }

  function buildEmptySelect(max) {
    let html = `<select class="qty"><option value="">Выберите</option>`;
    for (let i = 1; i <= max; i++) html += `<option value="${i}">${i}</option>`;
    html += `</select>`;
    return html;
  }

  // === Сохранение и восстановление ===
  function saveState() {
    const data = [];
    document.querySelectorAll("#week-container .checklist-item").forEach(item => {
      const date = item.querySelector(".day-label").textContent;
      const selects = item.querySelectorAll("select");
      data.push({
        date,
        morning: selects[0].value,
        evening: selects[1].value,
        night: selects[2].value
      });
    });
    localStorage.setItem("checklist_week", JSON.stringify(data));
    localStorage.setItem("checklist_comment", comment.value);
  }

  function restoreState() {
    const saved = JSON.parse(localStorage.getItem("checklist_week") || "[]");
    comment.value = localStorage.getItem("checklist_comment") || "";

    if (!saved.length) return;
    document.querySelectorAll("#week-container .checklist-item").forEach((item, idx) => {
      const selects = item.querySelectorAll("select");
      if (saved[idx]) {
        selects[0].value = saved[idx].morning || "";
        selects[1].value = saved[idx].evening || "";
        selects[2].value = saved[idx].night || "";
      }
    });
  }

  daySelect.addEventListener("change", saveState);
  monthSelect.addEventListener("change", saveState);
  weekContainer.addEventListener("change", saveState);
  comment.addEventListener("input", saveState);

  // === Генерируем блоки сразу при загрузке ===
  generateWeekBlocks();

  // === Отправка ===
  async function sendMessage(msg) {
    await fetch(worker_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text: msg, parse_mode: "HTML" })
    });
  }

  sendBtn.addEventListener("click", async () => {
    const data = JSON.parse(localStorage.getItem("checklist_week") || "[]").filter(
      d => d.morning || d.evening || d.night
    );

    if (!data.length) return alert("⚠ Нет данных для отправки.");

    const sendLangs = window.sendLangs || ["ru"];
    const messages = sendLangs.map(lang => {
      let msg = `🧾 <b>${translations.weekly_checklist?.[lang] || "Чеклист"}</b>\n\n`;
      msg += `📅 ${translations.sending_date?.[lang] || "Дата"}: ${today.toLocaleDateString("ru-RU")}\n\n`;
      data.forEach(d => {
        msg += `${d.date}\n`;
        if (d.morning) msg += `${translations.morning?.[lang] || "Утро"} - ${d.morning}\n`;
        if (d.evening) msg += `${translations.evening?.[lang] || "Вечер"} - ${d.evening}\n`;
        if (d.night) msg += `${translations.night?.[lang] || "Ночь"} - ${d.night}\n`;
        msg += "\n";
      });
      if (comment.value.trim()) {
        msg += `💬 ${translations.comment?.[lang] || "Комментарий"}:\n${comment.value.trim()}`;
      }
      return msg;
    });

    for (const msg of messages) await sendMessage(msg);

    alert(translations.checklist_sent_success?.ru || "✅ Чеклист успешно отправлен!");
    localStorage.removeItem("checklist_week");
    localStorage.removeItem("checklist_comment");
    generateWeekBlocks();
  });
});
