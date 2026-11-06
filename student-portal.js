
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

const statusMessage = document.createElement("p");
statusMessage.id = "approval-status-message";
signedIn.appendChild(statusMessage);

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("is-error", error);
}

function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === "signup";

  title.textContent = registering ? "Create student account" : "Student sign in";
  submit.textContent = registering ? "Create account" : "Sign in";
  switcher.textContent = registering
    ? "Already registered? Sign in"
    : "New student? Create an account";

  nameField.hidden = !registering;
  nameInput.required = registering;
  showMessage("");
}

async function refreshSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    showMessage(error.message, true);
    return;
  }

  form.hidden = Boolean(session);
  signedIn.hidden = !session;

  if (!session) return;

  signedInEmail.textContent = session.user.email || "Student";
  statusMessage.textContent = "Checking your account status...";

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (isAdmin === true) {
    statusMessage.textContent =
      "Administrator account active. You can manage student applications.";
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("approval_status")
    .eq("user_id", session.user.id)
    .single();

  if (profileError) {
    statusMessage.textContent =
      "Unable to check approval status. Please contact the administrator.";
    return;
  }

  if (profile.approval_status === "pending") {
    statusMessage.textContent =
      "APPLICATION PENDING: Your account is awaiting administrator approval.";
  } else if (profile.approval_status === "approved") {
    statusMessage.textContent =
      "APPROVED: Your account is active. Your learning materials will be available here.";
  } else if (profile.approval_status === "rejected") {
    statusMessage.textContent =
      "APPLICATION NOT APPROVED: Please contact the administrator.";
  }
}

switcher.addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submit.disabled = true;
  showMessage(mode === "signup" ? "Creating your account..." : "Signing you in...");

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let result;

    if (mode === "signup") {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: nameInput.value.trim() },
          emailRedirectTo: window.location.origin
        }
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) {
      showMessage(result.error.message, true);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      showMessage(
        "Account created! Check your email to confirm your address before signing in."
      );
      return;
    }

    showMessage("Authentication successful.");
    await refreshSession();

  } catch (error) {
    showMessage(error.message || "Something went wrong.", true);
  } finally {
    submit.disabled = false;
  }
});

signOut.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage(error.message, true);
    return;
  }

  statusMessage.textContent = "";
  await refreshSession();
});

supabase.auth.onAuthStateChange(() => {
  refreshSession();
});

setMode("login");
refreshSession();
async function saveLessonProgress(lessonId, completed) {
  const { data: { user }, error: userError } =
    await supabase.auth.getUser();

  if (userError || !user) {
    alert("Please log in first.");
    return;
  }

  const { error } = await supabase
    .from("lesson_progress")
    .upsert(
      {
        student_id: user.id,
        lesson_id: lessonId,
        completed: completed,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "student_id,lesson_id"
      }
    );

  if (error) {
    alert("Progress could not be saved: " + error.message);
    return;
  }

  alert("Lesson progress saved successfully!");
}

window.saveLessonProgress = saveLessonProgress;