(() => {
  "use strict";
  const config = window.LUDDEN_TRAVEL_CONFIG;
  const status = document.getElementById("status");
  const gallery = document.getElementById("gallery");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const search = document.getElementById("search");
  const sort = document.getElementById("sort");
  const columns = document.getElementById("columns");
  const favoriteFilter = document.getElementById("favorite-filter");
  const ratingFilter = document.getElementById("rating-filter");
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

  const ratingOverlay = document.getElementById("rating-overlay");
  const favoriteButton = document.getElementById("favorite-toggle");
  const ratingStars = [...document.querySelectorAll(".rating-star")];
  const ratingStorageKey = "luddenTravelPhotoRatings_v1";
  let photoRatings = {};
  try { photoRatings = JSON.parse(localStorage.getItem(ratingStorageKey) || "{}") || {}; }
  catch (_) { photoRatings = {}; }
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function savePhotoRatings() {
    try { localStorage.setItem(ratingStorageKey, JSON.stringify(photoRatings)); }
    catch (error) { console.warn("Could not save photo favorites/ratings locally.", error); }
  }

  function currentPhotoId() {
    return activePhotos[activePhotoIndex]?.id || "";
  }

  function updateRatingOverlay() {
    const id = currentPhotoId();
    const saved = photoRatings[id] || {};
    favoriteButton.setAttribute("aria-pressed", saved.favorite ? "true" : "false");
    favoriteButton.classList.toggle("is-favorite", !!saved.favorite);
    favoriteButton.textContent = saved.favorite ? "♥" : "♡";
    ratingStars.forEach(star => {
      const value = Number(star.dataset.rating);
      const active = value <= (saved.rating || 0);
      star.classList.toggle("is-selected", active);
      star.setAttribute("aria-pressed", active && value === saved.rating ? "true" : "false");
    });
  }

  function showRatingOverlay() {
    if (!currentPhotoId()) return;
    updateRatingOverlay();
    ratingOverlay.hidden = false;
  }

  function hideRatingOverlay() {
    ratingOverlay.hidden = true;
  }

  // Tapping the dimmed area outside the controls closes the rating overlay.
  ratingOverlay.addEventListener("click", event => {
    if (event.target === ratingOverlay) hideRatingOverlay();
  });

  favoriteButton.addEventListener("click", () => {
    const id = currentPhotoId();
    if (!id) return;
    photoRatings[id] = photoRatings[id] || {};
    photoRatings[id].favorite = !photoRatings[id].favorite;
    if (!photoRatings[id].favorite && !photoRatings[id].rating) delete photoRatings[id];
    savePhotoRatings();
    updateRatingOverlay();
  });

  ratingStars.forEach(star => star.addEventListener("click", () => {
    const id = currentPhotoId();
    if (!id) return;
    photoRatings[id] = photoRatings[id] || {};
    photoRatings[id].rating = Number(star.dataset.rating);
    savePhotoRatings();
    updateRatingOverlay();
  }));

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
        search.value = "";
        searchResults = null;
        searchRun++;
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
      if (!(isFolder || isImage)) return false;
      if (term && !file.name.toLocaleLowerCase().includes(term) && !(file._folderPath || "").toLocaleLowerCase().includes(term)) return false;
      if (isImage) {
        const saved = photoRatings[file.id] || {};
        if (favoriteFilter?.value === "favorites" && !saved.favorite) return false;
        if (favoriteFilter?.value === "not-favorites" && saved.favorite) return false;
        const ratingMode = ratingFilter?.value || "all";
        if (ratingMode === "unrated" && saved.rating) return false;
        if (/^[1-5]$/.test(ratingMode) && Number(saved.rating || 0) !== Number(ratingMode)) return false;
      }
      return true;
    });
    const mode = sort.value;
    list.sort((a, b) => {
      const aFolder = a.mimeType === "application/vnd.google-apps.folder";
      const bFolder = b.mimeType === "application/vnd.google-apps.folder";
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      if (mode === "date-desc") return (b.modifiedTime || "").localeCompare(a.modifiedTime || "");
      if (mode === "date-asc") return (a.modifiedTime || "").localeCompare(b.modifiedTime || "");
      if (mode === "rating-desc") {
        const ratingDiff = (photoRatings[b.id]?.rating || 0) - (photoRatings[a.id]?.rating || 0);
        if (ratingDiff) return ratingDiff;
      }
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

  const preloadedPhotoImages = new Map();
  function preloadPhoto(file) {
    if (!file?.id || !file.thumbnailLink || preloadedPhotoImages.has(file.id)) return;
    const image = new Image();
    image.decoding = "async";
    image.src = file.thumbnailLink.replace(/=s[0-9]+(?:-[a-z])?$/i, "=w1200") || file.thumbnailLink;
    preloadedPhotoImages.set(file.id, image);
    if (preloadedPhotoImages.size > 8) {
      const oldest = preloadedPhotoImages.keys().next().value;
      if (oldest !== currentPhotoId()) preloadedPhotoImages.delete(oldest);
    }
  }
  function preloadAdjacentPhotos() {
    preloadPhoto(activePhotos[activePhotoIndex + 1]);
    preloadPhoto(activePhotos[activePhotoIndex - 1]);
  }

  function showActivePhoto() {
    const file = activePhotos[activePhotoIndex];
    if (!file) return;
    viewerTitle.textContent = file.name;
    resetImageZoom();
    hideRatingOverlay();
    updateRatingOverlay();
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
      quickPreview.fetchPriority = "high";
      quickPreview.src = thumb.replace(/=s[0-9]+(?:-[a-z])?$/i, "=w1200") || thumb;
    }
    preloadAdjacentPhotos();
    // Full-size Google Drive iframe preview is retained for fallback, but disabled for now:
    // viewerFrame.src = base + "/preview" + resource;
    driveOpen.href = base + "/view" + resource;
    download.href = file.webContentLink || ("https://drive.google.com/uc?export=download&id=" + encodeURIComponent(file.id) + (file.resourceKey ? "&resourcekey=" + encodeURIComponent(file.resourceKey) : ""));
    previous.disabled = activePhotoIndex <= 0;
    next.disabled = activePhotoIndex >= activePhotos.length - 1;
  }

  function closePhoto() {
    hideRatingOverlay();
    resetImageZoom();
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
  favoriteFilter?.addEventListener("change", render);
  ratingFilter?.addEventListener("change", render);
  refresh.addEventListener("click", () => { recursiveCache.clear(); search.value = ""; searchResults = null; loadFolder(); });
  loadMoreObserver = new IntersectionObserver((observations) => {
    if (observations.some(item => item.isIntersecting) && nextPageToken && !loading && !searchResults) {
      loadFolder({ append: true });
    }
  }, { root: null, rootMargin: "450px 0px", threshold: 0 });
  loadMoreObserver.observe(loadMore);
  // Keep a tap fallback in case a mobile browser does not trigger the observer.
  loadMore.addEventListener("click", () => {
    if (nextPageToken && !loading && !searchResults) loadFolder({ append: true });
  });
  // Full-size Google Drive iframe load handler retained for fallback, currently disabled:
  // viewerFrame.addEventListener("load", () => {
  //   if (!viewer.hidden) {
  //     viewerFrame.classList.add("ready");
  //     const quickPreview = document.getElementById("viewer-image");
  //     if (quickPreview) quickPreview.hidden = true;
  //   }
  // });
  // Pinch zoom is handled directly so browser touch-action restrictions cannot block it.
  // Double-tap/double-click opens ratings; swipes dismiss the overlay without changing photos.
  let touchStartX = 0;
  let touchStartY = 0;
  let trackingTouch = false;
  let multiTouchGesture = false;
  let imageZoomScale = 1;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  const viewerImage = document.getElementById("viewer-image");
  const touchDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  function resetImageZoom() {
    imageZoomScale = 1;
    pinchStartDistance = 0;
    pinchStartScale = 1;
    if (viewerImage) viewerImage.style.transform = "scale(1)";
  }
  viewer.addEventListener("touchstart", event => {
    if (viewer.hidden || !event.touches) return;
    if (event.touches.length > 1) {
      multiTouchGesture = true;
      trackingTouch = false;
      lastTapTime = 0;
      if (event.touches.length >= 2) {
        pinchStartDistance = touchDistance(event.touches);
        pinchStartScale = imageZoomScale;
      }
      return;
    }
    if (multiTouchGesture || event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    trackingTouch = true;
  }, { passive: true, capture: true });
  viewer.addEventListener("touchmove", event => {
    if (event.touches && event.touches.length > 1) {
      multiTouchGesture = true;
      trackingTouch = false;
      lastTapTime = 0;
      if (event.touches.length >= 2 && pinchStartDistance > 0 && viewerImage) {
        event.preventDefault();
        const ratio = touchDistance(event.touches) / pinchStartDistance;
        imageZoomScale = Math.min(5, Math.max(1, pinchStartScale * ratio));
        viewerImage.style.transform = "scale(" + imageZoomScale + ")";
      }
    }
  }, { passive: false, capture: true });
  viewer.addEventListener("touchend", event => {
    if (multiTouchGesture) {
      if (!event.touches || event.touches.length === 0) {
        multiTouchGesture = false;
        pinchStartDistance = 0;
      }
      trackingTouch = false;
      return;
    }
    if (!trackingTouch || viewer.hidden || !event.changedTouches || event.changedTouches.length !== 1) return;
    trackingTouch = false;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const moved = Math.max(absX, absY);

    if (!ratingOverlay.hidden) {
      if (moved >= 40) {
        event.preventDefault();
        hideRatingOverlay();
      }
      return;
    }

    if (moved < 18) {
      const now = Date.now();
      const x = event.changedTouches[0].clientX;
      const y = event.changedTouches[0].clientY;
      const viewBounds = modalView?.getBoundingClientRect();
      const edgeWidth = viewBounds ? viewBounds.width * 0.22 : 0;
      const inNavigationEdge = viewBounds && (x - viewBounds.left <= edgeWidth || x - viewBounds.left >= viewBounds.width - edgeWidth);
      if (inNavigationEdge) {
        lastTapTime = 0;
        return;
      }
      if (now - lastTapTime <= 340 && Math.hypot(x - lastTapX, y - lastTapY) <= 48) {
        event.preventDefault();
        lastTapTime = 0;
        showRatingOverlay();
      } else {
        lastTapTime = now;
        lastTapX = x;
        lastTapY = y;
      }
      return;
    }
    lastTapTime = 0;
    if (absY >= 70 && deltaY < 0 && absY > absX * 1.25) {
      event.preventDefault();
      closePhoto();
      return;
    }
    if (absX < 45 || absX < absY * 1.2) return;
    event.preventDefault();
    if (deltaX < 0 && activePhotoIndex < activePhotos.length - 1) {
      activePhotoIndex++;
      showActivePhoto();
    } else if (deltaX > 0 && activePhotoIndex > 0) {
      activePhotoIndex--;
      showActivePhoto();
    }
  }, { passive: false, capture: true });
  viewer.addEventListener("touchcancel", () => {
    trackingTouch = false;
    multiTouchGesture = false;
    lastTapTime = 0;
  }, { passive: true, capture: true });

  viewerImage.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    if (viewer.hidden || !ratingOverlay.hidden) return;
    const bounds = modalView?.getBoundingClientRect();
    if (!bounds) return;
    const edge = bounds.width * 0.22;
    const x = event.clientX - bounds.left;
    if (x <= edge || x >= bounds.width - edge) return;
    showRatingOverlay();
  });

  // Clicking the outer 22% of the image viewing area navigates.
  const modalView = document.querySelector(".modal-view");
  if (modalView) {
    modalView.addEventListener("click", event => {
      if (viewer.hidden || event.target === viewerFrame || !ratingOverlay.hidden || event.target.closest("#rating-overlay")) return;
      const bounds = modalView.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const edge = bounds.width * 0.22;
      if (x <= edge && activePhotoIndex > 0) {
        activePhotoIndex--;
        showActivePhoto();
      } else if (x >= bounds.width - edge && activePhotoIndex < activePhotos.length - 1) {
        activePhotoIndex++;
        showActivePhoto();
      }
    });
  }

  closeViewer.addEventListener("click", closePhoto);
  previous.addEventListener("click", () => {
    if (activePhotoIndex > 0) { activePhotoIndex--; showActivePhoto(); }
  });
  next.addEventListener("click", () => {
    if (activePhotoIndex < activePhotos.length - 1) { activePhotoIndex++; showActivePhoto(); }
  });
  viewer.addEventListener("click", event => {
    if (event.target === viewer) {
      closePhoto();
      return;
    }
    if (!ratingOverlay.hidden && !event.target.closest("#rating-panel")) hideRatingOverlay();
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