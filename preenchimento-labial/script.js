/* ============================================================
   Clínica Pollyany Policarpo — VSL Landing Page (Preenchimento Labial)
   Player Travado 16:9 + Sem Pausa + Barra Côncava + Mute + Fullscreen
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
  const muteBtn       = document.getElementById('btn-mute');
  const muteSvg       = document.getElementById('mute-icon');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const fullscreenSvg = document.getElementById('fullscreen-icon');
  const sections      = document.querySelectorAll('.section-locked');
  const revealEls     = document.querySelectorAll('.reveal');

  // ── State ──
  let videoStarted = false;
  let videoEnded   = false;
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

  // ── Ambient Glow (Sampling canvas 16:9 + fallback) ──
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 16;
  sampleCanvas.height = 9;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  let ambientInterval = null;
  const fallbackColors = ['#5D4170', '#BD916F', '#DCC397', '#3D2A4D', '#8C6542'];
  let colorIdx = 0;

  function startAmbient() {
    if (ambientInterval) return;
    ambientInterval = setInterval(() => {
      if (!video || video.paused || video.ended) return;
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
        if (ambientEl) ambientEl.style.setProperty('--ambient-color', `rgb(${r}, ${g}, ${b})`);
      } catch (e) {
        if (ambientEl) {
          ambientEl.style.setProperty('--ambient-color', fallbackColors[colorIdx % fallbackColors.length]);
          colorIdx++;
        }
      }
    }, 200);
  }

  function stopAmbient() {
    if (ambientInterval) {
      clearInterval(ambientInterval);
      ambientInterval = null;
    }
  }

  // ── Progress Bar (Curva Côncava: Começa rápido e vai desacelerando) ──
  function updateProgress(realProgress) {
    const displayed = Math.pow(Math.min(realProgress, 1), 0.4);
    if (barFill) {
      barFill.style.width = `${displayed * 100}%`;
    }

    if (hintEl) {
      if (realProgress >= 0.9) {
        hintEl.textContent = 'Só mais um pouco...';
        hintEl.classList.add('show');
      } else if (realProgress >= 0.8) {
        hintEl.textContent = 'Você está quase lá...';
        hintEl.classList.add('show');
      } else {
        hintEl.classList.remove('show');
      }
    }

    // Milestones tracking
    [25, 50, 75, 100].forEach(pct => {
      if (!milestones[pct] && realProgress * 100 >= pct) {
        milestones[pct] = true;
        if (typeof window.track === 'function') {
          window.track(`video_${pct}`, { video: 'preenchimento-labial', progresso: `${pct}%` });
        }
      }
    });

    // Desbloqueia seções a partir de 50% ou 25s
    if (realProgress >= 0.5) {
      unlockSections();
    }
  }

  function unlockSections() {
    sections.forEach(section => {
      section.classList.add('revealed');
    });
  }

  // ── Video Events ──
  function onVideoEnded() {
    if (videoEnded) return;
    videoEnded = true;
    stopAmbient();
    unlockSections();

    if (isFullscreenActive()) {
      toggleFullscreen();
    }

    setTimeout(() => {
      const nextSection = document.getElementById('next-steps');
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  // ── Fullscreen Support (Native + Pseudo-fullscreen iOS) ──
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
  }

  function exitPseudoFullscreen() {
    if (!videoWrap) return;
    videoWrap.classList.remove('is-pseudo-fullscreen');
    document.body.classList.remove('has-fullscreen-video');
  }

  function toggleFullscreen() {
    if (!videoWrap) return;

    if (isFullscreenActive()) {
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
    }
    updateFullscreenIcon();
  }

  function updateFullscreenIcon() {
    if (!fullscreenSvg) return;
    const isFull = isFullscreenActive();
    if (isFull) {
      fullscreenSvg.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
    } else {
      fullscreenSvg.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
    }
  }

  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
  document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
  document.addEventListener('MSFullscreenChange', updateFullscreenIcon);

  // ── Play Overlay Click ──
  if (overlay) {
    overlay.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (controlsEl) controlsEl.classList.add('visible');
      videoStarted = true;

      if (video) {
        video.muted = false;
        video.play().catch(() => {
          // Autoplay fallback com áudio mutado se o navegador bloquear som direto
          video.muted = true;
          video.play();
          updateMuteIcon();
        });
        startAmbient();
      }
    });
  }

  // ── Impede Pausar e Acelerar o Vídeo ──
  if (video) {
    // Se o navegador tentar pausar depois de iniciado, retoma imediatamente
    video.addEventListener('pause', () => {
      if (videoStarted && !videoEnded) {
        video.play().catch(() => {});
      }
    });

    // Impede alteração de velocidade de reprodução
    video.addEventListener('ratechange', () => {
      if (video.playbackRate !== 1.0) {
        video.playbackRate = 1.0;
      }
    });

    // Atualização contínua do progresso com curva côncava
    video.addEventListener('timeupdate', () => {
      if (video.duration && video.duration > 0) {
        updateProgress(video.currentTime / video.duration);
      }
    });

    video.addEventListener('ended', onVideoEnded);
  }

  // ── Mute / Unmute ──
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!video) return;
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

  // ── Fullscreen Button ──
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFullscreen();
    });
  }

  // ── Bloqueio de Teclas de Atalho (Sem Pausar / Sem Avançar) ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenActive()) {
      toggleFullscreen();
      return;
    }
    const blocked = [' ', 'Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'k', 'K', 'j', 'J', 'l', 'L'];
    if (blocked.includes(e.key) || blocked.includes(e.code)) {
      if (videoStarted) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    if (e.key === 'm' || e.key === 'M') {
      if (video) {
        video.muted = !video.muted;
        updateMuteIcon();
      }
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  });

  // Bloqueio de menu de contexto no vídeo
  if (videoWrap) {
    videoWrap.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

})();
