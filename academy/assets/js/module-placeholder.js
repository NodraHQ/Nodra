/* =====================================================================
   MODULE PLACEHOLDER — shared behavior for modules 03 through 10.

   Only reading progress and the sidebar scrollspy are needed here:
   these pages have no quiz, no hash demo, and no copy-able technical
   values yet. When a module's real content is written (following
   Module 01/02 as the reference), this file should be replaced by a
   module-specific script the same way blockchain.js and wallets.js
   were — see "Future Global Improvements" regarding extracting the
   parts below into one shared lesson.js used everywhere.
   ===================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initReadingProgress();
    initScrollSpy();
  });

  function initReadingProgress() {
    var bar = document.getElementById('readingProgressBar');
    if (!bar) return;

    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || document.body.scrollTop;
      var scrollHeight = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight;
      var progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, progress)) + '%';
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  }

  function initScrollSpy() {
    var sections = Array.prototype.slice.call(document.querySelectorAll('.lesson-section[id]'));
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc__list a[href^="#"]'));
    var indicator = document.getElementById('tocIndicator');
    var listWrap = document.getElementById('tocListWrap');
    var sidebar = document.getElementById('sidebar');

    if (!sections.length || !tocLinks.length) return;

    var linkBySectionId = {};
    tocLinks.forEach(function (link) {
      var id = link.getAttribute('href').replace('#', '');
      linkBySectionId[id] = link;
    });

    var currentActiveId = null;

    function setActive(id) {
      if (!id || id === currentActiveId || !linkBySectionId[id]) return;
      currentActiveId = id;

      tocLinks.forEach(function (link) { link.classList.remove('is-active'); });
      var activeLink = linkBySectionId[id];
      activeLink.classList.add('is-active');

      moveIndicator(activeLink);
      scrollSidebarToActive(activeLink);
    }

    function moveIndicator(activeLink) {
      if (!indicator || !listWrap) return;
      var wrapRect = listWrap.getBoundingClientRect();
      var linkRect = activeLink.getBoundingClientRect();
      var offsetTop = linkRect.top - wrapRect.top + listWrap.scrollTop;

      indicator.style.transform = 'translateY(' + offsetTop + 'px)';
      indicator.style.height = linkRect.height + 'px';
      listWrap.classList.add('is-tracking');
    }

    function scrollSidebarToActive(activeLink) {
      if (!sidebar || window.matchMedia('(min-width: 901px)').matches) return;
      activeLink.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    var observer = new IntersectionObserver(function (entries) {
      var visible = entries
        .filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });

      if (visible.length > 0) {
        setActive(visible[0].target.id);
      }
    }, {
      rootMargin: '-15% 0px -55% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });

    sections.forEach(function (section) { observer.observe(section); });
    setActive(sections[0].id);

    window.addEventListener('resize', function () {
      if (currentActiveId && linkBySectionId[currentActiveId]) {
        moveIndicator(linkBySectionId[currentActiveId]);
      }
    });
  }
})();
