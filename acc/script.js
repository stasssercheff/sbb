// ================== КНОПКИ ==================
function generateSalary() {
  const year = +document.getElementById("yearSelect").value;
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;

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

function generateScheduleImage(sendToTelegram = false, callback = null) {
  const year = +document.getElementById("yearSelect").value;
  const month = +document.getElementById("monthSelect").value;
  const half = document.getElementById("halfSelect").value;

  let start, end;

  if (half === "1") {
    start = new Date(year, month, 1);
    end = new Date(year, month, 15);
  } else {
    start = new Date(year, month, 16);
    end = new Date(year, month + 1, 0);
  }

  const headerRow = csvData[0];
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");

  // заголовок
  const header = document.createElement("tr");
  const empty = document.createElement("td");
  empty.textContent = "Сотрудник";
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

  // строки сотрудников
  for (let r = 1; r < csvData.length; r++) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = csvData[r][0];
    tr.appendChild(tdName);

    for (let c = 1; c < headerRow.length; c++) {
      const date = parseDate(headerRow[c]);
      if (date && date >= start && date <= end) {
        const td = document.createElement("td");
        td.textContent = csvData[r][c];

        if (csvData[r][c] === "1") td.style.backgroundColor = "#d1e7dd"; // цвет для смены
        if (csvData[r][c] === "0") td.style.backgroundColor = "#f8d7da";
        if (csvData[r][c] === "VR") td.style.backgroundColor = "#fff3cd";
        if (csvData[r][c] === "Б") td.style.backgroundColor = "#cfe2ff";

        tr.appendChild(td);
      }
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  document.body.appendChild(table);

  html2canvas(table, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(async canvas => {
    if (sendToTelegram) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const formData = new FormData();
      formData.append("chat_id", "-1003149716465");
      formData.append("photo", blob, "schedule.png");

      try {
        await fetch("https://shbb1.stassser.workers.dev/", {
          method: "POST",
          body: formData
        });
      } catch (err) {
        console.error("Ошибка отправки PNG:", err);
      }
    } else {
      const link = document.createElement("a");
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = "schedule.png";
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
    table.remove();
    if (callback) callback();
  });
}

// ===== ОБЪЕДИНЕННАЯ ОТПРАВКА =====
async function sendSalaryAndSchedule() {
  const msg = document.getElementById("salarySummary").textContent;
  if (!msg.trim()) {
    alert("Сначала сформируйте ЗП");
    return;
  }

  try {
    // 1. Отправляем текст (ЗП)
    await fetch("https://shbb1.stassser.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "-1003149716465", text: msg })
    });

    // 2. Отправляем PNG
    await new Promise(resolve => {
      generateScheduleImage(true, resolve);
    });

    alert("✅ ЗП и график отправлены");
  } catch (err) {
    console.error(err);
    alert("❌ Ошибка при отправке");
  }
}

// ================== СТАРТ ==================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("current-date").textContent = new Date().toLocaleDateString("ru-RU");

  loadSchedule();

  document.getElementById("generateBtn").addEventListener("click", generateSalary);
  document.getElementById("downloadImageBtn").addEventListener("click", () => generateScheduleImage(false));
  document.getElementById("sendSalaryToTelegram").addEventListener("click", sendSalaryAndSchedule);
});
