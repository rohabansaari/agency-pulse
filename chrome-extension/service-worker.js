const ALARM_NAME = "agencypulse-capture";
const INTERVALS = {
  1: 1,
  5: 5,
  10: 10,
  15: 15,
};

const DEFAULT_SETTINGS = {
  trackingActive: false,
  intervalMinutes: 5,
  sessionId: null,
  apiBaseUrl: "http://localhost:8080/api/v1",
  authToken: "",
  organizationId: "",
  projectId: "",
};

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings(partial) {
  await chrome.storage.local.set(partial);
}

function sessionId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function scheduleCapture(minutes) {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: minutes,
  });
}

async function stopCaptureSchedule() {
  await chrome.alarms.clear(ALARM_NAME);
}

async function compressDataUrl(dataUrl, maxWidth = 1600, quality = 0.65) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const compressedBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(compressedBlob);
  });
}

async function uploadScreenshot(dataUrl, settings, attempt = 1) {
  if (!settings.authToken || !settings.organizationId) {
    throw new Error("Missing authentication settings.");
  }

  const payload = {
    image: dataUrl,
    timestamp: new Date().toISOString(),
    session_id: settings.sessionId,
  };

  if (settings.projectId) {
    payload.project_id = Number(settings.projectId);
  }

  const response = await fetch(`${settings.apiBaseUrl}/screenshots`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.authToken}`,
      "X-Organization-Id": String(settings.organizationId),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (attempt < 2 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return uploadScreenshot(dataUrl, settings, attempt + 1);
    }

    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Upload failed (${response.status})`);
  }

  return response.json();
}

async function captureAndUpload() {
  const settings = await getSettings();

  if (!settings.trackingActive || !settings.sessionId) {
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.windowId) {
    return;
  }

  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    return;
  }

  try {
    const rawDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 70,
    });
    const compressed = await compressDataUrl(rawDataUrl);
    await uploadScreenshot(compressed, settings);
    await saveSettings({ lastCaptureAt: new Date().toISOString(), lastError: "" });
  } catch (error) {
    await saveSettings({
      lastError: error instanceof Error ? error.message : "Capture failed",
    });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void captureAndUpload();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "startTracking") {
    void (async () => {
      const minutes = INTERVALS[message.intervalMinutes] ?? 5;
      const nextSessionId = sessionId();
      await saveSettings({
        trackingActive: true,
        intervalMinutes: minutes,
        sessionId: nextSessionId,
        lastError: "",
      });
      await scheduleCapture(minutes);
      await captureAndUpload();
      sendResponse({ ok: true, sessionId: nextSessionId });
    })();

    return true;
  }

  if (message.type === "stopTracking") {
    void (async () => {
      await saveSettings({ trackingActive: false, sessionId: null });
      await stopCaptureSchedule();
      sendResponse({ ok: true });
    })();

    return true;
  }

  if (message.type === "getStatus") {
    void getSettings().then((settings) => {
      sendResponse({ ok: true, settings });
    });

    return true;
  }

  return false;
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const settings = await getSettings();
    if (settings.trackingActive && settings.intervalMinutes) {
      await scheduleCapture(settings.intervalMinutes);
    }
  })();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.trackingActive) {
    return;
  }

  void (async () => {
    const settings = await getSettings();
    if (settings.trackingActive) {
      await scheduleCapture(settings.intervalMinutes);
    } else {
      await stopCaptureSchedule();
    }
  })();
});
