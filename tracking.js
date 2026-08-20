/**
 * ============================================================
 * Clínica Pollyany Policarpo — Sistema Universal de Rastreamento (tracking.js)
 * Compartilhado por todas as páginas (Árvore, Equipe e Landing Pages)
 * ============================================================
 */

// ===== CONFIGURAÇÃO — preencher quando as contas estiverem prontas =====
const TRACKING_CONFIG = {
  metaPixelId: '1023378080473468',
  googleAdsId: '',                 // ainda não criado
  googleAdsConversao: '',          // ainda não criado
  ga4Id: 'G-NC7HS7SFY2',
  debug: false,
};

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 1. CAPTURA E PERSISTÊNCIA DE UTMs
  // ─────────────────────────────────────────────────────────────
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const STORAGE_UTM_KEY = 'cp_utm_data';
  const STORAGE_LGPD_KEY = 'cp_lgpd_consent';

  function getStoredUtms() {
    try {
      const stored = sessionStorage.getItem(STORAGE_UTM_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function captureAndStoreUtms() {
    const urlParams = new URLSearchParams(window.location.search);
    const stored = getStoredUtms();
    let hasNewUtm = false;

    UTM_KEYS.forEach(key => {
      const val = urlParams.get(key);
      if (val) {
        stored[key] = val;
        hasNewUtm = true;
      }
    });

    if (hasNewUtm) {
      try {
        sessionStorage.setItem(STORAGE_UTM_KEY, JSON.stringify(stored));
      } catch (e) {}
    }

    return stored;
  }

  const currentUtms = captureAndStoreUtms();

  // Propagação de UTMs para links internos
  function propagateUtmsToInternalLinks() {
    const utmKeysPresent = Object.keys(currentUtms).filter(k => !!currentUtms[k]);
    if (utmKeysPresent.length === 0) return;

    const internalLinks = document.querySelectorAll('a[href]');
    internalLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;

      // Identifica se é link interno do site
      const isInternal =
        href.startsWith('/') ||
        href.startsWith('./') ||
        href.startsWith('../') ||
        href.includes('pollyanypolicarpo.com.br') ||
        (href.includes('equipe/') || href.includes('implante') || href.includes('alinhador') || href.includes('preenchimento'));

      // Ignora links de WhatsApp, âncoras locais, javascript e tel/mailto
      if (!isInternal || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:') || href.includes('wa.me')) {
        return;
      }

      try {
        const url = new URL(href, window.location.origin);
        utmKeysPresent.forEach(k => {
          if (!url.searchParams.has(k)) {
            url.searchParams.set(k, currentUtms[k]);
          }
        });
        link.setAttribute('href', url.pathname + url.search + url.hash);
      } catch (e) {}
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. INICIALIZAÇÃO DE FERRAMENTAS SOB CONSENTIMENTO LGPD
  // ─────────────────────────────────────────────────────────────
  window.dataLayer = window.dataLayer || [];

  function loadExternalTrackingScripts() {
    const consent = localStorage.getItem(STORAGE_LGPD_KEY);
    if (consent !== 'accepted') {
      if (TRACKING_CONFIG.debug) {
        console.log('[Tracking] Scripts de terceiros bloqueados: aguardando consentimento LGPD.');
      }
      return;
    }

    // Carregar Meta Pixel
    if (TRACKING_CONFIG.metaPixelId && !window.fbq) {
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      try {
        fbq('init', TRACKING_CONFIG.metaPixelId);
        fbq('track', 'PageView');
        if (TRACKING_CONFIG.debug) console.log('[Tracking] Meta Pixel inicializado:', TRACKING_CONFIG.metaPixelId);
      } catch (e) {}
    }

    // Carregar Google Tag (gtag) para GA4 e/ou Google Ads
    const googleId = TRACKING_CONFIG.ga4Id || TRACKING_CONFIG.googleAdsId;
    if (googleId && typeof window.gtag !== 'function') {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${googleId}`;
      document.head.appendChild(script);

      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());

      if (TRACKING_CONFIG.ga4Id) {
        window.gtag('config', TRACKING_CONFIG.ga4Id);
      }
      if (TRACKING_CONFIG.googleAdsId) {
        window.gtag('config', TRACKING_CONFIG.googleAdsId);
      }
      if (TRACKING_CONFIG.debug) console.log('[Tracking] Google gtag inicializado');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. FUNÇÃO CENTRAL DE DISPARO (FAIL-SAFE)
  // ─────────────────────────────────────────────────────────────
  function track(eventName, params = {}) {
    const enrichedParams = {
      page_path: window.location.pathname,
      page_title: document.title,
      ...currentUtms,
      ...params,
    };

    if (TRACKING_CONFIG.debug) {
      console.groupCollapsed(`%c[Track] ${eventName}`, 'color: #DCC397; font-weight: bold; background: #2A1B35; padding: 2px 6px; border-radius: 4px;');
      console.log('Parâmetros:', enrichedParams);
      console.groupEnd();
    }

    // 1. dataLayer (sempre)
    try {
      window.dataLayer.push({
        event: eventName,
        ...enrichedParams,
      });
    } catch (e) {}

    // 2. Meta Pixel
    try {
      if (typeof window.fbq === 'function') {
        if (eventName === 'clique_whatsapp' || eventName === 'contact') {
          window.fbq('track', 'Contact', enrichedParams);
        }
        window.fbq('trackCustom', eventName, enrichedParams);
      }
    } catch (e) {}

    // 3. Google gtag (GA4 / Ads)
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, enrichedParams);

        if ((eventName === 'clique_whatsapp' || eventName === 'contact') && TRACKING_CONFIG.googleAdsConversao) {
          window.gtag('event', 'conversion', {
            send_to: TRACKING_CONFIG.googleAdsConversao,
            ...enrichedParams,
          });
        }
      }
    } catch (e) {}
  }

  // Exportar globalmente
  window.track = track;
  window.initTrackingWithConsent = loadExternalTrackingScripts;

  // ─────────────────────────────────────────────────────────────
  // 4. DELEGAÇÃO DE EVENTOS DE CLIQUE (data-track)
  // ─────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    const targetElement = e.target.closest('[data-track]');
    if (!targetElement) return;

    const eventName = targetElement.getAttribute('data-track');
    const local = targetElement.getAttribute('data-track-local') || 'geral';
    const text = (targetElement.innerText || targetElement.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const href = targetElement.getAttribute('href') || '';

    const clickParams = {
      local: local,
      link_text: text,
      link_url: href,
    };

    track(eventName, clickParams);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. TEMPO ATIVO DE PERMANÊNCIA NA PÁGINA (Aba Ativa)
  // ─────────────────────────────────────────────────────────────
  let activeSeconds = 0;
  let isPageActive = !document.hidden;
  let lastActiveTimestamp = Date.now();
  const firedTimeMilestones = new Set();
  const TIME_MILESTONES = [15, 30, 60, 120, 180];

  function updateActiveTime() {
    if (isPageActive) {
      const now = Date.now();
      const deltaSec = (now - lastActiveTimestamp) / 1000;
      activeSeconds += deltaSec;
      lastActiveTimestamp = now;

      TIME_MILESTONES.forEach(sec => {
        if (activeSeconds >= sec && !firedTimeMilestones.has(sec)) {
          firedTimeMilestones.add(sec);
          track(`tempo_${sec}s`, { segundos_ativos: Math.floor(activeSeconds) });
        }
      });
    }
  }

  const timeInterval = setInterval(updateActiveTime, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      updateActiveTime();
      isPageActive = false;
    } else {
      isPageActive = true;
      lastActiveTimestamp = Date.now();
    }
  });

  // Finalização da visita com pagehide e sendBeacon
  window.addEventListener('pagehide', () => {
    clearInterval(timeInterval);
    updateActiveTime();

    const totalSeconds = Math.round(activeSeconds);
    const payload = JSON.stringify({
      event: 'tempo_total',
      segundos: totalSeconds,
      pagina: window.location.pathname,
      ...currentUtms,
    });

    if (navigator.sendBeacon) {
      try {
        // Envia para dataLayer local antes de descarregar
        track('tempo_total', { segundos: totalSeconds });
      } catch (e) {}
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 6. PROFUNDIDADE DE ROLAGEM (Sentinelas com IntersectionObserver)
  // ─────────────────────────────────────────────────────────────
  function setupScrollTracking() {
    if (!('IntersectionObserver' in window)) return;

    const scrollDepths = [25, 50, 75, 90];
    const firedScrolls = new Set();

    const sentinelContainer = document.createElement('div');
    sentinelContainer.setAttribute('aria-hidden', 'true');
    sentinelContainer.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:100%;pointer-events:none;z-index:-9999;opacity:0;';

    scrollDepths.forEach(depth => {
      const sentinel = document.createElement('div');
      sentinel.id = `scroll-sentinel-${depth}`;
      sentinel.style.cssText = `position:absolute;top:${depth}%;width:1px;height:1px;`;
      sentinelContainer.appendChild(sentinel);
    });

    document.body.appendChild(sentinelContainer);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const depthMatch = id.match(/scroll-sentinel-(\d+)/);
          if (depthMatch) {
            const depth = parseInt(depthMatch[1], 10);
            if (!firedScrolls.has(depth)) {
              firedScrolls.add(depth);
              track(`scroll_${depth}`, { profundidade: `${depth}%` });
              observer.unobserve(entry.target);
            }
          }
        }
      });
    }, { threshold: 0.1 });

    scrollDepths.forEach(depth => {
      const el = document.getElementById(`scroll-sentinel-${depth}`);
      if (el) observer.observe(el);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 7. RASTREAMENTO DE VÍDEOS NATIVOS (<video>)
  // ─────────────────────────────────────────────────────────────
  function setupNativeVideoTracking() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      const videoName = video.dataset.videoName || document.body.dataset.procedure || 'video_principal';
      const videoMilestones = new Set();

      video.addEventListener('play', () => {
        track('video_play', { video: videoName });
      });

      video.addEventListener('pause', () => {
        if (!video.ended) {
          track('video_pausa', {
            video: videoName,
            tempo_decorrido: Math.round(video.currentTime),
          });
        }
      });

      video.addEventListener('timeupdate', () => {
        if (!video.duration || video.duration <= 0) return;
        const progressPct = Math.floor((video.currentTime / video.duration) * 100);

        [25, 50, 75].forEach(pct => {
          if (progressPct >= pct && !videoMilestones.has(pct)) {
            videoMilestones.add(pct);
            track(`video_${pct}`, { video: videoName, progresso: `${pct}%` });
          }
        });
      });

      video.addEventListener('ended', () => {
        track('video_completo', { video: videoName });
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 8. RASTREAMENTO DE VÍDEOS YOUTUBE (IFrame Player API)
  // ─────────────────────────────────────────────────────────────
  window.attachYouTubeTracking = function (player, videoName = 'clinica') {
    let pollInterval = null;
    const ytMilestones = new Set();

    function checkProgress() {
      try {
        if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') return;
        const current = player.getCurrentTime();
        const duration = player.getDuration();
        if (duration > 0) {
          const pct = Math.floor((current / duration) * 100);
          [25, 50, 75].forEach(p => {
            if (pct >= p && !ytMilestones.has(p)) {
              ytMilestones.add(p);
              track(`video_${p}`, { video: videoName, progresso: `${p}%` });
            }
          });
        }
      } catch (e) {}
    }

    if (player && typeof player.addEventListener === 'function') {
      player.addEventListener('onStateChange', function (event) {
        // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
        if (event.data === 1) { // PLAYING
          track('video_play', { video: videoName });
          if (!pollInterval) {
            pollInterval = setInterval(checkProgress, 1000);
          }
        } else if (event.data === 2) { // PAUSED
          let curTime = 0;
          try { curTime = Math.round(player.getCurrentTime()); } catch(e) {}
          track('video_pausa', { video: videoName, tempo_decorrido: curTime });
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        } else if (event.data === 0) { // ENDED
          track('video_completo', { video: videoName });
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO NO CARREGAMENTO DA PÁGINA
  // ─────────────────────────────────────────────────────────────
  function init() {
    loadExternalTrackingScripts();
    propagateUtmsToInternalLinks();
    setupScrollTracking();
    setupNativeVideoTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
