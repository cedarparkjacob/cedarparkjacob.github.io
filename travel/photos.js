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
  let loadMoreObserver = null;
  let searchResults = null;
  let searchTimer = null;
  let searchRun = 0;
  let recursiveCache = new Map();

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
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,webContentLink,resourceKey,md5Checksum,imageMediaMetadata(width,height))",
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

  function uniqueFiles(files) {
    const seenIds = new Set();
    const seenHashes = new Set();
    return files.filter(file => {
      if (seenIds.has(file.id)) return false;
      seenIds.add(file.id);
      if (file.mimeType?.startsWith("image/") && file.md5Checksum) {
        if (seenHashes.has(file.md5Checksum)) return false;
        seenHashes.add(file.md5Checksum);
      }
      return true;
    });
  }

  function filteredEntries() {
    const term = search.value.trim().toLocaleLowerCase();
    const source = searchResults || entries;
    let list = uniqueFiles(source).filter(file => {
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";
      const isImage = file.mimeType?.startsWith("image/");
      if (searchResults && !isImage) return false;
      return (isFolder || isImage) && (!term || file.name.toLocaleLowerCase().includes(term) || (file._folderPath || "").toLocaleLowerCase().includes(term));
    });
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
    const quickPreview = document.getElementById("viewer-image");
    viewerFrame.classList.remove("ready");
    if (quickPreview) {
      quickPreview.hidden = false;
      quickPreview.alt = file.name;
      const thumb = file.thumbnailLink || "";
      quickPreview.onerror = () => { quickPreview.onerror = null; if (thumb) quickPreview.src = thumb; };
      quickPreview.src = thumb.replace(/=s\\d+(?:-[a-z])?$/i, "=w1600") || thumb;
    }
    viewerFrame.src = base + "/preview" + resource;
    driveOpen.href = base + "/view" + resource;
    download.href = file.webContentLink || ("https://drive.google.com/uc?export=download&id=" + encodeURIComponent(file.id) + (file.resourceKey ? "&resourcekey=" + encodeURIComponent(file.resourceKey) : ""));
    previous.disabled = activePhotoIndex <= 0;
    next.disabled = activePhotoIndex >= activePhotos.length - 1;
  }

  function closePhoto() {
    viewer.hidden = true;
    viewerFrame.src = "about:blank";
    const quickPreview = document.getElementById("viewer-image");
    if (quickPreview) quickPreview.removeAttribute("src");
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
      meta.textContent = isFolder ? "FOLDER" : ((file._folderPath ? file._folderPath + " · " : "") + dateLabel(file) + (file.imageMediaMetadata?.width ? " · " + file.imageMediaMetadata.width + " × " + file.imageMediaMetadata.height : ""));
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
    loadMore.disabled = loading;
    loadMore.textContent = loading ? "LOADING MORE…" : "SCROLL TO LOAD MORE";
    renderBreadcrumbs();
  }

  async function loadFolder({ append = false } = {}) {
    if (loading) return;
    loading = true;
    setStatus("Loading " + currentFolder().name + "…");
    if (!append) {
      entries = [];
      searchResults = null;
      nextPageToken = null;
      gallery.replaceChildren();
    }
    try {
      const data = await listFolder(currentFolder().id, append ? nextPageToken : null);
      entries = uniqueFiles(append ? entries.concat(data.files || []) : (data.files || []));
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
      if (nextPageToken) {
        loadMore.disabled = false;
        loadMore.textContent = "SCROLL TO LOAD MORE";
        if (loadMoreObserver) { loadMoreObserver.unobserve(loadMore); loadMoreObserver.observe(loadMore); }
      }
    }
  }

  async function searchAllSubfolders(term, runId) {
    const root = currentFolder();
    const cacheKey = root.id;
    let found = recursiveCache.get(cacheKey);
    if (!found) {
      setStatus("Searching " + root.name + " and all subfolders…");
      const collected = [];
      const visited = new Set([root.id]);
      let frontier = [{ id: root.id, path: folderStack.map(folder => folder.name) }];
      while (frontier.length) {
        const batch = frontier.splice(0, 4);
        const nextFolders = [];
        await Promise.all(batch.map(async folder => {
          let pageToken = null;
          do {
            const page = await listFolder(folder.id, pageToken);
            for (const item of (page.files || [])) {
              if (item.mimeType === "application/vnd.google-apps.folder") {
                if (!visited.has(item.id)) {
                  visited.add(item.id);
                  nextFolders.push({ id: item.id, path: folder.path.concat(item.name) });
                }
              } else if (item.mimeType?.startsWith("image/")) {
                collected.push({ ...item, _folderPath: folder.path.join(" / ") });
              }
            }
            pageToken = page.nextPageToken || null;
          } while (pageToken);
        }));
        frontier = frontier.concat(nextFolders);
      }
      found = uniqueFiles(collected);
      recursiveCache.set(cacheKey, found);
    }
    if (runId !== searchRun) return;
    const normalized = term.toLocaleLowerCase();
    searchResults = found.filter(file =>
      file.name.toLocaleLowerCase().includes(normalized) ||
      (file._folderPath || "").toLocaleLowerCase().includes(normalized)
    );
    nextPageToken = null;
    setStatus("Search complete · " + searchResults.length + " matching photos across subfolders", "ok");
    render();
  }

  function handleSearch() {
    clearTimeout(searchTimer);
    const term = search.value.trim();
    searchRun++;
    const runId = searchRun;
    if (!term) {
      searchResults = null;
      render();
      const count = entries.filter(file => file.mimeType?.startsWith("image/")).length;
      setStatus(currentFolder().name + " · " + count + " photos", "ok");
      return;
    }
    searchTimer = setTimeout(() => {
      searchAllSubfolders(term, runId).catch(error => {
        if (runId !== searchRun) return;
        setStatus("Search failed: " + error.message, "error");
      });
    }, 300);
  }

  search.addEventListener("input", handleSearch);
  sort.addEventListener("change", render);
  columns.addEventListener("change", render);
  refresh.addEventListener("click", () => { recursiveCache.clear(); search.value = ""; searchResults = null; loadFolder(); });
  loadMoreObserver = new IntersectionObserver((observations) => {
    if (observations.some(item => item.isIntersecting) && nextPageToken && !loading && !searchResults) {
      loadFolder({ append: true });
    }
  }, { root: null, rootMargin: "450px 0px", threshold: 0 });
  loadMoreObserver.observe(loadMore);
  viewerFrame.addEventListener("load", () => {
    if (!viewer.hidden) {
      viewerFrame.classList.add("ready");
      const quickPreview = document.getElementById("viewer-image");
      if (quickPreview) quickPreview.hidden = true;
    }
  });
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