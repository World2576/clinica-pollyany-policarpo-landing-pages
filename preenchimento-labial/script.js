/* ============================================================
   Clínica Pollyany Policarpo — VSL Landing Page (v2)
   Player travado 16:9 + Ambient Glow + Scroll Reveal + Tracking
   ============================================================ */

(function () {
  'use strict';

  // ── References ──
  const video       = document.getElementById('vsl-video');
  const overlay     = document.getElementById('vsl-overlay');
  const ambientEl   = document.querySelector('.vsl-ambient');
  const barFill     = document.querySelector('.vsl-controls__bar-fill');
  const hintEl      = document.querySelector('.vsl-controls__hint');
  const controlsEl  = document.querySelector('.vsl-controls');
  const muteBtn     = document.getElementById('btn-mute');
  const muteSvg     = document.getElementById('mute-icon');
  const sections    = document.querySelectorAll('.section-locked');
  const ctaButtons  = document.querySelectorAll('.cta-whatsapp');
  const revealEls   = document.querySelectorAll('.reveal');

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
  let demoMode      = false;
  let demoTimer     = null;
  let demoStart     = 0;
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
    // Fallback for older browsers
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
        // Fallback for CORS or canvas errors
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
    // Concave curve: fast early progress, builds anticipation
    const displayed = Math.pow(Math.min(realProgress, 1), 0.4);
    if (barFill) {
      barFill.style.width = `${displayed * 100}%`;
    }

    // Hint text in last 20%
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

    // Tracking milestones
    [25, 50, 75, 100].forEach(pct => {
      if (!milestones[pct] && realProgress * 100 >= pct) {
        milestones[pct] = true;
        trackVideoMilestone(pct);
      }
    });
  }

  // ── Demo Mode (no real video file present) ──
  function startDemoMode() {
    demoMode = true;
    demoStart = Date.now();
    if (controlsEl) controlsEl.classList.add('visible');

    // Animate ambient colors through luxury brand palette
    const colors = ['#5D4170', '#BD916F', '#DCC397', '#FFDBBA', '#3D2A4D'];
    let colorIdx = 0;
    const colorCycle = setInterval(() => {
      if (!demoMode) { clearInterval(colorCycle); return; }
      if (ambientEl) ambientEl.style.setProperty('--ambient-color', colors[colorIdx % colors.length]);
      colorIdx++;
    }, 2500);

    // Progress loop
    demoTimer = setInterval(() => {
      const elapsed = (Date.now() - demoStart) / 1000;
      const progress = Math.min(elapsed / DEMO_DURATION, 1);
      updateProgress(progress);

      if (progress >= 1) {
        clearInterval(demoTimer);
        clearInterval(colorCycle);
        demoMode = false;
        onVideoEnded();
      }
    }, 100);
  }

  // ── Video Events ──
  function onVideoEnded() {
    if (videoEnded) return;
    videoEnded = true;
    stopAmbient();

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

  // ── Overlay Click → Play ──
  if (overlay) {
    overlay.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (controlsEl) controlsEl.classList.add('visible');
      videoStarted = true;

      if (video && video.readyState >= 2) {
        // Real video loaded
        video.muted = false;
        video.play().catch(() => {
          video.muted = true;
          video.play();
        });
        startAmbient();
      } else {
        // No video file — enter demo mode smoothly
        startDemoMode();
      }
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
      if (controlsEl) controlsEl.classList.add('visible');
    });
  }

  // ── Mute / Unmute ──
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
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

  // ── Block Seek / Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (!videoStarted) return;
    const blocked = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '];
    if (blocked.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Allow 'M' for mute toggle
    if (e.key === 'm' || e.key === 'M') {
      if (!demoMode && video) {
        video.muted = !video.muted;
        updateMuteIcon();
      }
    }
  });

  // Block context menu on video stage
  const stage = document.querySelector('.vsl-stage');
  if (stage) {
    stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  // ── Tracking ──
  function trackVideoMilestone(pct) {
    if (typeof fbq === 'function') {
      fbq('trackCustom', `VideoProgress${pct}`, {
        procedure: document.body.dataset.procedure || '',
        ...utmData
      });
    }
    console.log(`[VSL Track] Video ${pct}%`);
  }

  function trackContact() {
    if (typeof fbq === 'function') {
      fbq('track', 'Contact', {
        procedure: document.body.dataset.procedure || '',
        ...utmData
      });
    }
    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {
        'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
        'event_callback': function () { }
      });
    }
    console.log('[VSL Track] Contact / WhatsApp click');
  }

  // CTA button clicks
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      trackContact();
    });
  });

})();
