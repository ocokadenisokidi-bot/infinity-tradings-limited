import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const form = document.querySelector("#student-auth-form");
const title = document.querySelector("#auth-title");
const submit = document.querySelector("#auth-submit");
const switcher = document.querySelector("#auth-switch");
const message = document.querySelector("#auth-message");
const nameField = document.querySelector("#student-name-field");
const nameInput = document.querySelector("#student-name");
const emailInput = document.querySelector("#student-email");
const passwordInput = document.querySelector("#student-password");
const signedIn = document.querySelector("#student-signed-in");
const signedInEmail = document.querySelector("#student-email-display");
const signOut = document.querySelector("#student-signout");
let mode = "login";

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("is-error", error);
}
function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === "signup";
  title.textContent = registering ? "Create student account" : "Student sign in";
  submit.textContent = registering ? "Create account" : "Sign in";
  switcher.textContent = registering ? "Already registered? Sign in" : "New student? Create an account";
  nameField.hidden = !registering;
  nameInput.required = registering;
  showMessage("");
}
async function refreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  form.hidden = Boolean(session);
  signedIn.hidden = !session;
  if (session) signedInEmail.textContent = session.user.email || "Student";
}
switcher.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submit.disabled = true;
  showMessage(mode === "signup" ? "Creating your account…" : "Signing you in…");
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  let result;
  if (mode === "signup") {
    result = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: nameInput.value.trim() }, emailRedirectTo: window.location.origin }
    });
  } else {
    result = await supabase.auth.signInWithPassword({ email, password });
  }
  submit.disabled = false;
  if (result.error) {
    showMessage(result.error.message, true);
    return;
  }
  if (mode === "signup" && !result.data.session) {
    showMessage("Account created. Check your email to confirm your address, then return here to sign in.");
    return;
  }
  showMessage(mode === "signup" ? "Account created successfully." : "Welcome back.");
  await refreshSession();
});
signOut.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) showMessage(error.message, true);
  await refreshSession();
});
supabase.auth.onAuthStateChange(() => refreshSession());
setMode("login");
refreshSession();
