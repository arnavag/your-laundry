import {
  auth, db, isStaffUser, emailToId, createPicker,
  CODE_PREFIX, STATUSES, STATUS_LABELS, DAYS_TO_RETURN,
  todayText, addDays, showDate, formatDate, parseDate,
  esc, itemsText, itemsListHTML, badgeHTML, trackerHTML, photoHTML, toast, setupTheme,
} from "./common.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let staffId;
let allOrders = [];
let allComplaints = [];
let orderFilter = "Active";
let complaintFilter = "Open";
let openCode = null;
let shownStatus = null;
let shownReturn = null;

setupTheme(document.getElementById("themeToggle"));
document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  if (!isStaffUser(user)) {
    location.href = "student.html";
    return;
  }
  staffId = emailToId(user.email);
  document.getElementById("staffInfo").textContent = "Logged in as " + staffId;
  startPage();
});

function startPage() {
  onSnapshot(collection(db, "orders"), (snapshot) => {
    allOrders = snapshot.docs
      .map((d) => ({ code: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);
    showStats();
    showOrders();

    if (openCode) {
      const order = allOrders.find((o) => o.code === openCode);
      if (!order || order.status !== shownStatus || order.returnDate !== shownReturn) openOrder(openCode);
    }
  }, showLoadError);

  onSnapshot(collection(db, "complaints"), (snapshot) => {
    allComplaints = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);
    showStats();
    showComplaints();
  }, showLoadError);
}

function showLoadError(error) {
  console.error(error);
  document.getElementById("orders").innerHTML =
    '<p class="error">Could not load the data. Please refresh the page.</p>';
}

function setupTabs(id, onPick) {
  const tabs = document.querySelectorAll(`#${id} .tab`);
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      onPick(tab.dataset.filter);
    });
  });
}

function nextStatus(status) {
  return STATUSES[STATUSES.indexOf(status) + 1];
}

function moveToNext(order) {
  return updateDoc(doc(db, "orders", order.code), { status: nextStatus(order.status) });
}

function showStats() {
  const count = (status) => allOrders.filter((o) => o.status === status).length;
  const openComplaints = allComplaints.filter((c) => c.status === "Open").length;

  document.getElementById("stats").innerHTML = `
    <div class="stat"><b>${count("Submitted")}</b><span>Waiting at desk</span></div>
    <div class="stat"><b>${count("Confirmed") + count("Washing")}</b><span>In laundry</span></div>
    <div class="stat"><b>${count("Ready")}</b><span>Ready to collect</span></div>
    <div class="stat ${openComplaints ? "stat-bad" : ""}"><b>${openComplaints}</b><span>Open complaints</span></div>
  `;
}

document.getElementById("findForm").addEventListener("submit", (event) => {
  event.preventDefault();
  openOrder(document.getElementById("findCode").value);
});

async function openOrder(typed) {
  let code = typed.trim().toUpperCase();
  if (/^\d+$/.test(code)) code = CODE_PREFIX + "-" + code;

  const message = document.getElementById("findMessage");
  const panel = document.getElementById("orderPanel");
  message.textContent = "";
  panel.innerHTML = "";

  const snap = await getDoc(doc(db, "orders", code));
  if (!snap.exists()) {
    message.textContent = `No laundry found with the code ${code}.`;
    openCode = null;
    return;
  }
  const order = { code: snap.id, ...snap.data() };
  openCode = order.code;
  shownStatus = order.status;
  shownReturn = order.returnDate;

  const header = `
    <div class="current-top">
      <div>
        <div class="big-code">${esc(order.code)}</div>
        <div><b>${esc(order.name)}</b> · ${esc(order.collegeId)}</div>
      </div>
      ${badgeHTML(order.status)}
    </div>`;

  if (order.status === "Submitted") {
    panel.innerHTML = `
      ${header}
      <p class="note">Count the clothes. If anything doesn't match, change the numbers below, then confirm.</p>
      <div id="deskPicker"></div>
      <p id="confirmMessage" class="error"></p>
      <button type="button" id="confirmBtn" class="btn btn-green">
        Confirm and Receive (ready on ${showDate(addDays(todayText(), DAYS_TO_RETURN))})
      </button>`;

    const picker = createPicker(document.getElementById("deskPicker"));
    picker.setItems(order.items);

    document.getElementById("confirmBtn").addEventListener("click", async () => {
      const counts = picker.getCounts();
      if (counts.big + counts.small === 0) {
        document.getElementById("confirmMessage").textContent = "Please add at least one item.";
        return;
      }
      const today = todayText();
      await updateDoc(doc(db, "orders", order.code), {
        items: picker.getItems(),
        bigCount: counts.big,
        smallCount: counts.small,
        status: "Confirmed",
        givenDate: today,
        returnDate: addDays(today, DAYS_TO_RETURN),
        confirmedBy: staffId,
      });
      toast(`${order.code} has been received.`, "good");
      openOrder(order.code);
    });
    return;
  }

  const next = nextStatus(order.status);
  panel.innerHTML = `
    ${header}
    ${trackerHTML(order.status)}
    <p>Given: <b>${showDate(order.givenDate)}</b> · Return: <b>${showDate(order.returnDate)}</b>
      ${order.confirmedBy ? `<br><span class="muted small">Received by ${esc(order.confirmedBy)}</span>` : ""}</p>
    ${itemsListHTML(order.items)}
    ${next ? `<button type="button" id="nextBtn" class="btn btn-primary">Mark as ${STATUS_LABELS[next]}</button>` : ""}`;

  if (next) {
    document.getElementById("nextBtn").addEventListener("click", async () => {
      await moveToNext(order);
      openOrder(order.code);
    });
  }

  if (order.status !== "Collected") {
    panel.insertAdjacentHTML("beforeend", `
      <div class="date-row">
        <label>Change return date
          <input type="date" id="returnInput" value="${toInputDate(order.returnDate)}">
        </label>
        <button type="button" id="saveDateBtn" class="btn btn-light-outline">Save Date</button>
      </div>`);

    document.getElementById("saveDateBtn").addEventListener("click", async () => {
      const value = document.getElementById("returnInput").value;
      if (!value) return;
      const newDate = formatDate(new Date(value + "T00:00"));
      await updateDoc(doc(db, "orders", order.code), { returnDate: newDate });
      toast(`Return date changed to ${newDate}.`, "good");
    });
  }
}

function toInputDate(dateText) {
  const d = parseDate(dateText);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

setupTabs("orderTabs", (filter) => {
  orderFilter = filter;
  showOrders();
});

document.getElementById("search").addEventListener("input", showOrders);

function showOrders() {
  const box = document.getElementById("orders");
  const search = document.getElementById("search").value.trim().toLowerCase();

  let list = allOrders;
  if (orderFilter === "Active") list = list.filter((o) => o.status !== "Collected");
  if (search) {
    list = list.filter((o) => [o.code, o.name, o.collegeId, o.email].join(" ").toLowerCase().includes(search));
  }

  if (list.length === 0) {
    box.innerHTML = '<p class="muted">No laundry to show.</p>';
    return;
  }

  const rows = list.map((order) => {
    const next = nextStatus(order.status);
    let button = "";
    if (order.status === "Submitted") {
      button = `<button type="button" class="btn btn-small btn-green" data-open="${order.code}">Count and Confirm</button>`;
    } else if (next) {
      button = `<button type="button" class="btn btn-small btn-primary" data-next="${order.code}">Mark as ${STATUS_LABELS[next]}</button>`;
    }
    return `
      <tr>
        <td><a href="#" data-open="${order.code}"><b>${order.code}</b></a></td>
        <td>${esc(order.name)}<br><span class="muted">${esc(order.collegeId)}</span></td>
        <td>${badgeHTML(order.status)}</td>
        <td>${showDate(order.returnDate)}</td>
        <td class="clothes-cell">${esc(itemsText(order.items))}</td>
        <td>${button}</td>
      </tr>`;
  }).join("");

  box.innerHTML = `
    <div class="table-wrap">
      <table>
        <tr><th>Code</th><th>Student</th><th>Status</th><th>Return</th><th>Clothes</th><th></th></tr>
        ${rows}
      </table>
    </div>`;

  box.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      openOrder(el.dataset.open);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  box.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => moveToNext(allOrders.find((o) => o.code === btn.dataset.next)));
  });
}

setupTabs("complaintTabs", (filter) => {
  complaintFilter = filter;
  showComplaints();
});

function showComplaints() {
  const box = document.getElementById("complaints");
  const list = complaintFilter === "Open" ? allComplaints.filter((c) => c.status === "Open") : allComplaints;

  if (list.length === 0) {
    box.innerHTML = '<p class="muted">No complaints.</p>';
    return;
  }

  box.innerHTML = list.map((c) => `
    <div class="complaint">
      <div class="complaint-top">
        <span><b>${esc(c.type)}: ${esc(c.cloth)}</b> · ${esc(c.orderCode)}</span>
        <span class="badge badge-${c.status.toLowerCase()}">${c.status}</span>
      </div>
      <div class="muted">${esc(c.name)} (${esc(c.collegeId)})</div>
      <p>${esc(c.description)}</p>
      ${photoHTML(c.photo)}
      ${c.status === "Open"
        ? `<textarea rows="2" placeholder="Write a reply to the student" data-reply="${c.id}"></textarea>
           <button type="button" class="btn btn-small btn-green" data-resolve="${c.id}">Reply and Resolve</button>`
        : `<p class="note good"><b>Reply:</b> ${esc(c.reply)}</p>`}
    </div>`).join("");

  box.querySelectorAll("[data-resolve]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reply = box.querySelector(`[data-reply="${btn.dataset.resolve}"]`).value.trim();
      if (!reply) {
        toast("Please write a reply first.");
        return;
      }
      updateDoc(doc(db, "complaints", btn.dataset.resolve), { reply: reply, status: "Resolved" });
    });
  });
}
