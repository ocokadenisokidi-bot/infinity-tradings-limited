
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const dashboard = document.querySelector("#admin-dashboard");
const studentList = document.querySelector("#admin-student-list");
const courseForm = document.querySelector("#course-form");
const courseList = document.querySelector("#admin-course-list");
const courseMessage = document.querySelector("#course-message");
async function loadAdminDashboard() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    dashboard.hidden = true;
    return;
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError || !isAdmin) {
    dashboard.hidden = true;
    return;
  }

  dashboard.hidden = false;

  const { data: students, error } = await supabase
    .from("student_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    studentList.textContent = "Unable to load student applications.";
    return;
  }

  studentList.replaceChildren();

  if (!students.length) {
    studentList.textContent = "No student applications yet.";
    return;
  }

  students.forEach((student) => {
    const card = document.createElement("article");
    card.className = "service-card";

    const name = document.createElement("h3");
    name.textContent = student.full_name || "Student";

    const email = document.createElement("p");
    email.textContent = student.email || "";

    const status = document.createElement("p");
    status.textContent = "Status: " + student.approval_status;

    card.append(name, email, status);

    if (student.approval_status === "pending") {
      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = "Approve";

      approve.addEventListener("click", () =>
        updateStudent(student.user_id, "approved")
      );

      const reject = document.createElement("button");
      reject.type = "button";
      reject.textContent = "Reject";

      reject.addEventListener("click", () =>
        updateStudent(student.user_id, "rejected")
      );

      card.append(approve, reject);
    }

    studentList.appendChild(card);
  });
}

async function updateStudent(userId, status) {
  const { error } = await supabase
    .from("student_profiles")
    .update({
      approval_status: status,
      approved_at: status === "approved" ? new Date().toISOString() : null
    })
    .eq("user_id", userId);

  if (error) {
    alert("Update failed: " + error.message);
    return;
  }

  alert("Student status updated successfully.");
  await loadAdminDashboard();
}
async function loadCourses() {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    courseList.textContent = "Unable to load courses: " + error.message;
    return;
  }

  courseList.replaceChildren();

  if (!courses.length) {
    courseList.textContent = "No courses created yet.";
    return;
  }

  courses.forEach((course) => {
    const card = document.createElement("article");
    card.className = "service-card";

    const heading = document.createElement("h3");
    heading.textContent = course.title;

    const description = document.createElement("p");
    description.textContent = course.description || "";

    const price = document.createElement("p");
    price.textContent = "Price: " + course.price;

    const level = document.createElement("p");
    level.textContent = "Level: " + course.level;

    const status = document.createElement("p");
    status.textContent = course.is_published
      ? "Published"
      : "Draft";

    const publishButton = document.createElement("button");
    publishButton.type = "button";
    publishButton.textContent = course.is_published
      ? "Unpublish"
      : "Publish";

    publishButton.addEventListener("click", async () => {
      const { error } = await supabase
        .from("courses")
        .update({ is_published: !course.is_published })
        .eq("id", course.id);

      if (error) {
        alert("Update failed: " + error.message);
        return;
      }

      await loadCourses();
    });

    card.append(
      heading,
      description,
      price,
      level,
      status,
      publishButton
    );

    courseList.appendChild(card);
  });
}

courseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  courseMessage.textContent = "Saving course...";

  const newCourse = {
    title: document.querySelector("#course-title").value.trim(),
    description: document.querySelector("#course-description").value.trim(),
    price: Number(document.querySelector("#course-price").value),
    level: document.querySelector("#course-level").value,
    is_published: false
  };

  const { error } = await supabase
    .from("courses")
    .insert([newCourse]);

  if (error) {
    courseMessage.textContent = "Error: " + error.message;
    return;
  }

  courseForm.reset();
  courseMessage.textContent = "Course created successfully!";

  await loadCourses();
});


supabase.auth.onAuthStateChange(() => {
  loadAdminDashboard();
});

loadAdminDashboard();
