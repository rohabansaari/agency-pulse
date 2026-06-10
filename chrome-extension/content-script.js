const APP_SOURCE = "agencypulse-app";
const EXT_SOURCE = "agencypulse-extension";

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data;
  if (!data || data.source !== APP_SOURCE || !data.action || !data.requestId) {
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "appBridge",
      action: data.action,
      requestId: data.requestId,
      payload: data.payload ?? {},
    },
    (response) => {
      const error = chrome.runtime.lastError?.message;

      window.postMessage(
        {
          source: EXT_SOURCE,
          requestId: data.requestId,
          ok: Boolean(response?.ok) && !error,
          trackingActive: response?.trackingActive,
          error: error ?? response?.error,
        },
        "*",
      );
    },
  );
});

window.postMessage({ source: EXT_SOURCE, type: "ready" }, "*");
