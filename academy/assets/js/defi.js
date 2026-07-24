/* =====================================================================
   NODRA ACADEMY — LESSON 05: DEFI FUNDAMENTALS
   Lesson-specific behavior only.

   - Does not touch translations.js (language switching / data-i18n)
   - Does not duplicate academy.js: reveal-on-scroll for ".reveal"
     elements is already provided globally by academy.js, which this
     page also loads.
   - Does not touch .navbar.
   - Reading progress, scrollspy, copy-to-clipboard and the quiz engine
     mirror assets.js (Module 04) exactly. Each module keeps its own
     independent JS by design, to reduce cross-module impact and keep
     maintenance changes local to a single module.
   ===================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initReadingProgress();
    initScrollSpy();
    initCopyButtons();
    initQuiz();
  });

  /* ===================================================================
     Reading progress bar
     =================================================================== */
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

  /* ===================================================================
     Scrollspy — highlights the active TOC entry and slides the
     indicator bar to match, using IntersectionObserver.
     =================================================================== */
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

    // Initialize on load in case the page opens mid-scroll (e.g. reload with hash)
    setActive(sections[0].id);

    window.addEventListener('resize', function () {
      if (currentActiveId && linkBySectionId[currentActiveId]) {
        moveIndicator(linkBySectionId[currentActiveId]);
      }
    });
  }

  /* ===================================================================
     Copy-to-clipboard — kept for module independence, even though this
     page has no copy targets yet.
     =================================================================== */
  function initCopyButtons() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('.copy-btn') : null;
      if (!btn) return;

      var targetId = btn.getAttribute('data-copy-target');
      var targetEl = targetId ? document.getElementById(targetId) : null;
      if (!targetEl) return;

      var text = targetEl.textContent.trim();
      copyToClipboard(text).then(function () {
        flashCopied(btn);
      });
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch (err) { /* no-op */ }
      document.body.removeChild(textarea);
      resolve();
    });
  }

  function flashCopied(btn) {
    if (btn.dataset.copyTimeout) {
      clearTimeout(Number(btn.dataset.copyTimeout));
    }
    if (!btn.dataset.originalLabel) {
      btn.dataset.originalLabel = btn.textContent;
    }
    var copiedLabelEl = document.getElementById('i18nCopiedLabel');
    btn.textContent = copiedLabelEl ? copiedLabelEl.textContent.trim() : 'Copied';
    btn.classList.add('is-copied');

    var timeoutId = setTimeout(function () {
      btn.textContent = btn.dataset.originalLabel;
      btn.classList.remove('is-copied');
    }, 1600);

    btn.dataset.copyTimeout = String(timeoutId);
  }

  /* ===================================================================
     Quiz — click to answer, instant feedback (with a link back to the
     relevant section), running score, reset.
     =================================================================== */
  function initQuiz() {
    var quizList = document.getElementById('quizList');
    if (!quizList) return;

    var items = Array.prototype.slice.call(quizList.querySelectorAll('[data-quiz-item]'));
    var summary = document.getElementById('quizSummary');
    var scoreEl = document.getElementById('quizScore');
    var totalEl = document.getElementById('quizTotal');
    var resetBtn = document.getElementById('quizResetBtn');
    var total = items.length;
    var answered = {};

    if (totalEl) totalEl.textContent = String(total);

    items.forEach(function (item, index) {
      var options = Array.prototype.slice.call(item.querySelectorAll('.quiz-option'));
      var correctFeedback = item.querySelector('.quiz-item__feedback--correct');
      var incorrectFeedback = item.querySelector('.quiz-item__feedback--incorrect');

      options.forEach(function (option) {
        option.addEventListener('click', function () {
          if (answered[index] !== undefined) return; // already answered

          var isCorrect = option.getAttribute('data-correct') === 'true';
          answered[index] = isCorrect;

          options.forEach(function (opt) {
            opt.disabled = true;
            if (opt === option) {
              opt.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
              opt.classList.add('is-selected');
            } else if (opt.getAttribute('data-correct') === 'true') {
              opt.classList.add('is-correct');
            } else {
              opt.classList.add('is-muted');
            }
          });

          if (isCorrect && correctFeedback) {
            correctFeedback.hidden = false;
          } else if (!isCorrect && incorrectFeedback) {
            incorrectFeedback.hidden = false;
          }

          maybeShowSummary();
        });
      });
    });

    function maybeShowSummary() {
      if (Object.keys(answered).length < total || !summary) return;

      var score = Object.keys(answered).filter(function (key) { return answered[key]; }).length;
      if (scoreEl) scoreEl.textContent = String(score);
      summary.hidden = false;
      summary.classList.add('reveal', 'show');
      summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        answered = {};
        if (summary) summary.hidden = true;

        items.forEach(function (item) {
          var options = Array.prototype.slice.call(item.querySelectorAll('.quiz-option'));
          options.forEach(function (opt) {
            opt.disabled = false;
            opt.classList.remove('is-correct', 'is-incorrect', 'is-selected', 'is-muted');
          });

          var correctFeedback = item.querySelector('.quiz-item__feedback--correct');
          var incorrectFeedback = item.querySelector('.quiz-item__feedback--incorrect');
          if (correctFeedback) correctFeedback.hidden = true;
          if (incorrectFeedback) incorrectFeedback.hidden = true;
        });

        items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }
})();
