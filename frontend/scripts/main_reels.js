import { normalizeText } from "../../shared/js/text.js";

const ACTIVE_CARD_THRESHOLDS = [0.2, 0.4, 0.6, 0.8];
const ACTIVE_VIDEO_WINDOW_RADIUS = 1;

export function createReelsRuntime(ctx) {
  const {
    state,
    els,
    frontendT,
    escapeHTML,
    escapeAttr,
    resolveLocalizedFrontendText,
    tourDestinations,
    publicReelsDataUrl,
    setReelsModeOpen,
    openBookingModalForTripId
  } = ctx || {};

  let manifestPromise = null;
  let manifestByTourId = new Map();
  let renderedItems = [];
  let cardElements = [];
  let activeIndex = -1;
  let observer = null;
  let scrollSyncFrame = 0;
  const visibilityByIndex = new Map();
  let lifecycleBound = false;

  function escapeHtml(value) {
    return typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? "");
  }

  function escapeAttribute(value) {
    return typeof escapeAttr === "function" ? escapeAttr(value) : String(value ?? "");
  }

  function resolveTripTitle(trip) {
    const resolved = typeof resolveLocalizedFrontendText === "function"
      ? resolveLocalizedFrontendText(trip?.title, state?.lang)
      : normalizeText(trip?.title);
    return normalizeText(resolved) || frontendT("reels.fallback.title", "AsiaTravelPlan");
  }

  function resolveTripMeta(trip) {
    const destinations = typeof tourDestinations === "function" ? tourDestinations(trip) : [];
    return (Array.isArray(destinations) ? destinations : [])
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .join(" • ");
  }

  async function fetchManifest() {
    const manifestUrl = typeof publicReelsDataUrl === "function" ? publicReelsDataUrl() : "";
    const response = await fetch(manifestUrl, { cache: "default" });
    if (!response.ok) {
      throw new Error(`Reels manifest request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const sourceItems = Array.isArray(payload?.items) ? payload.items : [];
    manifestByTourId = new Map(
      sourceItems
        .map((item) => {
          const tourId = normalizeText(item?.tourId);
          const videoUrl = normalizeText(item?.videoUrl);
          const posterUrl = normalizeText(item?.posterUrl);
          if (!tourId || !videoUrl) return null;
          return [tourId, {
            tourId,
            videoUrl,
            posterUrl,
            duration: Number.isFinite(Number(item?.duration)) ? Number(item.duration) : 0
          }];
        })
        .filter(Boolean)
    );
    return manifestByTourId;
  }

  async function ensureManifest() {
    if (manifestByTourId.size) return manifestByTourId;
    if (!manifestPromise) {
      manifestPromise = fetchManifest().finally(() => {
        manifestPromise = null;
      });
    }
    return manifestPromise;
  }

  function buildRenderedItems() {
    return (Array.isArray(state?.filteredTrips) ? state.filteredTrips : [])
      .map((trip, index) => {
        const tourId = normalizeText(trip?.id);
        if (!tourId) return null;
        const media = manifestByTourId.get(tourId);
        if (!media) return null;
        return {
          index,
          trip,
          tourId,
          title: resolveTripTitle(trip),
          meta: resolveTripMeta(trip),
          videoUrl: media.videoUrl,
          posterUrl: media.posterUrl,
          duration: media.duration
        };
      })
      .filter(Boolean);
  }

  function renderEmptyState({ title, body }) {
    if (!(els?.mobileReelFeed instanceof HTMLElement)) return;
    els.mobileReelFeed.innerHTML = `
      <div class="mobile-reel-empty">
        <div class="mobile-reel-empty__panel">
          <h2 class="mobile-reel-empty__title">${escapeHtml(title)}</h2>
          <p class="mobile-reel-empty__body">${escapeHtml(body)}</p>
        </div>
      </div>
    `;
    cardElements = [];
    activeIndex = -1;
    visibilityByIndex.clear();
  }

  function renderFeed() {
    if (!(els?.mobileReelFeed instanceof HTMLElement)) return;
    if (!renderedItems.length) {
      renderEmptyState({
        title: frontendT("reels.empty.title", "No reels yet"),
        body: frontendT("reels.empty.body", "No reel videos match the current filters yet.")
      });
      return;
    }

    const cards = renderedItems.map((item, index) => {
      const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");
      return `
        <article class="mobile-reel-card" data-reel-card data-reel-index="${index}" data-tour-id="${escapeAttribute(item.tourId)}">
          <video
            class="mobile-reel-card__video"
            data-reel-video
            autoplay
            muted
            loop
            playsinline
            webkit-playsinline
            disablepictureinpicture
            disableremoteplayback
            preload="none"
            poster="${escapeAttribute(item.posterUrl)}"
          ></video>
          <div class="mobile-reel-card__scrim" aria-hidden="true"></div>
          <div class="mobile-reel-card__copy">
            <h2 class="mobile-reel-card__title">${escapeHtml(item.title)}</h2>
            ${item.meta ? `<p class="mobile-reel-card__meta">${escapeHtml(item.meta)}</p>` : ""}
            <div class="mobile-reel-card__actions">
              <button
                class="btn btn-primary mobile-reel-card__cta"
                type="button"
                data-reel-booking-button
                data-trip-id="${escapeAttribute(item.tourId)}"
              >${escapeHtml(ctaLabel)}</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    els.mobileReelFeed.innerHTML = cards;
    cardElements = Array.from(els.mobileReelFeed.querySelectorAll("[data-reel-card]"));
  }

  function destroyObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    visibilityByIndex.clear();
  }

  function unloadVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    video.pause();
    video.removeAttribute("src");
    video.dataset.reelSrcAttached = "";
    video.load();
  }

  function configureVideoElement(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute("disableremoteplayback", "");
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
  }

  function ensureVideoLoaded(video, item, { preload = "metadata" } = {}) {
    if (!(video instanceof HTMLVideoElement) || !item) return;
    configureVideoElement(video);
    const currentSrc = normalizeText(video.dataset.reelSrcAttached);
    if (currentSrc !== item.videoUrl) {
      video.pause();
      video.src = item.videoUrl;
      video.dataset.reelSrcAttached = item.videoUrl;
      video.load();
    }
    video.preload = preload;
  }

  function tryPlayVideo(video, { allowRetry = true } = {}) {
    if (!(video instanceof HTMLVideoElement)) return;
    configureVideoElement(video);
    const playPromise = video.play();
    if (!allowRetry || !playPromise || typeof playPromise.catch !== "function") return;
    playPromise.catch(() => {
      const retryPlay = () => {
        if (!video.isConnected) return;
        window.requestAnimationFrame(() => {
          void tryPlayVideo(video, { allowRetry: false });
        });
      };
      video.addEventListener("loadedmetadata", retryPlay, { once: true });
      video.addEventListener("canplay", retryPlay, { once: true });
      video.addEventListener("canplaythrough", retryPlay, { once: true });
    });
  }

  function syncActiveVideoWindow() {
    cardElements.forEach((cardEl, index) => {
      const video = cardEl.querySelector("[data-reel-video]");
      const item = renderedItems[index];
      const shouldLoad = activeIndex >= 0 && Math.abs(index - activeIndex) <= ACTIVE_VIDEO_WINDOW_RADIUS;
      cardEl.classList.toggle("is-active", index === activeIndex);

      if (!(video instanceof HTMLVideoElement) || !item) return;
      if (!shouldLoad) {
        unloadVideo(video);
        return;
      }

      ensureVideoLoaded(video, item, { preload: index === activeIndex ? "auto" : "metadata" });
      if (index === activeIndex) {
        tryPlayVideo(video);
      } else {
        video.pause();
      }
    });
  }

  function setActiveIndex(nextIndex, { force = false } = {}) {
    const boundedIndex = renderedItems.length
      ? Math.max(0, Math.min(renderedItems.length - 1, Number(nextIndex) || 0))
      : -1;
    if (!force && boundedIndex === activeIndex) return;
    activeIndex = boundedIndex;
    syncActiveVideoWindow();
  }

  function syncActiveIndexFromVisibility() {
    let bestIndex = -1;
    let bestRatio = 0;
    visibilityByIndex.forEach((ratio, index) => {
      if (ratio <= bestRatio) return;
      bestRatio = ratio;
      bestIndex = index;
    });
    if (bestIndex >= 0) {
      setActiveIndex(bestIndex);
    }
  }

  function scheduleScrollSync() {
    if (scrollSyncFrame) return;
    scrollSyncFrame = window.requestAnimationFrame(() => {
      scrollSyncFrame = 0;
      if (!(els?.mobileReelFeed instanceof HTMLElement) || !renderedItems.length) return;
      const reelHeight = Math.max(1, els.mobileReelFeed.clientHeight);
      const scrolledIndex = Math.round(els.mobileReelFeed.scrollTop / reelHeight);
      setActiveIndex(scrolledIndex);
    });
  }

  function setupObserver() {
    destroyObserver();
    if (!(els?.mobileReelFeed instanceof HTMLElement) || !cardElements.length || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const index = Number.parseInt(entry.target.getAttribute("data-reel-index") || "-1", 10);
        if (index < 0) return;
        visibilityByIndex.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      syncActiveIndexFromVisibility();
    }, {
      root: els.mobileReelFeed,
      threshold: ACTIVE_CARD_THRESHOLDS
    });
    cardElements.forEach((cardEl) => observer?.observe(cardEl));
  }

  function bindFeedEvents() {
    if (!(els?.mobileReelFeed instanceof HTMLElement) || els.mobileReelFeed.dataset.reelsFeedBound === "1") return;
    els.mobileReelFeed.dataset.reelsFeedBound = "1";

    els.mobileReelFeed.addEventListener("scroll", scheduleScrollSync, { passive: true });
    els.mobileReelFeed.addEventListener("click", (event) => {
      const bookingButton = event.target instanceof Element ? event.target.closest("[data-reel-booking-button]") : null;
      if (bookingButton instanceof HTMLButtonElement) {
        event.stopPropagation();
        const tripId = bookingButton.getAttribute("data-trip-id");
        close();
        void openBookingModalForTripId?.(tripId, bookingButton);
        return;
      }

      const card = event.target instanceof Element ? event.target.closest("[data-reel-card]") : null;
      if (!(card instanceof HTMLElement)) return;
      const index = Number.parseInt(card.getAttribute("data-reel-index") || "-1", 10);
      if (index !== activeIndex) return;
      const video = card.querySelector("[data-reel-video]");
      if (!(video instanceof HTMLVideoElement)) return;
      if (video.paused) {
        void video.play().catch(() => {});
        return;
      }
      video.pause();
    });
  }

  function bindLifecycleEvents() {
    if (lifecycleBound) return;
    lifecycleBound = true;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !state?.reelsModeOpen) return;
      window.requestAnimationFrame(() => {
        syncActiveVideoWindow();
      });
    });

    window.addEventListener("pageshow", () => {
      if (!state?.reelsModeOpen) return;
      window.requestAnimationFrame(() => {
        syncActiveVideoWindow();
      });
    });
  }

  async function open() {
    bindFeedEvents();
    bindLifecycleEvents();
    let manifestLoadFailed = false;
    try {
      await ensureManifest();
    } catch (error) {
      manifestLoadFailed = true;
      console.error("[frontend-home] Failed to load reels manifest.", error);
      manifestByTourId = new Map();
    }

    renderedItems = buildRenderedItems();
    renderFeed();
    setReelsModeOpen(true);
    if (els?.mobileReelFeed instanceof HTMLElement) {
      els.mobileReelFeed.scrollTop = 0;
    }
    setupObserver();

    if (!renderedItems.length && manifestLoadFailed) {
      renderEmptyState({
        title: frontendT("reels.error.title", "Reels unavailable"),
        body: frontendT("reels.error.body", "We could not load reels right now. Please try again later.")
      });
      return;
    }

    setActiveIndex(renderedItems.length ? 0 : -1, { force: true });
  }

  function close() {
    destroyObserver();
    if (scrollSyncFrame) {
      window.cancelAnimationFrame(scrollSyncFrame);
      scrollSyncFrame = 0;
    }
    cardElements.forEach((cardEl) => {
      const video = cardEl.querySelector("[data-reel-video]");
      unloadVideo(video);
    });
    renderedItems = [];
    cardElements = [];
    activeIndex = -1;
    if (els?.mobileReelFeed instanceof HTMLElement) {
      els.mobileReelFeed.innerHTML = "";
      els.mobileReelFeed.scrollTop = 0;
    }
    setReelsModeOpen(false);
  }

  return {
    open,
    close
  };
}
