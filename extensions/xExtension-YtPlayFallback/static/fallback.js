/**
 * Youlag only supports one Invidious URL. This script health-checks a list
 * and rewrites /embed/ iframes, falling back if the chosen host fails to load.
 * When Youlag "Invidious" (video proxy) is off, leave YouTube embeds alone.
 */
(function () {
  'use strict';

  const DEFAULT_INSTANCES = [
    'https://invidious.nerdvpn.de',
    'https://piped.video',
  ];
  const PROBE_PATH = '/embed/jNQXAC9IVRw';
  const PROBE_MS = 2500;
  const LOAD_TIMEOUT_MS = 9000;
  const CACHE_MS = 60_000;

  let cachedBase = null;
  let cachedAt = 0;
  const handled = new WeakSet();

  function isVideoProxyEnabled() {
    const el = document.getElementById('yt-play-fallback-instances');
    if (!el) return true;
    return el.getAttribute('data-enabled') !== '0';
  }

  function readInstances() {
    const el = document.getElementById('yt-play-fallback-instances');
    if (!el) return DEFAULT_INSTANCES.slice();
    try {
      const raw = el.getAttribute('data-instances') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(String).map((u) => u.replace(/\/$/, ''));
      }
    } catch (_) {}
    return DEFAULT_INSTANCES.slice();
  }

  function extractVideoId(src) {
    const m = String(src).match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function buildEmbed(base, videoId, search) {
    const q = search && search !== '?' ? search : '';
    return base.replace(/\/$/, '') + '/embed/' + videoId + q;
  }

  function isOurEmbed(src, instances) {
    if (!/\/embed\//.test(src)) return false;
    try {
      const host = new URL(src, location.href).origin;
      return instances.some((b) => b === host) || /youtube\.com$|youtu\.be$/i.test(new URL(src).hostname);
    } catch (_) {
      return false;
    }
  }

  function probe(base) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_MS);
    return fetch(base + PROBE_PATH, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .then(() => {
        clearTimeout(t);
        return true;
      })
      .catch(() => {
        clearTimeout(t);
        return false;
      });
  }

  async function pickBase(instances, preferSkip) {
    const now = Date.now();
    if (cachedBase && now - cachedAt < CACHE_MS && cachedBase !== preferSkip) {
      return cachedBase;
    }
    for (const base of instances) {
      if (preferSkip && base === preferSkip) continue;
      if (await probe(base)) {
        cachedBase = base;
        cachedAt = now;
        return base;
      }
    }
    const fallback =
      instances.find((b) => b !== preferSkip) || instances[0] || DEFAULT_INSTANCES[0];
    cachedBase = fallback;
    cachedAt = now;
    return fallback;
  }

  async function applyFallback(iframe, instances) {
    if (handled.has(iframe)) return;
    handled.add(iframe);

    const src = iframe.getAttribute('src') || iframe.src || '';
    const videoId = extractVideoId(src);
    if (!videoId || !isOurEmbed(src, instances)) {
      handled.delete(iframe);
      return;
    }

    let search = '';
    try {
      search = new URL(src, location.href).search || '';
    } catch (_) {}

    const currentOrigin = (() => {
      try {
        return new URL(src, location.href).origin;
      } catch (_) {
        return '';
      }
    })();

    const base = await pickBase(instances, null);
    const next = buildEmbed(base, videoId, search);
    if (next !== src) {
      iframe.src = next;
    }

    let settled = false;
    const failOver = async () => {
      if (settled) return;
      settled = true;
      const alt = await pickBase(instances, base);
      if (alt && alt !== base) {
        iframe.src = buildEmbed(alt, videoId, search);
      }
    };

    const timer = setTimeout(failOver, LOAD_TIMEOUT_MS);
    iframe.addEventListener(
      'load',
      () => {
        settled = true;
        clearTimeout(timer);
      },
      { once: true }
    );
    iframe.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        failOver();
      },
      { once: true }
    );

    const srcObserver = new MutationObserver(() => {
      const s = iframe.getAttribute('src') || '';
      if (!extractVideoId(s)) return;
      try {
        const origin = new URL(s, location.href).origin;
        if (origin === currentOrigin || instances.includes(origin)) {
          handled.delete(iframe);
          srcObserver.disconnect();
          applyFallback(iframe, instances);
        }
      } catch (_) {}
    });
    srcObserver.observe(iframe, { attributes: true, attributeFilter: ['src'] });
  }

  function scan(root, instances) {
    const nodes = [];
    if (root.nodeType === 1) {
      if (root.matches?.('iframe')) nodes.push(root);
      root.querySelectorAll?.('iframe').forEach((el) => nodes.push(el));
    }
    nodes.forEach((iframe) => {
      const src = iframe.getAttribute('src') || iframe.src || '';
      if (extractVideoId(src)) applyFallback(iframe, instances);
    });
  }

  function start() {
    if (!isVideoProxyEnabled()) {
      return;
    }
    const instances = readInstances();
    scan(document, instances);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => scan(n, instances));
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
