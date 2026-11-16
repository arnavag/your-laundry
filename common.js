import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAuth, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, { persistence: browserSessionPersistence });
export const db = getFirestore(app);

export const CODE_PREFIX = "BU";
const COLLEGE_DOMAIN = "bennett.edu.in";
const STAFF_DOMAIN = "yourlaundry.app";
const STUDENT_ID = /^s\d{2}[a-z]+\d+$/;

export const BIG_CLOTHES = ["Shirt", "T-Shirt", "Pant", "Jeans", "Kurta", "Towel", "Bedsheet"];
export const SMALL_CLOTHES = ["Socks (pair)", "Handkerchief", "Undergarment", "Cap"];
export const BIG_LIMIT = 10;
export const SMALL_LIMIT = 5;
export const DAYS_TO_RETURN = 3;

export const STATUSES = ["Submitted", "Confirmed", "Washing", "Ready", "Collected"];
export const STATUS_LABELS = {
  Submitted: "Submitted",
  Confirmed: "Received at desk",
  Washing: "Washing",
  Ready: "Ready to collect",
  Collected: "Collected",
};

export function toLoginEmail(typed) {
  const text = typed.trim().toLowerCase();
  if (text.includes("@")) return text;
  if (STUDENT_ID.test(text)) return text + "@" + COLLEGE_DOMAIN;
  return text + "@" + STAFF_DOMAIN;
}

export function isCollegeEmail(email) {
  const [id, domain] = email.split("@");
  return STUDENT_ID.test(id) && domain === COLLEGE_DOMAIN;
}

export function isStaffUser(user) {
  return user.email.endsWith("@" + STAFF_DOMAIN);
}

export function emailToId(email) {
  return email.split("@")[0].toUpperCase();
}

export function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function parseDate(text) {
  const [a, b, c] = text.split(/[/-]/).map(Number);
  return text.includes("-") ? new Date(a, b - 1, c) : new Date(c, b - 1, a);
}

export function todayText() {
  return formatDate(new Date());
}

export function addDays(dateText, days) {
  const date = parseDate(dateText);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function showDate(dateText) {
  return dateText ? formatDate(parseDate(dateText)) : "-";
}

export function daysUntil(dateText) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((parseDate(dateText) - parseDate(todayText())) / oneDay);
}

export function dayCount(n) {
  return n === 1 ? "1 day" : `${n} days`;
}

export function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

export function itemsText(items) {
  return Object.entries(items)
    .map(([cloth, qty]) => `${cloth} × ${qty}`)
    .join(", ");
}

export function itemsListHTML(items) {
  const rows = Object.entries(items)
    .map(([cloth, qty]) => `<li>${esc(cloth)}: <b>${qty}</b></li>`)
    .join("");
  return `<ul class="items">${rows}</ul>`;
}

export function photoHTML(photo) {
  if (!photo || !photo.startsWith("data:image/")) return "";
  return `<img src="${esc(photo)}" alt="Photo of the cloth" class="photo">`;
}

export function badgeHTML(status) {
  return `<span class="badge badge-${status.toLowerCase()}">${STATUS_LABELS[status]}</span>`;
}

export function trackerHTML(status) {
  const current = STATUSES.indexOf(status);
  const steps = STATUSES.map((step, i) => {
    let state = "";
    if (i < current || status === "Collected") state = "done";
    else if (i === current) state = "current";
    return `
      <div class="step ${state}">
        <span class="dot">${state === "done" ? "✓" : i + 1}</span>
        <span class="step-label">${STATUS_LABELS[step]}</span>
      </div>`;
  });
  return `<div class="tracker">${steps.join("")}</div>`;
}

export function toast(message, type = "") {
  const box = document.createElement("div");
  box.className = "toast " + type;
  box.textContent = message;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}

export function setupTheme(toggle) {
  toggle.checked = localStorage.getItem("theme") === "dark";

  toggle.addEventListener("change", () => {
    const theme = toggle.checked ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  });
}

export function createPicker(container) {
  const quantities = {};

  container.innerHTML = `
    <h3>Big clothes <span class="counter big-counter"></span></h3>
    <div class="big-list"></div>
    <h3>Small clothes <span class="counter small-counter"></span></h3>
    <div class="small-list"></div>
  `;

  function addRows(list, listElement) {
    list.forEach((cloth) => {
      quantities[cloth] = 0;
      const row = document.createElement("div");
      row.className = "cloth-row";
      row.dataset.cloth = cloth;
      row.innerHTML = `
        <span>${cloth}</span>
        <span>
          <button type="button" class="minus" aria-label="Remove one ${cloth}">−</button>
          <span class="qty">0</span>
          <button type="button" class="plus" aria-label="Add one ${cloth}">+</button>
        </span>
      `;
      row.querySelector(".minus").addEventListener("click", () => change(cloth, -1));
      row.querySelector(".plus").addEventListener("click", () => change(cloth, 1));
      listElement.appendChild(row);
    });
  }

  function count(list) {
    return list.reduce((total, cloth) => total + quantities[cloth], 0);
  }

  function change(cloth, amount) {
    quantities[cloth] = Math.max(0, quantities[cloth] + amount);
    refresh();
  }

  function refresh() {
    const bigFull = count(BIG_CLOTHES) >= BIG_LIMIT;
    const smallFull = count(SMALL_CLOTHES) >= SMALL_LIMIT;

    container.querySelectorAll(".cloth-row").forEach((row) => {
      const cloth = row.dataset.cloth;
      row.querySelector(".qty").textContent = quantities[cloth];
      row.querySelector(".minus").disabled = quantities[cloth] === 0;
      row.querySelector(".plus").disabled = BIG_CLOTHES.includes(cloth) ? bigFull : smallFull;
    });

    const bigCounter = container.querySelector(".big-counter");
    bigCounter.textContent = `${count(BIG_CLOTHES)} / ${BIG_LIMIT}`;
    bigCounter.classList.toggle("full", bigFull);

    const smallCounter = container.querySelector(".small-counter");
    smallCounter.textContent = `${count(SMALL_CLOTHES)} / ${SMALL_LIMIT}`;
    smallCounter.classList.toggle("full", smallFull);
  }

  addRows(BIG_CLOTHES, container.querySelector(".big-list"));
  addRows(SMALL_CLOTHES, container.querySelector(".small-list"));
  refresh();

  return {
    getItems() {
      const items = {};
      for (const cloth in quantities) {
        if (quantities[cloth] > 0) items[cloth] = quantities[cloth];
      }
      return items;
    },
    getCounts() {
      return { big: count(BIG_CLOTHES), small: count(SMALL_CLOTHES) };
    },
    setItems(items) {
      for (const cloth in quantities) quantities[cloth] = items[cloth] || 0;
      refresh();
    },
  };
}
