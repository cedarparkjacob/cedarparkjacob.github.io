/* Shared Google Drive API client for Ludden pages.
   Pages supply their own API key and folder IDs; this file contains no credentials. */
(function (global) {
  "use strict";

  const API_ROOT = "https://www.googleapis.com/drive/v3/files";
  const DEFAULT_FIELDS = [
    "nextPageToken",
    "files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,webContentLink,resourceKey,md5Checksum,imageMediaMetadata(width,height),capabilities(canDownload),shortcutDetails(targetId,targetMimeType,targetResourceKey))"
  ].join(",");

  function escapeQueryValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function createClient(options) {
    const settings = options || {};
    const apiKey = String(settings.apiKey || "");
    if (!apiKey) throw new Error("Google Drive API key is required.");

    async function listFolderPage(folderId, pageOptions) {
      if (!folderId) throw new Error("A Google Drive folder ID is required.");
      const opts = pageOptions || {};
      const params = new URLSearchParams({
        q: "'" + escapeQueryValue(folderId) + "' in parents and trashed = false",
        pageSize: String(Math.min(1000, Math.max(1, Number(opts.pageSize) || 100))),
        orderBy: opts.orderBy || "folder,name",
        fields: opts.fields || DEFAULT_FIELDS,
        key: apiKey
      });
      if (opts.pageToken) params.set("pageToken", opts.pageToken);
      if (opts.supportsAllDrives !== false) {
        params.set("supportsAllDrives", "true");
        params.set("includeItemsFromAllDrives", "true");
      }

      const response = await fetch(API_ROOT + "?" + params.toString());
      let data;
      try {
        data = await response.json();
      } catch (_) {
        throw new Error("Google Drive returned HTTP " + response.status + " with an unreadable response.");
      }
      if (!response.ok) {
        const message = data && data.error && data.error.message;
        const reason = data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
        throw new Error((message || "Google Drive returned HTTP " + response.status) +
          (reason ? " (" + reason + ")" : ""));
      }
      return data;
    }

    async function listFolder(folderId, pageOptions) {
      const opts = Object.assign({}, pageOptions || {});
      const all = [];
      let pageToken = opts.pageToken || null;
      do {
        const page = await listFolderPage(folderId, Object.assign({}, opts, { pageToken }));
        all.push.apply(all, page.files || []);
        pageToken = page.nextPageToken || null;
      } while (pageToken);
      return all;
    }

    return Object.freeze({ listFolderPage, listFolder });
  }

  global.LuddenDrive = Object.freeze({ createClient });
})(window);
