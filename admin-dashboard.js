
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const dashboard = document.querySelector("#admin-dashboard");
const studentList = document.querySelector("#admin-student-list");

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

supabase.auth.onAuthStateChange(() => {
  loadAdminDashboard();
});

loadAdminDashboard();
