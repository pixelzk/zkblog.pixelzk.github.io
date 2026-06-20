(function () {
  'use strict';

  var thumb;
  var frame = 0;
  var desktop = window.matchMedia('(min-width: 861px)');

  function ensureThumb() {
    if (thumb || !document.body) return;
    thumb = document.createElement('div');
    thumb.className = 'zk-scrollbar-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    document.body.appendChild(thumb);
  }

  function update() {
    frame = 0;
    ensureThumb();
    if (!thumb) return;

    var root = document.documentElement;
    var viewport = window.innerHeight || root.clientHeight;
    var pageHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
    var maxScroll = Math.max(0, pageHeight - viewport);

    if (!desktop.matches || maxScroll <= 1) {
      thumb.classList.remove('is-active');
      return;
    }

    var height = Math.max(42, Math.round(viewport * viewport / pageHeight));
    var maxTop = Math.max(0, viewport - height);
    var scrollTop = Math.min(maxScroll, Math.max(0, window.scrollY || root.scrollTop || 0));
    var top = Math.round(maxTop * scrollTop / maxScroll);

    thumb.style.height = height + 'px';
    thumb.style.transform = 'translate3d(0,' + top + 'px,0)';
    thumb.classList.add('is-active');
  }

  function queueUpdate() {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate, { passive: true });
  window.addEventListener('load', queueUpdate);
  desktop.addEventListener && desktop.addEventListener('change', queueUpdate);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', queueUpdate, { once: true });
  } else {
    queueUpdate();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(queueUpdate).observe(document.documentElement);
  }
  if ('MutationObserver' in window) {
    new MutationObserver(queueUpdate).observe(document.documentElement, { attributes: true, childList: true, subtree: false });
  }
}());
