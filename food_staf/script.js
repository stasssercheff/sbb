document.addEventListener("DOMContentLoaded", () => {
  const chat_id = "-1002393080811";
  const worker_url = "https://shbb1.stassser.workers.dev/";

  const currentDateEl = document.getElementById("current-date");
  const checklistContainer = document.getElementById("week-checklist");
  const commentField = document.getElementById("comment_supliers");
  const generateBtn = document.getElementById("generateBtn");
  const sendBtn = document.getElementById("sendBtn");

  const daySel = document.getElementById("start-day");
  const monthSel = document.getElementById("start-month");
  const countSel = document.getElementById("days-count");

  // ==== Текущая дата ====
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}`;
  currentDateEl.textContent = todayStr;

  // ==== Создание опций ====
  function createSelect(options) {
    const sel = document.createElement("select");
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
    sel.value = "-";
    return sel;
  }

  // ==== Генерация недельных блоков ====
  function generateChecklist() {
    const day = parseInt(daySel.value);
    const month = parseInt(monthSel.value);
    const count = parseInt(countSel.value);

    if (!day || !month) {
      alert("⚠ Выберите дату и месяц");
      return;
    }

    checklistContainer.innerHTML = "";

    const baseDate = new Date(now.getFullYear(), month - 1, day);
    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;

      const block = document.createElement("div");
      block.className = "checklist-day";
      block.innerHTML = `
        <div class="date-label"><b>${dateStr}</b></div>
        <div class="meal"><span>Утро:</span></div>
        <div class="meal"><span>Вечер:</span></div>
        <div class="meal"><span>Ночь:</span></div>
      `;

      const selects = block.querySelectorAll(".meal");
      selects[0].appendChild(createSelect(["-", 1, 2, 3, 4, 5, 6, 7, 8]));
      selects[1].appendChild(createSelect(["-", 1, 2, 3, 4, 5, 6, 7, 8]));
      selects[2].appendChild(createSelect(["-", 1, 2]));

      checklistContainer.appendChild(block);
    }

    restoreFromStorage();
    saveToStorage();
  }

  // ==== Сохранение ====
  function saveToStorage() {
    const data = {
      comment: commentField.value,
      checklist: []
    };

    document.querySelectorAll(".checklist-day").forEach((dayBlock) => {
      const date = dayBlock.querySelector(".date-label b").textContent;
      const selects = dayBlock.querySelectorAll("select");
      data.checklist.push({
        date,
        morning: selects[0].value,
        evening: selects[1].value,
        night: selects[2].value
      });
    });

    localStorage.setItem("weekChecklist", JSON.stringify(data));
  }

  // ==== Восстановление ====
  function restoreFromStorage() {
    const saved = localStorage.getItem("weekChecklist");
    if (!saved) return;
    const data = JSON.parse(saved);

    if (data.comment) commentField.value = data.comment;

    const dayBlocks = document.querySelectorAll(".checklist-day");
    data.checklist.forEach((savedDay, idx) => {
      const block = dayBlocks[idx];
      if (!block) return;
      const selects = block.querySelectorAll("select");
      selects[0].value = savedDay.morning || "-";
      selects[1].value = savedDay.evening || "-";
      selects[2].value = savedDay.night || "-";
    });
  }

  // ==== Формирование сообщения ====
  function buildMessage() {
    const saved = JSON.parse(localStorage.getItem("weekChecklist") || "{}");
    if (!saved.checklist?.length) return null;

    let msg = `🧾 <b>Чеклист недели</b>\n\n📅 Дата отправки: ${todayStr}\n\n`;
    saved.checklist.forEach((d) => {
      const { date, morning, evening, night } = d;
      if (morning === "-" && evening === "-" && night === "-") return;
      msg += `${date}\n`;
      if (morning !== "-") msg += `утро - ${morning}\n`;
      if (evening !== "-") msg += `вечер - ${evening}\n`;
      if (night !== "-") msg += `ночь - ${night}\n`;
      msg += "\n";
    });

    if (saved.comment?.trim()) {
      msg += `💬 Комментарий:\n${saved.comment.trim()}`;
    }
    return msg.trim();
  }

  // ==== Отправка ====
  async function sendMessage(msg) {
    const res = await fetch(worker_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text: msg, parse_mode: "HTML" })
    });
    return res.json();
  }

  sendBtn.addEventListener("click", async () => {
    const msg = buildMessage();
    if (!msg) return alert("⚠ Нет данных для отправки");

    await sendMessage(msg);
    alert("✅ Отправлено!");

    localStorage.removeItem("weekChecklist");
    checklistContainer.innerHTML = "";
    commentField.value = "";
  });

  // ==== Слушатели ====
  generateBtn.addEventListener("click", generateChecklist);
  commentField.addEventListener("input", saveToStorage);
  checklistContainer.addEventListener("change", saveToStorage);
});

function goHome() {
  location.href = "http://stasssercheff.github.io/shbb/";
}

function goBack() {
  const currentPath = window.location.pathname;
  const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
  const upperPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
  window.location.href = upperPath + "/index.html";
}
