// ======================
// НАСТРОЙКИ TELEGRAM
// ======================
const TELEGRAM_TOKEN = "PASTE_YOUR_BOT_TOKEN_HERE";
const TELEGRAM_CHAT_ID = 495064227;

// ======================
// ОТОБРАЖЕНИЕ ДАТЫ (UI язык)
// ======================
document.addEventListener("DOMContentLoaded", () => {
    const dateEl = document.getElementById("current-date");
    if (!dateEl) return;

    const today = new Date();
    const savedLang = localStorage.getItem("lang") || "ru";

    const locales = {
        ru: "ru-RU",
        en: "en-US",
        vi: "vi-VN"
    };

    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    };

    dateEl.textContent = today.toLocaleDateString(
        locales[savedLang] || "ru-RU",
        options
    );
});

// ======================
// НАВИГАЦИЯ
// ======================
function goHome() {
    location.href = "http://stasssercheff.github.io/shbb/";
}

function goBack() {
    const currentPath = window.location.pathname;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
    const upperPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
    window.location.href = upperPath + "/index.html";
}

// ======================
// ПОЛУЧЕНИЕ ГОТОВЫХ ДАННЫХ РАСЧЁТА
// ⚠️ НИЧЕГО НЕ СЧИТАЕМ — ТОЛЬКО БЕРЁМ
// ======================
function getCalculationData() {
    // ⬇️ здесь ТВОИ уже существующие данные
    // Я не меняю логику — только читаю результат

    return {
        employee: document.getElementById("employee-name")?.value || "Unknown",
        position: document.getElementById("employee-role")?.value || "Unknown",
        hours: window.totalHours || 0,
        baseRate: window.baseRate || 0,
        adjustments: window.adjustments || [],
        total: window.totalSalary || 0,
        date: new Date().toLocaleDateString("en-GB")
    };
}

// ======================
// ФОРМИРОВАНИЕ ОТЧЁТА (EN ONLY)
// ======================
function buildTelegramReportEN(data) {
    let text = `📋 SALARY REPORT\n\n`;

    text += `Employee: ${data.employee}\n`;
    text += `Position: ${data.position}\n`;
    text += `Date: ${data.date}\n\n`;

    text += `Hours worked: ${data.hours}\n`;
    text += `Base rate: ${data.baseRate}\n\n`;

    if (data.adjustments.length > 0) {
        text += `Adjustments:\n`;
        data.adjustments.forEach(adj => {
            text += `- ${adj.name}: ${adj.value}\n`;
        });
        text += `\n`;
    }

    text += `TOTAL PAY: ${data.total}\n`;

    return text;
}

// ======================
// ОТПРАВКА В TELEGRAM (ЛИЧНО)
// ======================
function sendToTelegram() {
    const data = getCalculationData();
    const message = buildTelegramReportEN(data);

    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        })
    })
    .then(res => res.json())
    .then(result => {
        if (!result.ok) {
            console.error("Telegram error:", result);
            alert("Telegram sending failed");
        } else {
            alert("Report sent successfully");
        }
    })
    .catch(err => {
        console.error("Network error:", err);
        alert("Network error while sending");
    });
}

// ======================
// ПРИВЯЗКА К КНОПКЕ
// ======================
// <button onclick="sendToTelegram()">Send</button>
