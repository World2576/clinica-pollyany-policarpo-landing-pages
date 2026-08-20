/* ============================================================
   Clínica Pollyany Policarpo — VSL Landing Page (v3.1)
   Player travado 16:9 + Play/Pause + Fullscreen Mobile/Desktop + Ambient Glow + Scroll Reveal + Tracking
   ============================================================ */

(function () {
  'use strict';

  // ── References ──
  const videoWrap     = document.querySelector('.vsl-video-wrap');
  const video         = document.getElementById('vsl-video');
  const overlay       = document.getElementById('vsl-overlay');
  const ambientEl     = document.querySelector('.vsl-ambient');
  const barFill       = document.querySelector('.vsl-controls__bar-fill');
  const hintEl        = document.querySelector('.vsl-controls__hint');
  const controlsEl    = document.querySelector('.vsl-controls');
  const playPauseBtn  = document.getElementById('btn-play-pause');
  const playPauseSvg  = document.getElementById('play-pause-icon');
  const muteBtn       = document.getElementById('btn-mute');
  const muteSvg       = document.getElementById('mute-icon');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const fullscreenSvg = document.getElementById('fullscreen-icon');
  const sections      = document.querySelectorAll('.section-locked');
  const ctaButtons    = document.querySelectorAll('.cta-whatsapp');
  const revealEls     = document.querySelectorAll('.reveal');

  // ── UTM Capture ──
  const urlParams  = new URLSearchParams(window.location.search);
  const utmData    = {
    source:   urlParams.get('utm_source')   || '',
    campaign: urlParams.get('utm_campaign') || '',
    content:  urlParams.get('utm_content')  || '',
    medium:   urlParams.get('utm_medium')   || '',
    term:     urlParams.get('utm_term')     || ''
  };

  // ── State ──
  let videoStarted  = false;
  let videoEnded    = false;
  let isPaused      = false;
  let demoMode      = false;
  let demoTimer     = null;
  let colorCycle    = null;
  let demoStart     = 0;
  let demoElapsed   = 0;
  const DEMO_DURATION = 18; // seconds for demo playback

  // Tracking milestone flags
  const milestones = { 25: false, 50: false, 75: false, 100: false };

  // ── Intersection Observer for Scroll Reveal ──
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // ── Ambient Glow (canvas sampling 16:9) ──
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 16;
  sampleCanvas.height = 9;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  let ambientInterval = null;

  function startAmbient() {
    if (ambientInterval) return;
    ambientInterval = setInterval(() => {
      if (!video || video.paused || video.ended || demoMode) return;
      try {
        sampleCtx.drawImage(video, 0, 0, 16, 9);
        const { data } = sampleCtx.getImageData(0, 0, 16, 9);
        let r = 0, g = 0, b = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        ambientEl.style.setProperty('--ambient-color', `rgb(${r}, ${g}, ${b})`);
      } catch (e) {
        // Fallback
      }
    }, 150);
  }

  function stopAmbient() {
    if (ambientInterval) {
      clearInterval(ambientInterval);
      ambientInterval = null;
    }
  }

  // ── Progress Bar (concave curve) ──
  function updateProgress(realProgress) {
    const displayed = Math.pow(Math.min(realProgress, 1), 0.4);
    if (barFill) {
      barFill.style.width = `${displayed * 100}%`;
    }

    // Hint text in last 20%
    if (hintEl) {
      if (isPaused) {
        hintEl.textContent = 'Pausado';
        hintEl.classList.add('show');
      } else if (realProgress >= 0.9) {
        hintEl.textContent = 'Só mais um pouco...';
        hintEl.classList.add('show');
      } else if (realProgress >= 0.8) {
        hintEl.textContent = 'Você está quase lá...';
        hintEl.classList.add('show');
      } else {
        hintEl.classList.remove('show');
      }
    }

    // Tracking milestones
    [25, 50, 75, 100].forEach(pct => {
      if (!milestones[pct] && realProgress * 100 >= pct) {
        milestones[pct] = true;
        trackVideoMilestone(pct);
      }
    });
  }

  // ── Demo Mode (no real video file present) ──
  const demoColors = ['#5D4170', '#BD916F', '#DCC397', '#FFDBBA', '#3D2A4D'];
  let colorIdx = 0;

  function runDemoColorCycle() {
    if (colorCycle) clearInterval(colorCycle);
    colorCycle = setInterval(() => {
      if (!demoMode || isPaused) return;
      if (ambientEl) ambientEl.style.setProperty('--ambient-color', demoColors[colorIdx % demoColors.length]);
      colorIdx++;
    }, 2500);
  }

  function runDemoTimer() {
    if (demoTimer) clearInterval(demoTimer);
    demoTimer = setInterval(() => {
      if (isPaused) return;
      const elapsed = ((Date.now() - demoStart) / 1000);
      demoElapsed = elapsed;
      const progress = Math.min(elapsed / DEMO_DURATION, 1);
      updateProgress(progress);

      if (progress >= 1) {
        clearInterval(demoTimer);
        if (colorCycle) clearInterval(colorCycle);
        demoMode = false;
        onVideoEnded();
      }
    }, 100);
  }

  function startDemoMode() {
    demoMode = true;
    isPaused = false;
    demoStart = Date.now() - (demoElapsed * 1000);
    if (controlsEl) controlsEl.classList.add('visible');
    runDemoColorCycle();
    runDemoTimer();
    updatePlayPauseIcon();
  }

  // ── Video Events ──
  function onVideoEnded() {
    if (videoEnded) return;
    videoEnded = true;
    isPaused = false;
    stopAmbient();
    updatePlayPauseIcon();

    // Exit fullscreen if still active
    if (isFullscreenActive()) {
      toggleFullscreen();
    }

    // Reveal hidden sections
    sections.forEach(section => {
      section.classList.add('revealed');
    });

    // Trigger reveal for any elements now in view
    setTimeout(() => {
      const nextSection = document.getElementById('next-steps');
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  // ── Play / Pause Toggle ──
  function togglePlayPause() {
    if (!videoStarted || videoEnded) return;

    if (demoMode) {
      if (isPaused) {
        isPaused = false;
        demoStart = Date.now() - (demoElapsed * 1000);
        runDemoColorCycle();
        runDemoTimer();
      } else {
        isPaused = true;
        demoElapsed = (Date.now() - demoStart) / 1000;
        if (demoTimer) clearInterval(demoTimer);
        if (colorCycle) clearInterval(colorCycle);
      }
      updatePlayPauseIcon();
      updateProgress(demoElapsed / DEMO_DURATION);
      return;
    }

    if (video) {
      if (video.paused) {
        video.play().then(() => {
          isPaused = false;
          updatePlayPauseIcon();
          startAmbient();
        }).catch(() => {});
      } else {
        video.pause();
        isPaused = true;
        updatePlayPauseIcon();
        stopAmbient();
      }
      if (video.duration) {
        updateProgress(video.currentTime / video.duration);
      }
    }
  }

  function updatePlayPauseIcon() {
    if (!playPauseSvg) return;
    if (isPaused) {
      // Show Play icon
      playPauseSvg.innerHTML = '<path d="M8 5v14l11-7z"/>';
    } else {
      // Show Pause icon
      playPauseSvg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    }
  }

  // ── Fullscreen Support (Desktop API + iOS Safari + CSS Pseudo-Fullscreen) ──
  function isFullscreenActive() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      (videoWrap && videoWrap.classList.contains('is-pseudo-fullscreen'))
    );
  }

  function enterPseudoFullscreen() {
    if (!videoWrap) return;
    videoWrap.classList.add('is-pseudo-fullscreen');
    document.body.classList.add('has-fullscreen-video');
    updateFullscreenIcon();
  }

  function exitPseudoFullscreen() {
    if (!videoWrap) return;
    videoWrap.classList.remove('is-pseudo-fullscreen');
    document.body.classList.remove('has-fullscreen-video');
    updateFullscreenIcon();
  }

  function toggleFullscreen() {
    if (!videoWrap) return;

    if (isFullscreenActive()) {
      // Exit fullscreen
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        const exitFn = document.exitFullscreen ||
                       document.webkitExitFullscreen ||
                       document.mozCancelFullScreen ||
                       document.msExitFullscreen;
        if (exitFn) {
          try { exitFn.call(document); } catch (e) {}
        }
      }
      exitPseudoFullscreen();
    } else {
      // Enter fullscreen
      const requestFn = videoWrap.requestFullscreen ||
                        videoWrap.webkitRequestFullscreen ||
                        videoWrap.webkitRequestFullScreen ||
                        videoWrap.mozRequestFullScreen ||
                        videoWrap.msRequestFullscreen;

      let usedNative = false;
      if (requestFn) {
        try {
          const promise = requestFn.call(videoWrap);
          if (promise && typeof promise.then === 'function') {
            promise.then(() => {
              updateFullscreenIcon();
            }).catch(() => {
              // Rejected (e.g. iOS Safari) -> fallback to pseudo fullscreen
              enterPseudoFullscreen();
            });
            usedNative = true;
          } else {
            usedNative = true;
          }
        } catch (err) {
          usedNative = false;
        }
      }

      if (!usedNative) {
        enterPseudoFullscreen();
      }
      updateFullscreenIcon();
    }
  }

  function updateFullscreenIcon() {
    if (!fullscreenSvg) return;
    const isFull = isFullscreenActive();
    if (isFull) {
      // Compress icon
      fullscreenSvg.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
    } else {
      // Expand icon
      fullscreenSvg.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
    }
  }

  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
  document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
  document.addEventListener('MSFullscreenChange', updateFullscreenIcon);

  // ── Overlay Click → Play ──
  if (overlay) {
    overlay.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (controlsEl) controlsEl.classList.add('visible');
      videoStarted = true;
      isPaused = false;
      updatePlayPauseIcon();

      if (video && video.readyState >= 2) {
        video.muted = false;
        video.play().catch(() => {
          video.muted = true;
          video.play();
        });
        startAmbient();
      } else {
        startDemoMode();
      }
    });
  }

  // Play/Pause button click & touch
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayPause();
    });
  }

  // Fullscreen button click & touch
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFullscreen();
    });
  }

  // Video listeners
  if (video) {
    video.addEventListener('timeupdate', () => {
      if (video.duration && video.duration > 0) {
        const real = video.currentTime / video.duration;
        updateProgress(real);
      }
    });

    video.addEventListener('ended', onVideoEnded);

    video.addEventListener('play', () => {
      isPaused = false;
      updatePlayPauseIcon();
      if (controlsEl) controlsEl.classList.add('visible');
    });

    video.addEventListener('pause', () => {
      isPaused = true;
      updatePlayPauseIcon();
    });
  }

  // ── Mute / Unmute ──
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (demoMode || !video) return;
      video.muted = !video.muted;
      updateMuteIcon();
    });
  }

  function updateMuteIcon() {
    if (!muteSvg || !video) return;
    if (video.muted) {
      muteSvg.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else {
      muteSvg.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    }
  }

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenActive()) {
      toggleFullscreen();
      return;
    }
    if (!videoStarted) return;
    const blocked = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
    if (blocked.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Space toggles Play/Pause
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    }
    // 'M' for mute toggle
    if (e.key === 'm' || e.key === 'M') {
      if (!demoMode && video) {
        video.muted = !video.muted;
        updateMuteIcon();
      }
    }
    // 'F' for fullscreen toggle
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  });

  // Block context menu on video stage
  const stage = document.querySelector('.vsl-stage');
  if (stage) {
    stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

})();
