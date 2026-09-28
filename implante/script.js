/* ============================================================
   Clínica Pollyany Policarpo — Landing Page (Implante Dentário)
   YouTube Player 16:9 + Ambient Glow + Scroll Reveal + Carrossel + Tracking
   ============================================================ */

(function () {
  'use strict';

  // ── References ──
  const ambientEl = document.querySelector('.vsl-ambient');
  const revealEls = document.querySelectorAll('.reveal');

  // ── State ──
  let ytPlayer = null;
  let ytApiLoaded = false;
  const ytApiCallbacks = [];

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

  // ── Ambient Glow (Brand color cycle while video plays) ──
  const ambientColors = ['#5D4170', '#BD916F', '#DCC397', '#3D2A4D', '#8C6542'];
  let colorIdx = 0;
  let ambientInterval = null;

  function startAmbient() {
    if (ambientInterval) return;
    if (ambientEl) ambientEl.style.opacity = '0.75';
    ambientInterval = setInterval(() => {
      if (ambientEl) {
        ambientEl.style.setProperty('--ambient-color', ambientColors[colorIdx % ambientColors.length]);
        colorIdx++;
      }
    }, 3000);
  }

  function stopAmbient() {
    if (ambientInterval) {
      clearInterval(ambientInterval);
      ambientInterval = null;
    }
    if (ambientEl) ambientEl.style.opacity = '0.4';
  }

  // ── Lazy load YouTube IFrame API ──
  function loadYouTubeIframeApi(callback) {
    if (window.YT && window.YT.Player) {
      callback();
      return;
    }
    ytApiCallbacks.push(callback);
    if (!ytApiLoaded) {
      ytApiLoaded = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = function () {
        ytApiCallbacks.forEach(cb => {
          try { cb(); } catch (err) { console.error('Erro no callback YouTube:', err); }
        });
        ytApiCallbacks.length = 0;
      };
    }
  }

  // ── Attach YouTube Player & Tracking ──
  loadYouTubeIframeApi(() => {
    try {
      ytPlayer = new window.YT.Player('vsl-video-iframe', {
        events: {
          onStateChange: function (event) {
            if (typeof window.attachYouTubeTracking === 'function') {
              window.attachYouTubeTracking(event.target, 'implante');
            }
            if (event.data === 1) { // Playing
              startAmbient();
            } else if (event.data === 2 || event.data === 0) { // Paused or Ended
              stopAmbient();
            }
          }
        }
      });
    } catch (e) {
      console.warn('YouTube Player API attach:', e);
    }
  });

  // ── Client Carousel (Auto-rotation every 3.5s + Controls) ──
  const slides = document.querySelectorAll('.client-carousel__slide');
  const dots = document.querySelectorAll('.carousel-dot');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  let currentSlide = 0;
  let carouselTimer = null;

  function showSlide(index) {
    if (!slides.length) return;
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, idx) => {
      slide.classList.toggle('active', idx === currentSlide);
    });
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentSlide);
    });
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startCarousel() {
    stopCarousel();
    carouselTimer = setInterval(nextSlide, 3500);
  }

  function stopCarousel() {
    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }
  }

  if (slides.length > 0) {
    startCarousel();

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        nextSlide();
        startCarousel();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        prevSlide();
        startCarousel();
      });
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        showSlide(idx);
        startCarousel();
      });
    });

    const carouselEl = document.getElementById('clientCarousel');
    if (carouselEl) {
      carouselEl.addEventListener('mouseenter', stopCarousel);
      carouselEl.addEventListener('mouseleave', startCarousel);
      carouselEl.addEventListener('touchstart', stopCarousel, { passive: true });
      carouselEl.addEventListener('touchend', startCarousel, { passive: true });
    }
  }

  // ── Before / After Case Tabs ──
  const caseTabs = document.querySelectorAll('.case-tab');
  const casePanels = document.querySelectorAll('.case-panel');

  caseTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetCase = tab.getAttribute('data-case');
      caseTabs.forEach(t => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      casePanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `case-panel-${targetCase}`);
      });
    });
  });

})();
