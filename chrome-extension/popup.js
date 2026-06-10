const fields = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  authToken: document.getElementById("authToken"),
  organizationId: document.getElementById("organizationId"),
  projectId: document.getElementById("projectId"),
  intervalMinutes: document.getElementById("intervalMinutes"),
};

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const messageEl = document.getElementById("message");
const metaEl = document.getElementById("meta");

function showMessage(text) {
  if (!text) {
    messageEl.hidden = true;
    messageEl.textContent = "";
    return;
  }

  messageEl.hidden = false;
  messageEl.textContent = text;
}

function renderStatus(settings) {
  const active = Boolean(settings.trackingActive);
  statusDot.classList.toggle("active", active);
  statusDot.classList.toggle("inactive", !active);
  statusLabel.textContent = active ? "Active" : "Inactive";
  startBtn.disabled = active;
  stopBtn.disabled = !active;

  const parts = [];
  if (settings.lastCaptureAt) {
    parts.push(`Last capture: ${new Date(settings.lastCaptureAt).toLocaleString()}`);
  }
  if (settings.sessionId) {
    parts.push(`Session: ${settings.sessionId.slice(0, 8)}…`);
  }
  if (settings.lastError) {
    parts.push(`Error: ${settings.lastError}`);
  }

  metaEl.textContent = parts.join(" · ");
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "getStatus" });
  const settings = response?.settings ?? {};

  fields.apiBaseUrl.value = settings.apiBaseUrl || "http://localhost:8080/api/v1";
  fields.authToken.value = settings.authToken || "";
  fields.organizationId.value = settings.organizationId || "";
  fields.projectId.value = settings.projectId || "";
  fields.intervalMinutes.value = String(settings.intervalMinutes || 5);

  renderStatus(settings);
}

async function persistAuthSettings() {
  await chrome.storage.local.set({
    apiBaseUrl: fields.apiBaseUrl.value.trim(),
    authToken: fields.authToken.value.trim(),
    organizationId: fields.organizationId.value.trim(),
    projectId: fields.projectId.value.trim(),
  });
}

startBtn.addEventListener("click", async () => {
  showMessage("");
  await persistAuthSettings();

  if (!fields.authToken.value.trim() || !fields.organizationId.value.trim()) {
    showMessage("Bearer token and organization ID are required.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "startTracking",
    intervalMinutes: Number(fields.intervalMinutes.value),
  });

  if (!response?.ok) {
    showMessage("Unable to start tracking.");
    return;
  }

  await loadSettings();
});

stopBtn.addEventListener("click", async () => {
  showMessage("");
  await chrome.runtime.sendMessage({ type: "stopTracking" });
  await loadSettings();
});

[
  fields.apiBaseUrl,
  fields.authToken,
  fields.organizationId,
  fields.projectId,
  fields.intervalMinutes,
].forEach((field) => {
  field.addEventListener("change", () => {
    void persistAuthSettings();
  });
});

void loadSettings();
