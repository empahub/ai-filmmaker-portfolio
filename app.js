(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Content ----------
  // poster  = still frame (tiny, loads instantly)
  // preview = 6s muted loop shown on the front card
  // full    = the real video, only requested when someone presses play
  // The two long videos are too big for GitHub (100 MB file limit), so they're
  // hosted elsewhere. Paste their public links here; while empty, the local
  // files in media/ are used (works on localhost only).
  const EXTERNAL_VIDEOS = {
    1: "", // full-1.mp4 (My own YouTube production flow, 16 min)
    3: "", // full-3.mp4 (My own YouTube production flow 2, 15 min)
  };

  // made: "own" = my own YouTube production flow, "sd20"/"sd25" = made with Seedance 2.0 / 2.5
  const VIDEOS = [
    { id: 1, made: "own", accent: "#ffc93c" },
    { id: 3, made: "own", accent: "#4cc9f0" },
    { id: 2, made: "sd20", accent: "#ff6b5b", pos: "50% 45%" },
    { id: 4, made: "sd20", accent: "#ff8fb1", pos: "50% 38%" },
    { id: 5, made: "sd25", accent: "#9b8cff" },
    { id: 6, made: "sd25", accent: "#3ddc97" },
    { id: 8, made: "sd20", accent: "#4cc9f0" },
    { id: 10, made: "sd20", accent: "#9b8cff" },
  ].map((v) => ({
    pos: "50% 50%",
    ...v,
    poster: `media/poster-${v.id}.webp`,
    preview: `media/preview-${v.id}.mp4`,
    full: EXTERNAL_VIDEOS[v.id] || `media/full-${v.id}.mp4`,
  }));

  const ICON_FILM =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5zM16 10.2l4.4-2.6a.4.4 0 0 1 .6.35v8.1a.4.4 0 0 1-.6.35L16 13.8z"/></svg>';
  const ICON_SPARK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/></svg>';
  const LABELS = {
    own: { icon: ICON_FILM, text: "My own YouTube production flow" },
    sd20: { icon: ICON_SPARK, text: "Made with <b>Seedance 2.0</b>" },
    sd25: { icon: ICON_SPARK, text: "Made with <b>Seedance 2.5</b>" },
  };
  const labelHTML = (v) =>
    `<p class="vlabel ${v.made}"><span class="vl-icon">${LABELS[v.made].icon}</span><span>${LABELS[v.made].text}</span></p>`;

  const N = VIDEOS.length;
  const STEP = 360 / N;
  // The ring always *looks* like five slots; with more videos the extra ones
  // wait hidden behind and slide in as the ring turns.
  const SPREAD = Math.max(1, N / 5);

  const stage = document.getElementById("stage");
  const dotsEl = document.getElementById("dots");
  const labelEl = document.getElementById("vlabel");
  const prevBtn = document.querySelector(".arrow.prev");
  const nextBtn = document.querySelector(".arrow.next");

  // ---------- Title letters ----------
  let charIndex = 0;
  document.querySelectorAll(".title .word").forEach((word) => {
    for (const ch of word.dataset.text) {
      const s = document.createElement("span");
      s.className = "char";
      s.textContent = ch;
      s.style.setProperty("--i", charIndex++);
      s.setAttribute("aria-hidden", "true");
      word.appendChild(s);
    }
  });

  // ---------- Build cards ----------
  const cards = VIDEOS.map((v, i) => {
    const el = document.createElement("div");
    el.className = "card";
    el.style.setProperty("--accent", v.accent);
    el.style.setProperty("--pos", v.pos);
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `Play video ${i + 1}`);

    const img = document.createElement("img");
    img.src = v.poster;
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    if (i > 2 && i < N - 2) img.loading = "lazy";

    const vid = document.createElement("video");
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = "none";
    vid.disablePictureInPicture = true;
    vid.setAttribute("aria-hidden", "true");
    vid.addEventListener("playing", () => vid.classList.add("on"));

    const shade = document.createElement("div");
    shade.className = "shade";

    const play = document.createElement("div");
    play.className = "play";
    play.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>';

    el.append(img, vid, shade, play);
    stage.appendChild(el);

    el.addEventListener("click", () => onCardClick(i));
    el.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && i === activeIndex()) {
        e.preventDefault();
        openPlayer(i);
      }
    });
    return { el, vid, shade, data: v, hidden: false };
  });

  const dots = VIDEOS.map((v, i) => {
    const d = document.createElement("button");
    d.className = "dot";
    d.style.setProperty("--accent", v.accent);
    d.setAttribute("aria-label", `Go to video ${i + 1}`);
    d.addEventListener("click", () => goTo(i));
    dotsEl.appendChild(d);
    return d;
  });

  // No "save video" menus anywhere on the videos
  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- Geometry ----------
  let cardW = 0;
  let radiusX = 0;
  let radiusZ = 0;
  let radiusY = 0;
  function measure() {
    cardW = cards[0].el.offsetWidth;
    const narrow = window.innerWidth <= 720;
    radiusX = cardW * (narrow ? 0.72 : 0.98);
    radiusZ = cardW * (narrow ? 0.9 : 0.8);
    radiusY = cardW * (narrow ? 0.34 : 0.42);
    // Keep depth proportional to card size so the ring looks the same on every screen
    stage.style.perspective = `${Math.round(cardW * 2.5)}px`;
  }

  const mod = (n, m) => ((n % m) + m) % m;
  const wrapAngle = (a) => mod(a + 180, 360) - 180;

  // ---------- Spring-driven rotation ----------
  // rot = current ring angle, target = where we're heading.
  // A slightly under-damped spring gives a smooth, gently bouncy settle and
  // lets rapid clicks chain naturally without restarting the animation.
  const STIFFNESS = 150;
  const DAMPING = 21;
  let rot = 0;
  let vel = 0;
  let target = 0;
  let running = false;
  let lastT = 0;
  let dragging = false;

  function render() {
    for (let i = 0; i < N; i++) {
      const c = cards[i];
      const a = wrapAngle(i * STEP - rot) * SPREAD; // on-screen angle
      const abs = Math.abs(a);

      // Cards past the back of the ring fade out and wait hidden
      const hide = abs >= 180;
      if (hide !== c.hidden) {
        c.hidden = hide;
        c.el.style.visibility = hide ? "hidden" : "";
      }
      if (hide) continue;

      const rad = (a * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const depth = (1 - cos) / 2; // 0 front → 1 back
      const x = sin * radiusX;
      const y = -depth * radiusY; // ring is viewed from slightly above
      const z = (cos - 1) * radiusZ;
      const ry = sin * 34;

      c.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
      c.el.style.zIndex = String(Math.round((cos + 1) * 100));
      c.el.style.opacity = abs <= 144 ? "1" : ((180 - abs) / 36).toFixed(3);
      c.shade.style.opacity = (Math.pow(depth, 0.9) * 0.62).toFixed(3);

      const isFront = abs < 6 && !dragging;
      if (isFront !== c.el.classList.contains("front")) {
        c.el.classList.toggle("front", isFront);
        c.el.tabIndex = isFront ? 0 : -1;
      }
    }
  }

  function tick(t) {
    let dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    // Sub-step for stability on low frame rates
    const sub = 4;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      const force = -STIFFNESS * (rot - target) - DAMPING * vel;
      vel += force * h;
      rot += vel * h;
    }

    const settled = Math.abs(rot - target) < 0.01 && Math.abs(vel) < 0.02;
    if (settled) {
      rot = target;
      vel = 0;
    }
    render();
    maybeStartPreview();

    if (settled) {
      running = false;
    } else {
      requestAnimationFrame(tick);
    }
  }

  function kick() {
    if (running) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(tick);
  }

  const activeIndex = () => mod(Math.round(target / STEP), N);

  function setTarget(t) {
    target = t;
    const after = activeIndex();
    if (previewFor !== after) onActiveChange(after);
    kick();
  }

  function go(delta) {
    // Snap from where we're already heading, so rapid clicks stack up.
    const base = Math.round(target / STEP) * STEP;
    setTarget(base + delta * STEP);
  }

  function goTo(index) {
    const diff = wrapAngle((index - activeIndex()) * STEP) / STEP;
    if (diff !== 0) go(Math.round(diff));
  }

  // ---------- "How it was made" label under the ring ----------
  let labelFor = -1;
  function setLabel(i) {
    if (i === labelFor) return;
    const same = labelFor >= 0 && VIDEOS[labelFor].made === VIDEOS[i].made;
    const first = labelFor < 0;
    labelFor = i;
    if (same) return; // same label → nothing to animate
    if (first || reduceMotion) {
      labelEl.innerHTML = labelHTML(VIDEOS[i]);
      return;
    }
    labelEl.getAnimations().forEach((a) => a.cancel());
    const out = labelEl.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(6px) scale(0.96)" }],
      { duration: 140, easing: "ease-in", fill: "forwards" }
    );
    out.finished
      .then(() => {
        labelEl.innerHTML = labelHTML(VIDEOS[labelFor]);
        out.cancel();
        labelEl.animate(
          [{ opacity: 0, transform: "translateY(-6px) scale(0.96)" }, { opacity: 1, transform: "none" }],
          { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
        );
      })
      .catch(() => {});
  }

  // ---------- Previews ----------
  let previewFor = -1;
  let previewStarted = false;
  let carouselVisible = true;

  function ensureSrc(i) {
    const v = cards[i].vid;
    if (!v.src) {
      v.preload = "auto";
      v.src = cards[i].data.preview;
    }
  }

  function onActiveChange(i) {
    dots.forEach((d, k) => d.classList.toggle("active", k === i));
    setLabel(i);
    cards.forEach((c, k) => {
      if (k !== i && c.vid.classList.contains("on")) {
        c.vid.classList.remove("on");
        setTimeout(() => {
          if (previewFor !== k) c.vid.pause();
        }, 600);
      }
    });
    previewFor = i;
    previewStarted = false;
    ensureSrc(i);
  }

  function maybeStartPreview() {
    // Wait until the card has nearly arrived so decoding never competes
    // with the rotation for frames.
    if (previewStarted || previewFor < 0 || dragging || !carouselVisible) return;
    if (Math.abs(rot - target) > STEP * 0.12) return;
    previewStarted = true;
    const v = cards[previewFor].vid;
    ensureSrc(previewFor);
    v.currentTime = 0;
    const p = v.play();
    if (p) p.catch(() => {});
    // Warm up neighbours quietly in the background.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
    idle(() => {
      ensureSrc(mod(previewFor + 1, N));
      ensureSrc(mod(previewFor - 1, N));
    });
  }

  // ---------- Input ----------
  let suppressClick = false;

  function onCardClick(i) {
    if (suppressClick) return;
    if (i === activeIndex()) openPlayer(i);
    else goTo(i);
  }

  function bump(btn) {
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
    setTimeout(() => btn.classList.remove("bump"), 140);
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  window.addEventListener("keydown", (e) => {
    if (playerOpen) {
      if (e.key === "Escape") {
        // In full screen the browser uses Esc to leave full screen first
        if (!fsElement()) closePlayer();
        return;
      }
      if (e.target === volRange || e.target === seekEl) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") {
        e.preventDefault();
        togglePause();
      } else if (k === "f") toggleFullscreen();
      else if (k === "m") volBtn.click();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(e.key === "ArrowRight" ? 5 : -5);
      } else return;
      wake();
      return;
    }
    // Arrow keys spin the ring while it's on screen
    if (!carouselVisible || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") {
      go(1);
      bump(nextBtn);
    } else if (e.key === "ArrowLeft") {
      go(-1);
      bump(prevBtn);
    }
  });

  // Drag / swipe to spin the ring
  let startX = 0;
  let startRot = 0;
  let lastMoveT = 0;
  let dragVel = 0; // deg/s
  let pointerId = null;
  let moved = false;

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || playerOpen) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startRot = rot;
    lastMoveT = performance.now();
    dragVel = 0;
    moved = false;
  });

  window.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      dragging = true;
      stage.classList.add("dragging");
      startX = e.clientX;
      startRot = rot;
      target = rot;
      vel = 0;
    }
    if (!moved) return;
    const degPerPx = STEP / (cardW * 0.85);
    const now = performance.now();
    const newRot = startRot - (e.clientX - startX) * degPerPx;
    const dtm = Math.max(1, now - lastMoveT);
    dragVel = dragVel * 0.6 + ((newRot - rot) / dtm) * 1000 * 0.4;
    rot = newRot;
    target = rot;
    lastMoveT = now;
    if (!running) render();
  });

  function endDrag(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!moved) return;
    dragging = false;
    stage.classList.remove("dragging");
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);

    // Stale velocity if the pointer paused before release
    if (performance.now() - lastMoveT > 120) dragVel = 0;
    const projected = rot + dragVel * 0.18;
    let snap = Math.round(projected / STEP) * STEP;
    const maxJump = 2 * STEP;
    snap = Math.max(startRot - maxJump - STEP / 2, Math.min(startRot + maxJump + STEP / 2, snap));
    snap = Math.round(snap / STEP) * STEP;
    vel = dragVel;
    target = rot;
    previewFor = -1;
    setTarget(snap);
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // ---------- Player (FLIP from card → centre) ----------
  // Our own controls only (play, volume, seek, full screen, close).
  // No native controls, so no download / picture-in-picture / playback menus,
  // and right-click is blocked so "Save video as…" never appears.
  const player = document.getElementById("player");
  const frame = player.querySelector(".player-frame");
  const backdrop = player.querySelector(".player-backdrop");
  const pPoster = player.querySelector(".player-poster");
  const pVideo = player.querySelector(".player-video");
  const pShield = player.querySelector(".player-shield");
  const pClose = player.querySelector(".player-close");
  const volBtn = player.querySelector(".vol-btn");
  const volRange = player.querySelector(".vol-range");
  const pLabel = player.querySelector(".player-label");
  const playBtn = player.querySelector(".pb-play");
  const fsBtn = player.querySelector(".pb-fs");
  const seekEl = player.querySelector(".seek");
  const seekBuf = player.querySelector(".seek-buf");
  const seekFill = player.querySelector(".seek-fill");
  const seekThumb = player.querySelector(".seek-thumb");
  const seekTip = player.querySelector(".seek-tip");
  const tCur = player.querySelector(".t-cur");
  const tDur = player.querySelector(".t-dur");
  let playerOpen = false;
  let playerIndex = -1;
  let anims = [];
  let volume = 1;
  let muted = false;

  player.addEventListener("contextmenu", (e) => e.preventDefault());
  pVideo.addEventListener("dragstart", (e) => e.preventDefault());
  pVideo.addEventListener("playing", () => pVideo.classList.add("on"));
  pVideo.addEventListener("play", () => {
    player.classList.remove("paused");
    playBtn.setAttribute("aria-label", "Pause");
    startProgressLoop();
  });
  pVideo.addEventListener("pause", () => {
    if (playerOpen) player.classList.add("paused");
    playBtn.setAttribute("aria-label", "Play");
    wake();
  });
  pVideo.addEventListener("ended", () => player.classList.add("paused"));

  function togglePause() {
    if (!playerOpen) return;
    if (pVideo.paused) {
      const p = pVideo.play();
      if (p) p.catch(() => {});
    } else pVideo.pause();
  }
  pShield.addEventListener("click", togglePause);
  playBtn.addEventListener("click", togglePause);
  // Double-click the picture → full screen (and undo the pause the first click made)
  pShield.addEventListener("dblclick", () => {
    togglePause();
    toggleFullscreen();
  });

  // ---------- Time / seek bar ----------
  const fmt = (t) => {
    if (!isFinite(t) || t < 0) t = 0;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = Math.floor(t % 60);
    const ss = String(sec).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  };
  let seekW = 0;
  let scrubbing = false;
  let scrubRatio = 0;
  let progressRaf = 0;
  const duration = () => (isFinite(pVideo.duration) ? pVideo.duration : 0);

  function measureSeek() {
    seekW = seekEl.getBoundingClientRect().width;
  }
  function drawProgress(ratio) {
    ratio = Math.min(1, Math.max(0, ratio || 0));
    seekFill.style.transform = `scaleX(${ratio.toFixed(5)})`;
    seekThumb.style.transform = `translateX(${(ratio * seekW).toFixed(1)}px)`;
    const d = duration();
    const t = ratio * d;
    tCur.textContent = fmt(t);
    seekEl.setAttribute("aria-valuenow", String(Math.round(t)));
    seekEl.setAttribute("aria-valuetext", `${fmt(t)} of ${fmt(d)}`);
  }
  function drawBuffered() {
    const d = duration();
    const b = pVideo.buffered;
    let end = 0;
    for (let k = 0; k < b.length; k++) {
      if (b.start(k) <= pVideo.currentTime + 0.5) end = Math.max(end, b.end(k));
    }
    seekBuf.style.transform = `scaleX(${d ? (end / d).toFixed(4) : 0})`;
  }
  function progressLoop() {
    progressRaf = 0;
    if (!playerOpen) return;
    if (!scrubbing) drawProgress(duration() ? pVideo.currentTime / duration() : 0);
    if (!pVideo.paused) progressRaf = requestAnimationFrame(progressLoop);
  }
  function startProgressLoop() {
    if (!progressRaf) progressRaf = requestAnimationFrame(progressLoop);
  }
  pVideo.addEventListener("loadedmetadata", () => {
    tDur.textContent = fmt(duration());
    seekEl.setAttribute("aria-valuemax", String(Math.round(duration())));
    measureSeek();
    drawProgress(pVideo.currentTime / (duration() || 1));
  });
  pVideo.addEventListener("progress", drawBuffered);
  pVideo.addEventListener("seeked", () => {
    drawBuffered();
    if (!scrubbing) drawProgress(pVideo.currentTime / (duration() || 1));
  });

  function seekTo(t) {
    const d = duration();
    if (!d) return;
    pVideo.currentTime = Math.min(d - 0.05, Math.max(0, t));
    drawProgress(pVideo.currentTime / d);
  }
  function seekBy(dt) {
    seekTo(pVideo.currentTime + dt);
  }
  const ratioAt = (clientX) => {
    const r = seekEl.getBoundingClientRect();
    seekW = r.width;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  function showTip(ratio) {
    seekTip.textContent = fmt(ratio * duration());
    const half = seekTip.offsetWidth / 2;
    const x = Math.min(seekW - half + 8, Math.max(half - 8, ratio * seekW));
    seekTip.style.left = `${x}px`;
  }
  seekEl.addEventListener("pointermove", (e) => {
    const r = ratioAt(e.clientX);
    showTip(r);
    if (scrubbing) {
      scrubRatio = r;
      drawProgress(r);
      // Live preview of the frame while dragging
      if (pVideo.fastSeek) pVideo.fastSeek(r * duration());
      else pVideo.currentTime = r * duration();
    }
  });
  seekEl.addEventListener("pointerdown", (e) => {
    if (!duration()) return;
    e.preventDefault();
    seekEl.setPointerCapture(e.pointerId);
    scrubbing = true;
    seekEl.classList.add("dragging");
    scrubRatio = ratioAt(e.clientX);
    showTip(scrubRatio);
    drawProgress(scrubRatio);
    wake();
  });
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    seekEl.classList.remove("dragging");
    seekTo(scrubRatio * duration());
  };
  seekEl.addEventListener("pointerup", endScrub);
  seekEl.addEventListener("pointercancel", endScrub);
  seekEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") seekBy(5);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") seekBy(-5);
    else if (e.key === "Home") seekTo(0);
    else if (e.key === "End") seekTo(duration());
    else return;
    e.preventDefault();
    e.stopPropagation();
    wake();
  });

  // ---------- Full screen (our frame, so our controls come along) ----------
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const canFrameFs = !!(frame.requestFullscreen || frame.webkitRequestFullscreen);
  const canVideoFs = !!pVideo.webkitEnterFullscreen; // iPhone: only the video itself can go full screen
  if (!canFrameFs && !canVideoFs) fsBtn.classList.add("unsupported");
  function toggleFullscreen() {
    if (!playerOpen) return;
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (canFrameFs) {
      const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
      const p = req.call(frame, { navigationUI: "hide" });
      if (p && p.catch) p.catch(() => {});
    } else if (canVideoFs) {
      pVideo.webkitEnterFullscreen();
    }
  }
  fsBtn.addEventListener("click", toggleFullscreen);
  function onFsChange() {
    const on = fsElement() === frame;
    player.classList.toggle("fs", on);
    fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    requestAnimationFrame(() => {
      measureSeek();
      drawProgress(pVideo.currentTime / (duration() || 1));
    });
    wake();
  }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);

  function applyVolume() {
    pVideo.volume = volume;
    pVideo.muted = muted || volume === 0;
    const shown = pVideo.muted ? 0 : volume;
    volRange.value = String(shown);
    volRange.style.setProperty("--v", `${Math.round(shown * 100)}%`);
    player.classList.toggle("muted", pVideo.muted);
    volBtn.setAttribute("aria-label", pVideo.muted ? "Unmute" : "Mute");
  }
  volBtn.addEventListener("click", () => {
    if (muted || volume === 0) {
      muted = false;
      if (volume === 0) volume = 0.6;
    } else muted = true;
    applyVolume();
  });
  volRange.addEventListener("input", () => {
    volume = parseFloat(volRange.value);
    muted = volume === 0;
    applyVolume();
  });

  // Hide the controls while the viewer is just watching
  let idleTimer = 0;
  function wake() {
    player.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (playerOpen && !pVideo.paused && !scrubbing && !player.querySelector(".player-bar:hover")) player.classList.add("idle");
    }, 2600);
  }
  player.addEventListener("pointermove", wake);
  player.addEventListener("pointerdown", wake);

  function finalRect() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw * 0.92, vh * 0.86 * (16 / 9), 1600);
    const h = (w * 9) / 16;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }

  function placeFrame(r) {
    frame.style.left = r.left + "px";
    frame.style.top = r.top + "px";
    frame.style.width = r.width + "px";
    frame.style.height = r.height + "px";
  }

  function invertFrom(from, to) {
    const s = from.width / to.width;
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${s})`;
  }

  function stopAnims() {
    anims.forEach((a) => a.cancel());
    anims = [];
  }

  function openPlayer(i) {
    if (playerOpen) return;
    playerOpen = true;
    playerIndex = i;
    const c = cards[i];
    stopAnims();

    // Stop spinning exactly where we are
    target = Math.round(target / STEP) * STEP;

    const from = c.el.getBoundingClientRect();
    const to = finalRect();
    placeFrame(to);
    frame.style.setProperty("--accent", c.data.accent);
    frame.style.setProperty("--pos", c.data.pos);
    pPoster.src = c.data.poster;
    pLabel.innerHTML = labelHTML(c.data);
    tCur.textContent = "0:00";
    tDur.textContent = "0:00";
    seekBuf.style.transform = "scaleX(0)";
    measureSeek();
    drawProgress(0);

    // Start the real video right away (inside the click → sound allowed)
    pVideo.classList.remove("on");
    player.classList.remove("paused", "idle");
    pVideo.src = c.data.full;
    applyVolume();
    const p = pVideo.play();
    if (p) p.catch(() => {});

    c.vid.pause();
    c.el.style.visibility = "hidden";
    player.classList.add("animating");
    player.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";

    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    const dur = reduceMotion ? 1 : 700;
    anims.push(
      frame.animate(
        [
          { transform: invertFrom(from, to), borderRadius: `${26 / (from.width / to.width)}px` },
          { transform: "none", borderRadius: "26px" },
        ],
        { duration: dur, easing, fill: "both" }
      ),
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduceMotion ? 1 : 450, easing: "ease-out", fill: "both" })
    );
    anims[0].finished
      .then(() => {
        player.classList.add("open");
        player.classList.remove("animating");
        pClose.focus({ preventScroll: true });
        measureSeek();
        wake();
      })
      .catch(() => {});
  }

  function closePlayer() {
    if (!playerOpen) return;
    if (fsElement()) {
      // Leave full screen first, then shrink back into the ring
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      document.addEventListener("fullscreenchange", () => requestAnimationFrame(closePlayer), { once: true });
      exit.call(document);
      return;
    }
    playerOpen = false;
    const c = cards[playerIndex];
    stopAnims();
    clearTimeout(idleTimer);
    cancelAnimationFrame(progressRaf);
    progressRaf = 0;
    scrubbing = false;

    pVideo.pause();
    player.classList.remove("open", "idle", "paused");
    player.classList.add("animating");

    const from = frame.getBoundingClientRect();
    // Measure the card while it's still hidden
    const to = c.el.getBoundingClientRect();
    const easing = "cubic-bezier(0.5, 0, 0.2, 1)";
    const endT = invertFrom(to, from);
    pVideo.classList.remove("on");

    anims.push(
      frame.animate(
        [
          { transform: "none", borderRadius: "26px" },
          { transform: endT, borderRadius: `${26 / (to.width / from.width)}px` },
        ],
        { duration: reduceMotion ? 1 : 560, easing, fill: "both" }
      ),
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduceMotion ? 1 : 480, easing: "ease-in", fill: "both" })
    );
    anims[0].finished
      .then(() => {
        c.el.style.visibility = "";
        player.classList.remove("animating");
        player.setAttribute("aria-hidden", "true");
        document.documentElement.style.overflow = "";
        stopAnims();
        // Fully release the big video so it stops downloading
        pVideo.removeAttribute("src");
        pVideo.load();
        const pv = c.vid.play();
        if (pv) pv.catch(() => {});
        c.el.focus({ preventScroll: true });
      })
      .catch(() => {});
  }

  pClose.addEventListener("click", closePlayer);
  backdrop.addEventListener("click", closePlayer);

  // ---------- Carousel boot ----------
  measure();
  render();
  onActiveChange(0);

  const workSection = document.getElementById("work");
  new IntersectionObserver(
    ([entry]) => {
      carouselVisible = entry.isIntersecting;
      if (carouselVisible) {
        if (!workSection.classList.contains("in")) {
          workSection.classList.add("in");
          // Let the entrance animation finish before starting the first preview
          setTimeout(maybeStartPreview, reduceMotion ? 0 : 900);
        } else {
          maybeStartPreview();
        }
      } else if (previewFor >= 0) {
        // Off screen: stop the preview so it costs nothing while reading
        cards[previewFor].vid.pause();
        previewStarted = false;
      }
    },
    { threshold: 0.15 }
  ).observe(workSection);

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      measure();
      render();
      if (playerOpen && !fsElement()) placeFrame(finalRect());
      if (playerOpen) measureSeek();
      onScroll();
    });
  });

  // =====================================================================
  //  Page animations
  // =====================================================================

  // ---------- Hero slot machine ----------
  // Spins through a few old titles, slows, overshoots a touch and locks on
  // "AI Filmmaker". Plays once, ~1.7s.
  const slotWindow = document.querySelector(".slot-window");
  const reel = document.getElementById("slot-reel");
  const WORDS = ["Software Engineer", "Content Creator", "Social Media"];
  const FINAL = "AI Filmmaker";
  const sequence = reduceMotion ? [FINAL] : [...WORDS, ...WORDS, "Software Engineer", "Content Creator", FINAL];
  reel.innerHTML = sequence.map((w) => `<span>${w}</span>`).join("");

  function runSlot() {
    const spans = reel.children;
    const widthOf = (el) => el.getBoundingClientRect().width;
    const maxW = Math.max(...Array.from(spans, widthOf));
    const finalW = widthOf(spans[spans.length - 1]);
    if (reduceMotion || spans.length === 1) {
      slotWindow.style.width = finalW + "px";
      return;
    }
    slotWindow.style.transition = "none";
    slotWindow.style.width = maxW + "px";
    const line = spans[0].getBoundingClientRect().height;
    const last = spans.length - 1;
    const y = (n) => `translateY(${-n * line}px)`;
    const spin = reel.animate(
      [
        { transform: y(0), filter: "blur(0px)", easing: "cubic-bezier(0.45, 0, 0.7, 1)" },
        { transform: y(last - 2.2), filter: "blur(1.6px)", offset: 0.55, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
        { transform: y(last + 0.16), filter: "blur(0px)", offset: 0.82, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
        { transform: y(last), filter: "blur(0px)" },
      ],
      { duration: 1700, delay: 350, fill: "forwards" }
    );
    spin.finished
      .then(() => {
        slotWindow.style.transition = "";
        slotWindow.style.width = finalW + "px";
        slotWindow.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
          { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
        );
      })
      .catch(() => {});
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(runSlot);

  // ---------- Count-up numbers ----------
  const counters = document.querySelectorAll("[data-count]");
  function countUp(el) {
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const dur = 1500;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(2, -10 * t); // ease-out-expo
    (function frameFn(now) {
      const t = Math.min(1, (now - t0) / dur);
      el.textContent = (to * (t === 1 ? 1 : ease(t))).toFixed(dec) + suffix;
      if (t < 1) requestAnimationFrame(frameFn);
    })(t0);
  }
  if (!reduceMotion) {
    counters.forEach((el) => {
      el.textContent = (0).toFixed(parseInt(el.dataset.decimals || "0", 10)) + (el.dataset.suffix || "");
    });
  }

  // ---------- Scroll reveals ----------
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("in");
        revealIO.unobserve(el);
        const num = el.querySelector("[data-count]");
        if (num && !reduceMotion) setTimeout(() => countUp(num), 150 + (parseInt(el.style.getPropertyValue("--d") || "0", 10) * 80));
        if (el.classList.contains("tool")) setTimeout(() => el.classList.add("done"), 900 + (parseInt(el.style.getPropertyValue("--d") || "0", 10) * 80));
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (reduceMotion) {
      el.classList.add("in");
      if (el.classList.contains("tool")) el.classList.add("done");
    } else revealIO.observe(el);
  });

  // ---------- Accordion ----------
  document.querySelectorAll(".acc-item").forEach((item) => {
    const q = item.querySelector(".acc-q");
    q.addEventListener("click", () => {
      const open = !item.classList.contains("open");
      item.classList.toggle("open", open);
      q.setAttribute("aria-expanded", String(open));
    });
  });

  // ---------- Scroll-linked: progress bar, timeline, workflow lines ----------
  const progressBar = document.getElementById("progress-bar");
  const timeline = document.getElementById("timeline");
  const tlFill = timeline.querySelector(".tl-fill span");
  const tlItems = Array.from(timeline.querySelectorAll(".tl-item"));
  const flows = Array.from(document.querySelectorAll(".flow")).map((flow) => ({
    flow,
    track: flow.querySelector(".flow-track"),
    fill: flow.querySelector(".flow-fill"),
    signal: flow.querySelector(".flow-signal"),
    steps: Array.from(flow.querySelectorAll(".flow-step")),
  }));

  // Progress along a vertical line, driven by a point ~62% down the screen
  const lineProgress = (rect, vh) => Math.min(1, Math.max(0, (vh * 0.62 - rect.top) / rect.height));

  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const vh = window.innerHeight;
    const doc = document.documentElement;

    // Read everything first…
    const max = doc.scrollHeight - vh;
    const pageP = max > 0 ? window.scrollY / max : 0;
    const tlRect = tlFill.parentElement.getBoundingClientRect();
    const tlP = reduceMotion ? 1 : lineProgress(tlRect, vh);
    const tlDots = tlItems.map((it) => it.querySelector(".tl-dot").getBoundingClientRect());
    const flowData = flows.map((f) => {
      const r = f.track.getBoundingClientRect();
      return { f, r, p: reduceMotion ? 1 : lineProgress(r, vh), nodes: f.steps.map((s) => s.querySelector(".flow-node").getBoundingClientRect()) };
    });

    // …then write.
    progressBar.style.transform = `scaleX(${pageP.toFixed(4)})`;

    tlFill.style.transform = `scaleY(${tlP.toFixed(4)})`;
    const tlTip = tlRect.top + tlRect.height * tlP;
    tlItems.forEach((it, k) => it.classList.toggle("lit", tlDots[k].top + tlDots[k].height / 2 <= tlTip + 1));

    flowData.forEach(({ f, r, p, nodes }) => {
      f.fill.style.transform = `scaleY(${p.toFixed(4)})`;
      f.signal.style.transform = `translateY(${(r.height * p).toFixed(1)}px)`;
      f.flow.classList.toggle("running", p > 0 && p < 1 && !reduceMotion);
      const tip = r.top + r.height * p;
      f.steps.forEach((s, k) => {
        s.classList.toggle("lit", reduceMotion || nodes[k].top + nodes[k].height / 2 <= tip + 1);
      });
    });
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollQueued) {
        scrollQueued = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();
})();
