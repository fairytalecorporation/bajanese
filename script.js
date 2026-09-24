(function () {
  'use strict';

  /* ─── Canvas starry-night renderer ─── */

  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W, H;

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var skyStops = [
    { pos: 0.00, color: '#05060f' },
    { pos: 0.45, color: '#0a1024' },
    { pos: 0.75, color: '#121a38' },
    { pos: 1.00, color: '#1c2547' }
  ];

  var starColors = ['#ffffff', '#fdf4e3', '#d6e4ff', '#cfe0ff', '#fff4cc'];

  // Moon placement as fractions of the viewport so it tracks on resize.
  var moon = { xPct: 0.78, yPct: 0.22, rPct: 0.05 };

  var stars = [];
  var craters = [];
  var skyGradient, moonHalo, moonDisc, moonCx, moonCy, moonR;

  function buildStars() {
    stars = [];
    var count = Math.round((W * H) / 4500);
    if (count > 600) count = 600;
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),                // fraction of W
        y: Math.random() * 0.95,         // fraction of H
        r: Math.random() * 1.1 + 0.3,    // radius in px
        base: Math.random() * 0.5 + 0.4, // base brightness 0.4–0.9
        twSpeed: Math.random() * 1.6 + 0.4,
        twPhase: Math.random() * Math.PI * 2,
        color: starColors[(Math.random() * starColors.length) | 0]
      });
    }
  }

  // Cache the gradients that only change on resize so the frame loop stays cheap.
  function buildStatics() {
    skyGradient = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < skyStops.length; i++) {
      skyGradient.addColorStop(skyStops[i].pos, skyStops[i].color);
    }

    moonCx = moon.xPct * W;
    moonCy = moon.yPct * H;
    moonR = moon.rPct * Math.min(W, H);

    moonHalo = ctx.createRadialGradient(moonCx, moonCy, moonR * 0.6, moonCx, moonCy, moonR * 4);
    moonHalo.addColorStop(0, 'rgba(224, 233, 255, 0.18)');
    moonHalo.addColorStop(0.5, 'rgba(200, 215, 255, 0.05)');
    moonHalo.addColorStop(1, 'transparent');

    moonDisc = ctx.createRadialGradient(
      moonCx - moonR * 0.3, moonCy - moonR * 0.3, moonR * 0.2,
      moonCx, moonCy, moonR
    );
    moonDisc.addColorStop(0, '#fdfbf4');
    moonDisc.addColorStop(0.7, '#e9edf7');
    moonDisc.addColorStop(1, '#c4ccdd');
  }

  // Hand-placed craters. x/y/r are fractions of the moon radius, measured from
  // the moon's centre, so the face stays consistent across resizes.
  function buildCraters() {
    var specs = [
      [-0.30, -0.20, 0.18],
      [ 0.24, -0.04, 0.13],
      [ 0.04,  0.30, 0.20],
      [-0.46,  0.24, 0.10],
      [ 0.40,  0.34, 0.08],
      [-0.10, -0.46, 0.07],
      [ 0.32, -0.36, 0.06],
      [-0.56, -0.04, 0.06],
      [ 0.52,  0.06, 0.05],
      [-0.02,  0.02, 0.05]
    ];
    craters = [];
    for (var i = 0; i < specs.length; i++) {
      craters.push({ x: specs[i][0], y: specs[i][1], r: specs[i][2] });
    }
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStatics();
    buildStars();
    draw(0);
  }

  function drawMoon() {
    ctx.fillStyle = moonHalo;
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
    ctx.fillStyle = moonDisc;
    ctx.fill();

    // Texture the face, clipped to the disc so shading never spills past the limb.
    ctx.save();
    ctx.beginPath();
    ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
    ctx.clip();

    for (var i = 0; i < craters.length; i++) {
      var c = craters[i];
      var cx = moonCx + c.x * moonR;
      var cy = moonCy + c.y * moonR;
      var cr = c.r * moonR;

      // Concave basin: lit from upper-left, so the rim nearest the light casts a
      // shadow into the hollow (darkest up-left) and the far wall stays brighter.
      var basin = ctx.createRadialGradient(
        cx + cr * 0.25, cy + cr * 0.25, cr * 0.1,
        cx - cr * 0.10, cy - cr * 0.10, cr
      );
      basin.addColorStop(0, 'rgba(150, 154, 172, 0.04)');
      basin.addColorStop(0.55, 'rgba(96, 100, 122, 0.16)');
      basin.addColorStop(1, 'rgba(54, 58, 80, 0.32)');
      ctx.fillStyle = basin;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      // Faint highlight on the sunlit lower-right inner wall.
      ctx.strokeStyle = 'rgba(255, 252, 244, 0.22)';
      ctx.lineWidth = Math.max(0.4, cr * 0.12);
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.82, Math.PI * -0.05, Math.PI * 0.55);
      ctx.stroke();
    }

    // Limb darkening: deepen the sphere on the side away from the light.
    var limb = ctx.createRadialGradient(
      moonCx - moonR * 0.3, moonCy - moonR * 0.3, moonR * 0.2,
      moonCx, moonCy, moonR
    );
    limb.addColorStop(0, 'rgba(18, 22, 38, 0)');
    limb.addColorStop(0.72, 'rgba(18, 22, 38, 0)');
    limb.addColorStop(1, 'rgba(18, 22, 38, 0.38)');
    ctx.fillStyle = limb;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  function drawStars(time) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var alpha = s.base;
      if (!prefersReducedMotion) {
        alpha = s.base * (0.65 + 0.35 * Math.sin(time * 0.001 * s.twSpeed + s.twPhase));
      }
      if (alpha < 0) alpha = 0;

      var x = s.x * W;
      var y = s.y * H;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // Soft halo for the brightest stars.
      if (s.r > 1.1) {
        ctx.globalAlpha = alpha * 0.5;
        var glow = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4);
        glow.addColorStop(0, s.color);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(time) {
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, H);
    drawStars(time || 0);
    drawMoon();
  }

  function loop(time) {
    draw(time);
    window.requestAnimationFrame(loop);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  buildCraters();
  resize();

  if (!prefersReducedMotion && window.requestAnimationFrame) {
    window.requestAnimationFrame(loop);
  }

  /* ─── Typewriter ─── */

  function initTypewriter() {
    var el = document.getElementById('tagline-wrapper');
    if (!el) return;

    var text = 'Recordando aquellos momentos.';
    var i = 0;
    el.textContent = '';

    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    el.appendChild(cursor);

    setTimeout(function tick() {
      if (i < text.length) {
        var charNode = document.createTextNode(text[i]);
        el.insertBefore(charNode, cursor);
        i++;
        setTimeout(tick, 50 + Math.random() * 40);
      } else {
        el.classList.add('typewriter-done');
      }
    }, 800);
  }

  /* ─── Scroll reveal ─── */

  function initScrollReveal() {
    var sections = document.querySelectorAll('section:not(#hero)');
    if (!sections.length) return;

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

  /* ─── Social status ─── */

  function initSocialStatus() {
    var dots = document.querySelectorAll('.status-dot');
    if (!dots.length) return;

    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.add('checking');
    }

    fetch('status.json')
      .then(function (res) {
        if (!res.ok) throw new Error('status.json not available');
        return res.json();
      })
      .then(function (data) {
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.remove('checking');
          var link = dots[i].closest('[data-platform]');
          if (!link) {
            dots[i].classList.add('offline');
            continue;
          }
          var platform = link.getAttribute('data-platform');
          if (data[platform] === 'online') {
            dots[i].classList.add('online');
          } else {
            dots[i].classList.add('offline');
          }
        }
      })
      .catch(function () {
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.remove('checking');
          dots[i].classList.add('offline');
        }
      });
  }

  /* ─── Boot ─── */

  initTypewriter();
  initScrollReveal();
  initSocialStatus();

})();
