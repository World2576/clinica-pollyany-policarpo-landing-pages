/**
 * ============================================================
 * Clínica Pollyany Policarpo — Script Compartilhado (script.js)
 * Árvore de Links, Páginas dos Doutores e Depoimentos
 * ============================================================
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 1. CARREGAMENTO ADIADO DE VÍDEOS DO YOUTUBE (Lazy Embed)
  // ─────────────────────────────────────────────────────────────
  let ytApiLoaded = false;
  const pendingPlayers = [];

  function loadYouTubeIframeApi(callback) {
    if (window.YT && window.YT.Player) {
      callback();
      return;
    }

    pendingPlayers.push(callback);

    if (!ytApiLoaded) {
      ytApiLoaded = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode.insertBefore(tag, firstScript);

      window.onYouTubeIframeAPIReady = function () {
        while (pendingPlayers.length > 0) {
          const cb = pendingPlayers.shift();
          if (typeof cb === 'function') cb();
        }
      };
    }
  }

  function initLazyYouTubeVideos() {
    const placeholders = document.querySelectorAll('.video-lazy-placeholder');

    placeholders.forEach(placeholder => {
      placeholder.addEventListener('click', function () {
        const wrap = placeholder.closest('.video-frame-wrap');
        const ytId = placeholder.dataset.ytId;
        const videoName = placeholder.dataset.videoName || 'clinica';
        const frameContainer = wrap ? wrap.querySelector('.video-iframe-slot') : null;

        if (!ytId || !frameContainer) return;

        // Ocultar placeholder
        placeholder.style.opacity = '0';
        placeholder.style.pointerEvents = 'none';

        // Criar ID único para o iframe slot
        const iframeId = 'yt-player-' + Math.random().toString(36).substr(2, 9);
        frameContainer.id = iframeId;

        loadYouTubeIframeApi(() => {
          try {
            const player = new YT.Player(iframeId, {
              videoId: ytId,
              playerVars: {
                autoplay: 1,
                playsinline: 1,
                rel: 0,
                modestbranding: 1,
                enablejsapi: 1,
              },
              events: {
                onReady: function (event) {
                  event.target.playVideo();
                  if (typeof window.attachYouTubeTracking === 'function') {
                    window.attachYouTubeTracking(event.target, videoName);
                  }
                },
              },
            });
          } catch (e) {
            // Fallback direto com iframe caso a API falhe
            frameContainer.innerHTML = `
              <iframe
                src="https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0"
                class="video-iframe-slot"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            `;
          }
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. VÍDEOS DE DEPOIMENTO DE PACIENTES (Autoplay no Scroll + Áudio Toggle)
  // ─────────────────────────────────────────────────────────────
  function initTestimonialVideos() {
    const videoCards = document.querySelectorAll('.testimonial-video-card');
    if (!videoCards.length) return;

    if ('IntersectionObserver' in window) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const video = entry.target.querySelector('.testimonial-video-player');
          if (!video) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Mais de 50% visível na tela: reproduz suavemente
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                // Autoplay prevenido pelo navegador se não mutado
              });
            }
          } else {
            // Mais da metade fora da tela: pausa automaticamente
            if (!video.paused) {
              video.pause();
            }
          }
        });
      }, {
        threshold: [0.2, 0.5, 0.8]
      });

      videoCards.forEach(card => videoObserver.observe(card));
    }

    // Controles de Áudio (Botão Proeminente)
    videoCards.forEach(card => {
      const video = card.querySelector('.testimonial-video-player');
      const audioBtn = card.querySelector('.testimonial-audio-btn');
      if (!video || !audioBtn) return;

      const iconMuted = audioBtn.querySelector('.audio-icon--muted');
      const iconUnmuted = audioBtn.querySelector('.audio-icon--unmuted');
      const label = audioBtn.querySelector('.audio-btn-label');

      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (video.muted) {
          video.muted = false;
          if (iconMuted) iconMuted.style.display = 'none';
          if (iconUnmuted) iconUnmuted.style.display = 'block';
          if (label) label.textContent = 'Som ativo';
          video.play().catch(() => {});
        } else {
          video.muted = true;
          if (iconMuted) iconMuted.style.display = 'block';
          if (iconUnmuted) iconUnmuted.style.display = 'none';
          if (label) label.textContent = 'Tocar com som';
        }
      });

      // Ligar rastreamento do tracking.js aos vídeos nativos
      if (typeof window.attachNativeVideoTracking === 'function') {
        window.attachNativeVideoTracking(video, video.dataset.videoName || 'depoimento_paciente');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CARROSSEL DE AVALIAÇÕES (Pausa no toque para leitura)
  // ─────────────────────────────────────────────────────────────
  function initReviewsMarquee() {
    const marqueeWrap = document.getElementById('reviews-marquee-wrap');
    if (!marqueeWrap) return;

    let touchTimeout;

    marqueeWrap.addEventListener('touchstart', () => {
      marqueeWrap.classList.add('is-paused');
      clearTimeout(touchTimeout);
    }, { passive: true });

    marqueeWrap.addEventListener('touchend', () => {
      touchTimeout = setTimeout(() => {
        marqueeWrap.classList.remove('is-paused');
      }, 3500); // permanece pausado por 3.5s após soltar para ler com calma
    }, { passive: true });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. BANNER DE CONSENTIMENTO LGPD
  // ─────────────────────────────────────────────────────────────
  function initLgpdBanner() {
    const STORAGE_KEY = 'cp_lgpd_consent';
    const consent = localStorage.getItem(STORAGE_KEY);
    const banner = document.getElementById('lgpd-banner');

    if (!banner) return;

    if (!consent) {
      setTimeout(() => {
        banner.classList.add('is-active');
      }, 1000);
    }

    const btnAccept = document.getElementById('lgpd-btn-accept');
    const btnReject = document.getElementById('lgpd-btn-reject');

    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        try {
          localStorage.setItem(STORAGE_KEY, 'accepted');
        } catch (e) {}
        banner.classList.remove('is-active');

        if (typeof window.initTrackingWithConsent === 'function') {
          window.initTrackingWithConsent();
        }
      });
    }

    if (btnReject) {
      btnReject.addEventListener('click', () => {
        try {
          localStorage.setItem(STORAGE_KEY, 'rejected');
        } catch (e) {}
        banner.classList.remove('is-active');
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────
  function init() {
    initLazyYouTubeVideos();
    initTestimonialVideos();
    initReviewsMarquee();
    initLgpdBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
