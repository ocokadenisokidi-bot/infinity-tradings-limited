
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
async function loadStudentCourses() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("approval_status")
    .eq("user_id", user.id)
    .single();

  if (profile?.approval_status !== "approved") return;

  let dashboard = document.querySelector("#student-courses");

  if (!dashboard) {
    dashboard = document.createElement("section");
    dashboard.id = "student-courses";
    dashboard.innerHTML = `
      <h2>My Learning Centre</h2>
      <p>Access your courses and track your learning progress.</p>
      <div id="course-list">Loading courses...</div>
    `;

    document.querySelector("main").appendChild(dashboard);
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, description, level")
    .eq("published", true);

  const list = document.querySelector("#course-list");
  list.replaceChildren();

  if (error || !courses?.length) {
    list.textContent = "No published courses available yet.";
    return;
  }

  for (const course of courses) {
    const card = document.createElement("article");
    const heading = document.createElement("h3");
    heading.textContent = course.title;

    const description = document.createElement("p");
    description.textContent = course.description || "";

    const lessons = document.createElement("div");

    const { data: lessonData } = await supabase
      .from("lessons")
      .select("id, title, description, video_url, resource_url")
      .eq("course_id", course.id)
      .order("lesson_order");

    for (const lesson of lessonData || []) {
      const item = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = lesson.title;

      const details = document.createElement("p");
      details.textContent = lesson.description || "";

      const complete = document.createElement("button");
      complete.textContent = "Mark as completed";
      complete.addEventListener("click", async () => {
        await saveLessonProgress(lesson.id, true);
        await loadStudentCourses();
      });

      item.append(title, details);

      if (lesson.video_url) {
        const video = document.createElement("a");
        video.href = lesson.video_url;
        video.textContent = "Watch lesson";
        video.target = "_blank";
        video.rel = "noopener noreferrer";
        item.append(video);
      }

      if (lesson.resource_url) {
        const resource = document.createElement("a");
        resource.href = lesson.resource_url;
        resource.textContent = "Download learning material";
        resource.target = "_blank";
        resource.rel = "noopener noreferrer";
        item.append(resource);
      }

      item.append(complete);
      lessons.append(item);
    }

    card.append(heading, description, lessons);
    list.append(card);
  }
}

supabase.auth.onAuthStateChange(() => {
  loadStudentCourses();
});

loadStudentCourses();

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
async function saveLessonProgress(lessonId, completed) {
  const { data: { user }, error: userError } =
    await supabase.auth.getUser();

  if (userError || !user) {
    alert("Please log in first.");
    return;
  }

  const { error } = await supabase
    .from("lesson_progress")
    .upsert({
      student_id: user.id,
      lesson_id: lessonId,
      completed,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "student_id,lesson_id"
    });

  if (error) {
    alert("Progress could not be saved: " + error.message);
    return;
  }

  alert("Lesson progress saved successfully!");
}

window.saveLessonProgress = saveLessonProgress;
async function loadStudentCourses() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("approval_status")
    .eq("user_id", user.id)
    .single();

  if (profile?.approval_status !== "approved") return;

  let dashboard = document.querySelector("#student-courses");

  if (!dashboard) {
    dashboard = document.createElement("section");
    dashboard.id = "student-courses";
    dashboard.innerHTML = `
      <h2>My Learning Centre</h2>
      <p>Access your courses and track your learning progress.</p>
      <div id="course-list">Loading courses...</div>
    `;

    document.querySelector("main").appendChild(dashboard);
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, description, level")
    .eq("published", true);

  const list = document.querySelector("#course-list");
  list.replaceChildren();

  if (error || !courses?.length) {
    list.textContent = "No published courses available yet.";
    return;
  }

  for (const course of courses) {
    const card = document.createElement("article");
    const heading = document.createElement("h3");
    heading.textContent = course.title;

    const description = document.createElement("p");
    description.textContent = course.description || "";

    const lessons = document.createElement("div");

    const { data: lessonData } = await supabase
      .from("lessons")
      .select("id, title, description, video_url, resource_url")
      .eq("course_id", course.id)
      .order("lesson_order");

    for (const lesson of lessonData || []) {
      const item = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = lesson.title;

      const details = document.createElement("p");
      details.textContent = lesson.description || "";

      const complete = document.createElement("button");
      complete.textContent = "Mark as completed";
      complete.addEventListener("click", async () => {
        await saveLessonProgress(lesson.id, true);
        await loadStudentCourses();
      });

      item.append(title, details);

      if (lesson.video_url) {
        const video = document.createElement("a");
        video.href = lesson.video_url;
        video.textContent = "Watch lesson";
        video.target = "_blank";
        video.rel = "noopener noreferrer";
        item.append(video);
      }

      if (lesson.resource_url) {
        const resource = document.createElement("a");
        resource.href = lesson.resource_url;
        resource.textContent = "Download learning material";
        resource.target = "_blank";
        resource.rel = "noopener noreferrer";
        item.append(resource);
      }

      item.append(complete);
      lessons.append(item);
    }

    card.append(heading, description, lessons);
    list.append(card);
  }
}

supabase.auth.onAuthStateChange(() => {
  loadStudentCourses();
});

loadStudentCourses();