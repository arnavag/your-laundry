import {
  auth, db, isStaffUser, emailToId, createPicker, CODE_PREFIX,
  showDate, daysUntil, dayCount,
  esc, itemsText, itemsListHTML, badgeHTML, trackerHTML, photoHTML, toast, setupTheme,
} from "./common.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, setDoc, deleteDoc, addDoc, query, where, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let user;
let profile;
let picker;
let myOrders = [];

setupTheme(document.getElementById("themeToggle"));
document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (loggedInUser) => {
  if (!loggedInUser) {
    location.href = "index.html";
    return;
  }
  if (isStaffUser(loggedInUser)) {
    location.href = "admin.html";
    return;
  }
  user = loggedInUser;

  const snap = await getDoc(doc(db, "users", user.uid));
  profile = snap.exists() ? snap.data() : { name: "Student", collegeId: emailToId(user.email) };
  document.getElementById("userName").textContent = profile.name;
  document.getElementById("userId").textContent = profile.collegeId;

  startPage();
});

function startPage() {
  picker = createPicker(document.getElementById("picker"));

  onSnapshot(query(collection(db, "orders"), where("uid", "==", user.uid)), (snapshot) => {
    myOrders = snapshot.docs
      .map((d) => ({ code: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);

    showCurrent();
    showHistory();
    fillHelpOrders();
  }, showLoadError);

  onSnapshot(query(collection(db, "complaints"), where("uid", "==", user.uid)), (snapshot) => {
    const complaints = snapshot.docs.map((d) => d.data()).sort((a, b) => b.createdAt - a.createdAt);
    showComplaints(complaints);
  }, showLoadError);
}

function showLoadError(error) {
  console.error(error);
  document.getElementById("current").innerHTML =
    '<p class="error">Could not load your data. Please refresh the page.</p>';
}

function activeOrder() {
  return myOrders.find((order) => order.status !== "Collected");
}

function showCurrent() {
  const box = document.getElementById("current");
  const order = activeOrder();

  document.getElementById("laundryForm").classList.toggle("hidden", !!order);
  document.getElementById("newLaundryBlocked").classList.toggle("hidden", !order);

  if (!order) {
    box.innerHTML = '<p class="muted">You have no laundry at the moment. Use the form below to give some.</p>';
    return;
  }

  let info;
  if (order.status === "Submitted") {
    info = '<p class="note">Take your clothes to the laundry desk and show this code. The staff will count them and confirm.</p>';
  } else if (order.status === "Ready") {
    info = '<p class="note good">Your laundry is ready! You can collect it from the desk.</p>';
  } else {
    const days = daysUntil(order.returnDate);
    const left = days > 0 ? ` (${dayCount(days)} left)` : "";
    info = `<p>Given on <b>${showDate(order.givenDate)}</b> · Ready on <b>${showDate(order.returnDate)}</b>${left}</p>`;
  }

  box.innerHTML = `
    <div class="current-top">
      <div>
        <div class="muted">Your laundry code</div>
        <div class="big-code">${esc(order.code)}</div>
      </div>
      ${badgeHTML(order.status)}
    </div>
    ${trackerHTML(order.status)}
    ${info}
    ${itemsListHTML(order.items)}
    ${order.status === "Submitted" ? '<button type="button" id="cancelBtn" class="btn btn-red">Cancel Laundry</button>' : ""}
  `;

  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to cancel this laundry?")) {
        deleteDoc(doc(db, "orders", order.code));
      }
    });
  }
}

async function makeUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = CODE_PREFIX + "-" + Math.floor(10000 + Math.random() * 90000);
    const snap = await getDoc(doc(db, "orders", code));
    if (!snap.exists()) return code;
  }
  throw new Error("Could not create a code.");
}

document.getElementById("laundryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("formMessage");
  const counts = picker.getCounts();

  if (counts.big + counts.small === 0) {
    message.textContent = "Please add at least one item.";
    return;
  }

  message.textContent = "Saving...";
  try {
    const code = await makeUniqueCode();
    await setDoc(doc(db, "orders", code), {
      uid: user.uid,
      name: profile.name,
      collegeId: profile.collegeId,
      email: user.email,
      items: picker.getItems(),
      bigCount: counts.big,
      smallCount: counts.small,
      status: "Submitted",
      givenDate: null,
      returnDate: null,
      createdAt: Date.now(),
    });
    message.textContent = "";
    picker.setItems({});
    toast(`Done! Your laundry code is ${code}.`, "good");
  } catch (error) {
    console.error(error);
    message.textContent = "Could not save your laundry. Please try again.";
  }
});

function showHistory() {
  const box = document.getElementById("history");
  const past = myOrders.filter((order) => order.status === "Collected");

  if (past.length === 0) {
    box.innerHTML = '<p class="muted">No past laundry yet.</p>';
    return;
  }

  const rows = past.map((order) => `
    <tr>
      <td><b>${esc(order.code)}</b></td>
      <td>${showDate(order.givenDate)}</td>
      <td>${showDate(order.returnDate)}</td>
      <td>${esc(itemsText(order.items))}</td>
    </tr>`).join("");

  box.innerHTML = `
    <div class="table-wrap">
      <table>
        <tr><th>Code</th><th>Given</th><th>Return Date</th><th>Clothes</th></tr>
        ${rows}
      </table>
    </div>`;
}

function fillHelpOrders() {
  const select = document.getElementById("helpOrder");
  const button = document.querySelector("#helpForm button");
  const received = myOrders.filter((order) => order.status !== "Submitted");

  button.disabled = received.length === 0;
  select.innerHTML = received.length === 0
    ? '<option value="">No laundry yet</option>'
    : received.map((o) => `<option value="${o.code}">${o.code} (given ${showDate(o.givenDate)})</option>`).join("");

  fillHelpClothes();
}

function fillHelpClothes() {
  const order = myOrders.find((o) => o.code === document.getElementById("helpOrder").value);
  const clothes = order ? Object.keys(order.items) : [];
  document.getElementById("helpCloth").innerHTML = clothes.map((cloth) => `<option>${esc(cloth)}</option>`).join("");
}

document.getElementById("helpOrder").addEventListener("change", fillHelpClothes);

function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

document.getElementById("helpForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("helpMessage");
  const photoFile = document.getElementById("helpPhoto").files[0];

  message.textContent = "Sending...";
  try {
    await addDoc(collection(db, "complaints"), {
      uid: user.uid,
      name: profile.name,
      collegeId: profile.collegeId,
      orderCode: document.getElementById("helpOrder").value,
      cloth: document.getElementById("helpCloth").value,
      type: document.getElementById("helpType").value,
      description: document.getElementById("helpText").value.trim(),
      photo: photoFile ? await shrinkPhoto(photoFile) : "",
      status: "Open",
      reply: "",
      createdAt: Date.now(),
    });
    message.textContent = "";
    document.getElementById("helpForm").reset();
    fillHelpOrders();
    toast("Complaint sent. The desk will reply here.", "good");
  } catch (error) {
    console.error(error);
    message.textContent = "Could not send your complaint. Please try again.";
  }
});

function showComplaints(complaints) {
  const box = document.getElementById("myComplaints");
  if (complaints.length === 0) {
    box.innerHTML = '<p class="muted">You have no complaints.</p>';
    return;
  }

  box.innerHTML = complaints.map((c) => `
    <div class="complaint">
      <div class="complaint-top">
        <span><b>${esc(c.type)}: ${esc(c.cloth)}</b> · ${esc(c.orderCode)}</span>
        <span class="badge badge-${c.status.toLowerCase()}">${c.status}</span>
      </div>
      <p>${esc(c.description)}</p>
      ${photoHTML(c.photo)}
      ${c.reply ? `<p class="note good"><b>Reply from the desk:</b> ${esc(c.reply)}</p>` : ""}
    </div>`).join("");
}
