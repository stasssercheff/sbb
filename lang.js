let currentLang = localStorage.getItem("lang") || "ru";
let translations = {};

const LANG_URL = "/sbb/lang.json";

// Загружаем словарь из JSON
async function loadTranslations() {
  try {
    const res = await fetch(LANG_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);

    translations = await res.json();
    switchLanguage(currentLang);
  } catch (e) {
    console.error("Не удалось загрузить lang.json:", e);
  }
}

function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang); // сохраняем только язык интерфейса

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (translations[key] && translations[key][lang]) {
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.setAttribute("placeholder", translations[key][lang]);
      } else {
        el.innerHTML = translations[key][lang];
      }
    }
  });

  // обновляем дату
  const dateEl = document.getElementById("current-date");
  if (dateEl) {
    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    dateEl.textContent = new Date().toLocaleDateString(
      translations.date_format?.[lang] || lang,
      options
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () =>
      switchLanguage(btn.dataset.lang)
    );
  });

  loadTranslations();
});
