(() => {
  "use strict";
  const config = window.LUDDEN_TRAVEL_CONFIG;
  const status = document.getElementById("status");
  const gallery = document.getElementById("gallery");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const search = document.getElementById("search");
  const sort = document.getElementById("sort");
  const columns = document.getElementById("columns");
  const refresh = document.getElementById("refresh");
  const loadMore = document.getElementById("load-more");
  const viewer = document.getElementById("viewer");
  const viewerTitle = document.getElementById("viewer-title");
  const viewerFrame = document.getElementById("viewer-frame");
  const viewerCount = document.getElementById("viewer-count");
  const driveOpen = document.getElementById("drive-open");
  const download = document.getElementById("download");
  const closeViewer = document.getElementById("close-viewer");
  const previous = document.getElementById("previous");
  const next = document.getElementById("next");

  let folderStack = [{ id: config.rootFolderId, name: config.rootFolderName }];
  let entries = [];
  let nextPageToken = null;
  let loading = false;
  let activePhotos = [];
  let activePhotoIndex = -1;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = "status-line" + (kind ? " " + kind : "");
  }

  function escapeQuery(value) {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  async function listFolder(folderId, pageToken = null) {
    const params = new URLSearchParams({
      q: "'" + escapeQuery(folderId) + "' in parents and trashed = false",
      pageSize: "100",
      orderBy: "folder,name",
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,webContentLink,resourceKey,imageMediaMetadata(width,height))",
      key: config.apiKey
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch("https://www.googleapis.com/drive/v3/files?" + params.toString());
    const data = await response.json();
    if (!response.ok) {
      const message = data.error?.message || "Google Drive returned HTTP " + response.status;
      throw new Error(message);
    }
    return data;
  }

  function currentFolder() {
    return folderStack[folderStack.length - 1];
  }

  function renderBreadcrumbs() {
    breadcrumbs.replaceChildren();
    folderStack.forEach((folder, index) => {
      if (index) {
        const sep = document.createElement("span");
        sep.textContent = "/";
        breadcrumbs.append(sep);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = folder.name;
      button.disabled = index === folderStack.length - 1;
      button.addEventListener("click", () => {
        folderStack = folderStack.slice(0, index + 1);
        loadFolder();
      });
      breadcrumbs.append(button);
    });
  }

  function dateLabel(file) {
    if (!file.modifiedTime) return "DATE UNKNOWN";
    const date = new Date(file.modifiedTime);
    return Number.isNaN(date.getTime()) ? "DATE UNKNOWN" :
      date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function filteredEntries() {
    const term = search.value.trim().toLocaleLowerCase();
    let list = entries.filter(file => (file.mimeType === "application/vnd.google-apps.folder" || file.mimeType?.startsWith("image/")) && (!term || file.name.toLocaleLowerCase().includes(term)));
    const mode = sort.value;
    list.sort((a, b) => {
      const aFolder = a.mimeType === "application/vnd.google-apps.folder";
      const bFolder = b.mimeType === "application/vnd.google-apps.folder";
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      if (mode === "date-desc") return (b.modifiedTime || "").localeCompare(a.modifiedTime || "");
      if (mode === "date-asc") return (a.modifiedTime || "").localeCompare(b.modifiedTime || "");
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
      return mode === "name-desc" ? -cmp : cmp;
    });
    return list;
  }

  function openPhoto(file) {
    activePhotos = filteredEntries().filter(item => item.mimeType?.startsWith("image/"));
    activePhotoIndex = activePhotos.findIndex(item => item.id === file.id);
    showActivePhoto();
    viewer.hidden = false;
    document.body.style.overflow = "hidden";
    closeViewer.focus();
  }

  function showActivePhoto() {
    const file = activePhotos[activePhotoIndex];
    if (!file) return;
    viewerTitle.textContent = file.name;
    viewerCount.textContent = (activePhotoIndex + 1) + " / " + activePhotos.length;
    const base = "https://drive.google.com/file/d/" + encodeURIComponent(file.id);
    const resource = file.resourceKey ? "?resourcekey=" + encodeURIComponent(file.resourceKey) : "";
    viewerFrame.src = base + "/preview" + resource;
    driveOpen.href = base + "/view" + resource;
    download.href = file.webContentLink || ("https://drive.google.com/uc?export=download&id=" + encodeURIComponent(file.id) + (file.resourceKey ? "&resourcekey=" + encodeURIComponent(file.resourceKey) : ""));
    previous.disabled = activePhotoIndex <= 0;
    next.disabled = activePhotoIndex >= activePhotos.length - 1;
  }

  function closePhoto() {
    viewer.hidden = true;
    viewerFrame.src = "about:blank";
    document.body.style.overflow = "";
    activePhotoIndex = -1;
  }

  function render() {
    const visible = filteredEntries();
    gallery.replaceChildren();
    gallery.className = "gallery cols-" + columns.value;
    const fragment = document.createDocumentFragment();
    visible.forEach(file => {
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.setAttribute("aria-label", (isFolder ? "Open folder " : "View photo ") + file.name);
      const imageBox = document.createElement("span");
      imageBox.className = "tile-image";
      if (isFolder) {
        const icon = document.createElement("span");
        icon.className = "folder-art";
        icon.textContent = "▰";
        imageBox.append(icon);
      } else {
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        if (file.thumbnailLink) img.src = file.thumbnailLink;
        imageBox.append(img);
      }
      const name = document.createElement("span");
      name.className = "tile-name";
      name.textContent = file.name;
      const meta = document.createElement("span");
      meta.className = "tile-meta";
      meta.textContent = isFolder ? "FOLDER" : dateLabel(file) + (file.imageMediaMetadata?.width ? " · " + file.imageMediaMetadata.width + " × " + file.imageMediaMetadata.height : "");
      tile.append(imageBox, name, meta);
      tile.addEventListener("click", () => {
        if (isFolder) {
          folderStack.push({ id: file.id, name: file.name });
          loadFolder();
        } else if (file.mimeType?.startsWith("image/")) {
          openPhoto(file);
        }
      });
      fragment.append(tile);
    });
    gallery.append(fragment);
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = search.value.trim() ? "No matching items in this folder." : "This folder is empty.";
      gallery.append(empty);
    }
    loadMore.hidden = !nextPageToken;
    renderBreadcrumbs();
  }

  async function loadFolder({ append = false } = {}) {
    if (loading) return;
    loading = true;
    setStatus("Loading " + currentFolder().name + "…");
    if (!append) {
      entries = [];
      nextPageToken = null;
      gallery.replaceChildren();
    }
    try {
      const data = await listFolder(currentFolder().id, append ? nextPageToken : null);
      entries = append ? entries.concat(data.files || []) : (data.files || []);
      nextPageToken = data.nextPageToken || null;
      const imageCount = entries.filter(file => file.mimeType?.startsWith("image/")).length;
      const folderCount = entries.filter(file => file.mimeType === "application/vnd.google-apps.folder").length;
      setStatus(currentFolder().name + " · " + imageCount + " photos · " + folderCount + " folders", "ok");
      render();
    } catch (error) {
      setStatus("Could not load this folder.", "error");
      gallery.replaceChildren();
      const message = document.createElement("div");
      message.className = "empty";
      message.textContent = error.message + " Check that the folder and its contents are shared for public viewing.";
      gallery.append(message);
    } finally {
      loading = false;
    }
  }

  search.addEventListener("input", render);
  sort.addEventListener("change", render);
  columns.addEventListener("change", render);
  refresh.addEventListener("click", () => loadFolder());
  loadMore.addEventListener("click", () => loadFolder({ append: true }));
  closeViewer.addEventListener("click", closePhoto);
  previous.addEventListener("click", () => {
    if (activePhotoIndex > 0) { activePhotoIndex--; showActivePhoto(); }
  });
  next.addEventListener("click", () => {
    if (activePhotoIndex < activePhotos.length - 1) { activePhotoIndex++; showActivePhoto(); }
  });
  viewer.addEventListener("click", event => {
    if (event.target === viewer) closePhoto();
  });
  document.addEventListener("keydown", event => {
    if (viewer.hidden) return;
    if (event.key === "Escape") closePhoto();
    if (event.key === "ArrowLeft" && activePhotoIndex > 0) { activePhotoIndex--; showActivePhoto(); }
    if (event.key === "ArrowRight" && activePhotoIndex < activePhotos.length - 1) { activePhotoIndex++; showActivePhoto(); }
  });

  if (!config?.apiKey || !config?.rootFolderId) {
    setStatus("Travel gallery configuration is missing.", "error");
  } else {
    loadFolder();
  }
})();