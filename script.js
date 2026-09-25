(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Typewriter ─── */

  function initTypewriter() {
    var el = document.getElementById('tagline-wrapper');
    if (!el) return;

    var text = 'Bajan meets Chinese.';
    var i = 0;
    el.textContent = '';

    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    el.appendChild(cursor);

    if (prefersReducedMotion) {
      el.insertBefore(document.createTextNode(text), cursor);
      el.classList.add('typewriter-done');
      return;
    }

    setTimeout(function tick() {
      if (i < text.length) {
        var charNode = document.createTextNode(text[i]);
        el.insertBefore(charNode, cursor);
        i++;
        setTimeout(tick, 50 + Math.random() * 40);
      } else {
        el.classList.add('typewriter-done');
      }
    }, 500);
  }

  /* ─── Scroll reveal ─── */

  function initScrollReveal() {
    var sections = document.querySelectorAll('section:not(#hero)');
    if (!sections.length) return;

    if (prefersReducedMotion || !window.IntersectionObserver) {
      for (var j = 0; j < sections.length; j++) {
        sections[j].classList.add('visible');
      }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    for (var i = 0; i < sections.length; i++) {
      observer.observe(sections[i]);
    }
  }

  /* ─── Open-now status ───
     Hours list order matches the DOM order below (Mon–Sun), each entry as
     [openMinutes, closeMinutes] from midnight, or null when closed all day.
     Times are interpreted in Barbados local time (AST, UTC-4, no DST). */

  var weekHours = [
    null,           // Monday — closed
    [11 * 60, 21 * 60], // Tuesday
    [11 * 60, 21 * 60], // Wednesday
    [11 * 60, 21 * 60], // Thursday
    [11 * 60, 22 * 60], // Friday
    [11 * 60, 22 * 60], // Saturday
    [12 * 60, 20 * 60]  // Sunday
  ];

  function initOpenStatus() {
    var el = document.getElementById('open-status');
    if (!el) return;

    var nowUtcMinutes = (function () {
      var now = new Date();
      return now.getUTCHours() * 60 + now.getUTCMinutes();
    })();

    // Barbados is UTC-4 year-round.
    var barbadosMinutes = nowUtcMinutes - 4 * 60;
    var dayOffset = 0;
    if (barbadosMinutes < 0) {
      barbadosMinutes += 24 * 60;
      dayOffset = -1;
    }

    var utcDay = new Date().getUTCDay(); // 0 = Sunday
    var barbadosDay = (utcDay + dayOffset + 7) % 7;
    var mondayIndexedDay = (barbadosDay + 6) % 7; // 0 = Monday

    var today = weekHours[mondayIndexedDay];
    var isOpen = !!today && barbadosMinutes >= today[0] && barbadosMinutes < today[1];

    el.textContent = isOpen ? 'Open now' : 'Closed now';
    el.classList.add(isOpen ? 'is-open' : 'is-closed');
  }

  /* ─── Boot ─── */

  initTypewriter();
  initScrollReveal();
  initOpenStatus();

})();
