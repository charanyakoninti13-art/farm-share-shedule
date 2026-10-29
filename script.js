
const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = (id) => document.getElementById(id);

let currentUser = null;

function showMessage(message, type = "success") {
  const box = $("message");
  box.textContent = message;
  box.className = `message ${type}`;
  box.hidden = false;
}

function clearMessage() {
  $("message").hidden = true;
}

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.textContent = busy ? "Please wait..." :
    (form.id === "signup-form" ? "Create account" : "Sign in");
}

function addText(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function showEmpty(container, message) {
  container.replaceChildren();
  addText(container, "p", message, "empty-state");
}

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

async function loadProfile() {
  const { data, error } = await client
    .from("profiles")
    .select("full_name, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile error:", error.message);
    $("user-name").textContent =
      currentUser.user_metadata?.full_name || "Member";
    $("user-role").textContent = "Role: not loaded";
    $("role-summary").textContent = "Unknown";
    return;
  }

  const name =
    data?.full_name ||
    currentUser.user_metadata?.full_name ||
    currentUser.email ||
    "Member";

  const role = data?.role || "customer";

  $("user-name").textContent = name;
  $("user-role").textContent = `Role: ${role}`;
  $("role-summary").textContent =
    role.charAt(0).toUpperCase() + role.slice(1);
}

async function loadFarms() {
  const container = $("farm-list");
  container.replaceChildren();
  addText(container, "p", "Loading farms...", "muted");

  const { data, error } = await client
    .from("farms")
    .select("id, name, location, description")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Farm query error:", error.message);
    showEmpty(
      container,
      "Unable to load farms. Check the farms RLS policies."
    );
    $("farm-count").textContent = "—";
    return;
  }

  $("farm-count").textContent = data.length;
  container.replaceChildren();

  if (data.length === 0) {
    showEmpty(container, "No farms have been listed yet.");
    return;
  }

  data.forEach((farm) => {
    const card = document.createElement("article");
    card.className = "data-card";

    addText(card, "span", "FARM", "pill");
    addText(card, "h3", farm.name);
    addText(card, "p", `📍 ${farm.location}`);

    if (farm.description) {
      addText(card, "p", farm.description);
    }

    container.appendChild(card);
  });
}

async function loadSchedules() {
  const container = $("schedule-list");
  container.replaceChildren();
  addText(container, "p", "Loading schedules...", "muted");

  const { data, error } = await client
    .from("schedules")
    .select("id, resource_id, start_time, end_time, status")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Schedule query error:", error.message);
    showEmpty(
      container,
      "Unable to load schedules. Check the schedules RLS policies."
    );
    $("schedule-count").textContent = "—";
    return;
  }

  $("schedule-count").textContent = data.length;
  container.replaceChildren();

  if (data.length === 0) {
    showEmpty(container, "No upcoming schedules are available yet.");
    return;
  }

  data.forEach((schedule) => {
    const card = document.createElement("article");
    card.className = "data-card";

    addText(card, "span", schedule.status, "pill");
    addText(card, "h3", `Schedule #${schedule.id}`);
    addText(card, "p", `Resource ID: ${schedule.resource_id}`);
    addText(card, "p", `Starts: ${formatDate(schedule.start_time)}`);
    addText(card, "p", `Ends: ${formatDate(schedule.end_time)}`);

    container.appendChild(card);
  });
}

async function loadDashboard() {
  await loadProfile();
  await Promise.all([loadFarms(), loadSchedules()]);
}

async function applySession(session) {
  currentUser = session?.user || null;

  $("auth-section").hidden = Boolean(currentUser);
  $("dashboard").hidden = !currentUser;
  $("connection-status").textContent =
    currentUser ? "Signed in" : "Ready to sign in";

  if (currentUser) {
    await loadDashboard();
  }
}

$("signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const form = event.currentTarget;
  setBusy(form, true);

  const fullName = $("signup-name").value.trim();
  const email = $("signup-email").value.trim();
  const password = $("signup-password").value;

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) throw error;

    if (data.session) {
      await applySession(data.session);
      showMessage("Your account was created successfully.");
    } else {
      showMessage(
        "Account created. Check your email for a confirmation link before signing in."
      );
    }

    form.reset();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  } finally {
    setBusy(form, false);
  }
});

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const form = event.currentTarget;
  setBusy(form, true);

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: $("login-email").value.trim(),
      password: $("login-password").value
    });

    if (error) throw error;

    await applySession(data.session);
    showMessage("You signed in successfully.");
    form.reset();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  } finally {
    setBusy(form, false);
  }
});

$("logout-btn").addEventListener("click", async () => {
  clearMessage();

  const { error } = await client.auth.signOut();

  if (error) {
    showMessage(getErrorMessage(error), "error");
    return;
  }

  currentUser = null;
  $("dashboard").hidden = true;
  $("auth-section").hidden = false;
  $("connection-status").textContent = "Signed out";

  showMessage("You have signed out.");
});

$("refresh-btn").addEventListener("click", async () => {
  clearMessage();
  await loadDashboard();
  showMessage("Dashboard refreshed.");
});

async function initializeApp() {
  if (
    !SUPABASE_URL.startsWith("https://") ||
    SUPABASE_URL.includes("PASTE_") ||
    SUPABASE_ANON_KEY.includes("PASTE_") ||
    !SUPABASE_ANON_KEY
  ) {
    $("connection-status").textContent = "Configuration needed";
    showMessage(
      "Open config.js and enter your Supabase project URL and publishable/anon key.",
      "error"
    );
    return;
  }

  try {
    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    await applySession(data.session);
    $("connection-status").textContent =
      data.session ? "Signed in" : "Ready to sign in";
  } catch (error) {
    console.error(error);
    $("connection-status").textContent = "Connection error";
    showMessage(
      "Unable to initialize the app. Check your Supabase configuration.",
      "error"
    );
  }
}

client.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  $("auth-section").hidden = Boolean(currentUser);
  $("dashboard").hidden = !currentUser;

  if (currentUser) {
    loadDashboard().catch((error) => {
      console.error("Dashboard error:", error);
    });
  }
});

initializeApp();
