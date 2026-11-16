import { auth, db, toLoginEmail, isCollegeEmail, isStaffUser, emailToId, setupTheme } from "./common.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const message = document.getElementById("message");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

let busy = false;

setupTheme(document.getElementById("themeToggle"));

function goHome(user) {
  location.href = isStaffUser(user) ? "admin.html" : "student.html";
}

onAuthStateChanged(auth, (user) => {
  if (user && !busy) goHome(user);
});

function errorText(error) {
  const messages = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/email-already-in-use": "This email already has an account. Please log in.",
    "auth/weak-password": "Your password must be at least 6 characters long.",
    "auth/invalid-email": "Please enter your college email, e.g. S25CSEU1161@bennett.edu.in",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  };
  return messages[error.code] || "Something went wrong. Please try again.";
}

function showTab(isLogin) {
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("hidden", !isLogin);
  signupForm.classList.toggle("hidden", isLogin);
  message.textContent = "";
}

loginTab.addEventListener("click", () => showTab(true));
signupTab.addEventListener("click", () => showTab(false));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = toLoginEmail(document.getElementById("loginId").value);
  const password = document.getElementById("loginPassword").value;

  busy = true;
  message.textContent = "Logging in...";
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    goHome(result.user);
  } catch (error) {
    busy = false;
    message.textContent = errorText(error);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = toLoginEmail(document.getElementById("signupId").value);
  const password = document.getElementById("signupPassword").value;

  if (!isCollegeEmail(email)) {
    message.textContent = "Please use your college email, e.g. S25CSEU1161@bennett.edu.in";
    return;
  }

  busy = true;
  message.textContent = "Creating your account...";
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", result.user.uid), {
      name: name,
      collegeId: emailToId(email),
      email: email,
    });
    goHome(result.user);
  } catch (error) {
    busy = false;
    message.textContent = errorText(error);
  }
});
