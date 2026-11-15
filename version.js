(() => {
  "use strict";
  const VERSION_FILE = "/version.json";
  const DISPLAY_ID = "ludmath-version";
  if (document.getElementById(DISPLAY_ID)) return;

  const style = document.createElement("style");
  style.textContent = `
    #ludmath-version {
      position: fixed; right: 12px; bottom: 10px; z-index: 99999;
      font: 11px/1.4 system-ui, sans-serif; color: #8b93a7;
      opacity: 0.7; cursor: default; user-select: none;
    }
    #ludmath-version:hover { opacity: 1; }
  `;
  (document.head || document.documentElement).appendChild(style);

  const display = document.createElement("div");
  display.id = DISPLAY_ID;
  display.textContent = "Version unavailable";
  (document.body || document.documentElement).appendChild(display);

  fetch(VERSION_FILE, { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Version file returned HTTP " + response.status);
      return response.json();
    })
    .then(data => {
      const version = data.version || "Unknown";
      const commit = data.commit || "";
      const updated = data.updated || "";
      display.textContent = version + (commit ? " · " + commit : "");
      display.title = updated
        ? "Last deployed: " + new Date(updated).toLocaleString()
        : "Deployment information unavailable";

      const values = {
        "site-version": version,
        "site-updated": updated ? new Date(updated).toLocaleString() : "Unavailable",
        "site-commit": commit || "Unavailable"
      };
      Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      });
    })
    .catch(error => {
      console.error("[LudMath Version]", error);
      display.textContent = "Version unavailable";
      ["site-version", "site-updated", "site-commit"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "Unavailable";
      });
    });
})();
