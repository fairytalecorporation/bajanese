(function () {
  'use strict';

  var B = window.Bajanese = {};
  document.documentElement.className += ' js';

  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  B.reducedMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  B.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  function forEachEl(selector, fn, root) {
    var list = (root || document).querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }
  B.forEachEl = forEachEl;

  /* ─── Clock ───
     Barbados is UTC-4 all year. Adding ?now=2026-09-26T13:30 to a URL pins the
     Barbados wall clock, for checking open-now badges and Grill days. */

  function pinnedClock() {
    var match = /[?&]now=([^&]+)/.exec(window.location.search);
    if (!match) return NaN;
    return Date.parse(decodeURIComponent(match[1]) + ':00Z');
  }

  B.barbadosNow = function () {
    var ms = pinnedClock();
    if (isNaN(ms)) ms = Date.now() - 4 * 60 * 60 * 1000;
    var d = new Date(ms);
    return {
      isoDay: ((d.getUTCDay() + 6) % 7) + 1,
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
      date: d.toISOString().slice(0, 10)
    };
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(mins) { return pad(Math.floor(mins / 60) % 24) + ':' + pad(mins % 60); }

  B.daysText = function (days) {
    if (!days || !days.length) return '';
    var sorted = days.slice().sort(function (a, b) { return a - b; });
    if (sorted.length === 7) return 'Every day';
    var contiguous = sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
    if (contiguous && sorted.length > 2) {
      return DAY_SHORT[sorted[0] - 1] + ' – ' + DAY_SHORT[sorted[sorted.length - 1] - 1];
    }
    return sorted.map(function (d) { return DAY_SHORT[d - 1]; }).join(', ');
  };

  B.nextDayName = function (days, now) {
    for (var step = 1; step <= 7; step++) {
      var day = ((now.isoDay - 1 + step) % 7) + 1;
      if (days.indexOf(day) !== -1) return DAY_NAMES[day - 1];
    }
    return '';
  };

  B.isAvailableToday = function (item, now) {
    if (!item.days) return true;
    return item.days.indexOf((now || B.barbadosNow()).isoDay) !== -1;
  };

  /* Hours are 7 entries starting Monday: null (closed), [openMin, closeMin],
     or "open" when the day is set but the times aren't published yet. */

  function openDays(hours) {
    var days = [];
    for (var i = 0; i < 7; i++) if (hours && hours[i]) days.push(i + 1);
    return days;
  }

  B.hoursText = function (entry) {
    if (!entry) return 'Closed';
    if (entry === 'open') return 'Open';
    return clock(entry[0]) + ' – ' + clock(entry[1]);
  };

  B.locationStatus = function (location, now) {
    now = now || B.barbadosNow();
    var today = location.hours ? location.hours[now.isoDay - 1] : null;
    if (!today) return { open: false, label: 'Closed today' };
    if (today === 'open') return { open: true, label: 'Open today' };
    if (now.minutes >= today[0] && now.minutes < today[1]) return { open: true, label: 'Open now' };
    if (now.minutes < today[0]) return { open: false, label: 'Opens at ' + clock(today[0]) };
    return { open: false, label: 'Closed now' };
  };

  /* ─── Data ─── */

  var jsonCache = {};

  B.loadJSON = function (path, cb) {
    var entry = jsonCache[path];
    if (entry) {
      if (entry.done) cb(entry.err, entry.data);
      else entry.waiting.push(cb);
      return;
    }
    entry = jsonCache[path] = { done: false, waiting: [cb] };

    function finish(err, data) {
      entry.done = true;
      entry.err = err;
      entry.data = data;
      var waiting = entry.waiting;
      entry.waiting = [];
      for (var i = 0; i < waiting.length; i++) waiting[i](err, data);
    }

    if (!window.fetch) {
      finish(new Error('fetch is not supported'));
      return;
    }
    // Revalidate so menu, hours and link changes show up as soon as they're published.
    window.fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(path + ' returned ' + res.status);
      return res.json();
    }).then(function (data) { finish(null, data); }, function (err) { finish(err); });
  };

  B.loadData = function (names, cb) {
    var result = {};
    var pending = names.length;
    var failed = false;
    names.forEach(function (name) {
      B.loadJSON('data/' + name + '.json', function (err, data) {
        if (failed) return;
        if (err) {
          failed = true;
          cb(err);
          return;
        }
        result[name] = data;
        pending -= 1;
        if (pending === 0) cb(null, result);
      });
    });
  };

  function findById(list, id) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  B.findById = findById;
  B.findItem = function (menu, id) { return findById(menu.items, id); };
  B.findLocation = function (locations, id) { return findById(locations.locations, id); };

  B.formatPrice = function (cents) {
    var dollars = cents / 100;
    return '$' + (cents % 100 === 0 ? String(dollars) : dollars.toFixed(2));
  };

  B.fromPrice = function (item) {
    if (!item.sizes || !item.sizes.length) return '';
    var min = item.sizes[0].priceCents;
    item.sizes.forEach(function (size) { if (size.priceCents < min) min = size.priceCents; });
    return (item.sizes.length > 1 ? 'from ' : '') + B.formatPrice(min);
  };

  B.formatPhone = function (phone) {
    var match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone || '');
    return match ? '+1 (' + match[1] + ') ' + match[2] + '-' + match[3] : phone;
  };

  B.addressLine = function (loc) {
    return (loc.address || []).concat([loc.parish]).join(', ');
  };

  /* ─── Site links ───
     data-site-link="key" takes its href from data/site.json. Empty keys hide the
     link, unless data-fallback names another key (and data-fallback-text relabels). */

  function applySiteLinks(site) {
    forEachEl('[data-site-link]', function (el) {
      var key = el.getAttribute('data-site-link');
      var fallback = el.getAttribute('data-fallback');
      var url = site[key];
      if (!url && fallback && site[fallback]) {
        url = site[fallback];
        if (el.getAttribute('data-fallback-text')) el.textContent = el.getAttribute('data-fallback-text');
      }
      var target = el.parentNode && el.parentNode.tagName === 'LI' ? el.parentNode : el;
      if (url) {
        el.href = key === 'email' ? 'mailto:' + url : url;
        if (key === 'email' && el.textContent.indexOf('@') !== -1) el.textContent = url;
        target.hidden = false;
      } else {
        target.hidden = true;
      }
    });
    if (site.orderUrl) {
      forEachEl('[data-order-link]', function (el) { el.href = site.orderUrl; });
    }
  }

  /* ─── Locations ─── */

  function locationCard(loc, full, now) {
    var status = B.locationStatus(loc, now);
    var esc = B.esc;
    var address = (loc.address || []).concat([loc.parish + ', ' + loc.country]);
    var html = '<article class="location-card"' + (full ? ' id="' + esc(loc.id) + '"' : '') + '>' +
      '<div class="location-card-head"><h3>' + esc(loc.name) + '</h3>' +
      '<span class="status' + (status.open ? ' is-open' : '') + '">' + esc(status.label) + '</span></div>' +
      '<p class="location-desc">' + esc(loc.description) + '</p>' +
      '<address>' + address.map(esc).join('<br>') + '</address>';

    if (full) {
      html += '<ul class="hours-list" aria-label="Opening hours">';
      for (var i = 0; i < 7; i++) {
        html += '<li' + (i === now.isoDay - 1 ? ' class="is-today"' : '') + '><span>' + DAY_NAMES[i] +
          '</span><span>' + esc(B.hoursText(loc.hours[i])) + '</span></li>';
      }
      html += '</ul>';
    } else {
      html += '<p class="location-days">' + esc(B.daysText(openDays(loc.hours))) + '</p>';
    }

    html += '<div class="location-actions">' +
      '<a class="btn btn-sm btn-order" href="menu.html#' + esc(loc.id) + '">Order</a>';
    if (!full) html += '<a class="btn btn-sm btn-secondary" href="locations.html#' + esc(loc.id) + '">Hours &amp; directions</a>';
    if (full && loc.mapsUrl) html += '<a class="btn btn-sm btn-secondary" href="' + esc(loc.mapsUrl) + '" target="_blank" rel="noopener">Map</a>';
    if (full && loc.phone) html += '<a class="btn btn-sm btn-secondary" href="tel:' + esc(loc.phone) + '">Call ' + esc(B.formatPhone(loc.phone)) + '</a>';
    if (full && loc.whatsapp) html += '<a class="btn btn-sm btn-secondary" href="https://wa.me/' + esc(loc.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>';
    return html + '</div></article>';
  }

  function renderLocations(data) {
    var now = B.barbadosNow();
    forEachEl('[data-locations]', function (el) {
      var full = el.getAttribute('data-locations') === 'full';
      el.innerHTML = data.locations.map(function (loc) { return locationCard(loc, full, now); }).join('');
      if (full) scrollToHashTarget();
    });
  }

  function scrollToHashTarget() {
    var id = window.location.hash.slice(1);
    var target = id && document.getElementById(id);
    if (target) target.scrollIntoView();
  }

  /* ─── Deals ─── */

  function renderDeals(data) {
    var today = B.barbadosNow().date;
    var active = (data.deals || []).filter(function (deal) {
      return (!deal.validFrom || deal.validFrom <= today) && (!deal.validTo || deal.validTo >= today);
    });
    forEachEl('[data-deals-section]', function (el) { el.hidden = !active.length; });
    forEachEl('[data-deals]', function (el) {
      el.innerHTML = active.map(function (deal) {
        return '<article class="deal-card">' +
          (deal.appOnly ? '<p class="card-meta">In the app</p>' : '') +
          '<h3>' + B.esc(deal.title) + '</h3><p>' + B.esc(deal.description) + '</p>' +
          (deal.validTo ? '<p class="hint">Until ' + B.esc(deal.validTo) + '</p>' : '') +
          '</article>';
      }).join('');
    });
  }

  /* ─── Menu ─── */

  B.menuItemHTML = function (item, opts) {
    var esc = B.esc;
    var now = opts.now;
    var id = esc(item.id);
    var name = esc(item.name);
    var tags = [];
    if (item.days) tags.push('<span class="badge">' + esc(B.daysText(item.days)) + '</span>');
    if (item.spicy) tags.push('<span class="tag">Spicy</span>');
    if (item.allergens && item.allergens.length) {
      tags.push('<span class="tag">Contains ' + esc(item.allergens.join(', ')) + '</span>');
    }

    var button;
    if (item.available === false) {
      button = '<button type="button" class="btn btn-sm" disabled>Sold out</button>';
    } else if (!B.isAvailableToday(item, now)) {
      button = '<button type="button" class="btn btn-sm" disabled>Back ' + esc(B.nextDayName(item.days, now)) + '</button>';
    } else {
      button = '<button type="button" class="btn btn-sm btn-order" data-action="add" data-item-id="' + id +
        '" aria-label="Add ' + name + ' to your order">Add</button>';
    }

    var level = opts.level || 4;
    var title = opts.link ? '<a href="menu.html#' + id + '">' + name + '</a>' : name;
    return '<li class="menu-item"' + (opts.anchor ? ' id="' + id + '"' : '') + ' data-item-id="' + id + '">' +
      '<div class="menu-item-main"><h' + level + ' class="menu-item-name">' + title + '</h' + level + '>' +
      (item.description ? '<p class="menu-item-desc">' + esc(item.description) + '</p>' : '') +
      (tags.length ? '<p class="menu-item-tags">' + tags.join('') + '</p>' : '') +
      '</div><div class="menu-item-side"><span class="menu-item-price">' + esc(B.fromPrice(item)) + '</span>' +
      '<div class="menu-item-actions"><button type="button" class="fave-btn" data-action="fave" data-item-id="' + id +
      '" aria-pressed="false" aria-label="Save ' + name + ' to My Faves">&#9829;&#xFE0E;</button>' + button +
      '</div></div></li>';
  };

  function renderFeatured(menu) {
    var now = B.barbadosNow();
    var featured = menu.items.filter(function (item) { return item.featured; });
    forEachEl('[data-featured]', function (el) {
      var section = el.closest('section');
      if (section) section.hidden = !featured.length;
      el.innerHTML = featured.map(function (item) {
        return B.menuItemHTML(item, { now: now, link: true, level: 3 });
      }).join('');
    });
  }

  function selectTab(root, id, focus) {
    forEachEl('[role="tab"]', function (tab) {
      var on = tab.id === 'tab-' + id;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }, root);
    forEachEl('[role="tabpanel"]', function (panel) {
      panel.hidden = panel.id !== 'panel-' + id;
    }, root);
  }

  function bindTabs(root) {
    var tablist = root.querySelector('[role="tablist"]');
    tablist.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (tab) selectTab(root, tab.id.slice(4), false);
    });
    tablist.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
      var index = tabs.indexOf(document.activeElement);
      if (index === -1) return;
      var next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(root, next.id.slice(4), true);
      e.preventDefault();
    });
  }

  function applyMenuHash(root) {
    var id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch (e) {
      return;
    }
    if (!id) return;
    if (document.getElementById('tab-' + id)) {
      selectTab(root, id, false);
      return;
    }
    var item = document.getElementById(id);
    if (!item || !item.classList.contains('menu-item')) return;
    var panel = item.closest('[role="tabpanel"]');
    if (panel) selectTab(root, panel.id.slice(6), false);
    forEachEl('.menu-item.is-highlighted', function (el) { el.classList.remove('is-highlighted'); }, root);
    item.classList.add('is-highlighted');
    item.scrollIntoView({ block: 'center' });
  }

  function renderMenu(root, menu, locationData) {
    var esc = B.esc;
    var now = B.barbadosNow();
    var locs = locationData.locations.filter(function (loc) {
      return menu.sections.some(function (section) { return section.locationId === loc.id; });
    });

    var tabs = locs.map(function (loc, i) {
      var days = openDays(loc.hours);
      var badge = days.length && days.length < 7 ? ' <span class="badge">' + esc(B.daysText(days)) + '</span>' : '';
      return '<button type="button" class="menu-tab" role="tab" id="tab-' + esc(loc.id) +
        '" aria-controls="panel-' + esc(loc.id) + '" aria-selected="' + (i === 0) +
        '" tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(loc.shortName) + badge + '</button>';
    }).join('');

    var panels = locs.map(function (loc, i) {
      var sections = menu.sections.filter(function (section) {
        return section.locationId === loc.id;
      }).map(function (section) {
        var items = menu.items.filter(function (item) { return item.section === section.id; });
        return '<section class="menu-section" aria-labelledby="section-' + esc(section.id) + '">' +
          '<h3 id="section-' + esc(section.id) + '">' + esc(section.label) + '</h3>' +
          '<ul class="menu-items">' + items.map(function (item) {
            return B.menuItemHTML(item, { now: now, anchor: true });
          }).join('') + '</ul></section>';
      }).join('');

      return '<div class="menu-panel" role="tabpanel" id="panel-' + esc(loc.id) + '" aria-labelledby="tab-' +
        esc(loc.id) + '"' + (i === 0 ? '' : ' hidden') + '>' +
        '<h2 class="visually-hidden">' + esc(loc.name) + ' menu</h2>' +
        '<p class="menu-panel-intro"><strong>' + esc(loc.name) + '</strong> · ' + esc(B.addressLine(loc)) +
        ' · <a href="locations.html#' + esc(loc.id) + '">Hours &amp; directions</a></p>' +
        '<p class="notice" data-faves-empty hidden>No favourites here yet. Tap &#9829;&#xFE0E; on a dish to save it.</p>' +
        sections + '</div>';
    }).join('');

    root.innerHTML = '<div class="menu-toolbar"><div class="menu-tabs" role="tablist" aria-label="Choose a location">' +
      tabs + '</div><button type="button" class="btn btn-sm btn-secondary" data-action="faves-filter" aria-pressed="false">' +
      '&#9829;&#xFE0E; My Faves</button></div>' + panels;

    bindTabs(root);
    applyMenuHash(root);
    window.addEventListener('hashchange', function () { applyMenuHash(root); });
  }

  function menuError(root) {
    root.innerHTML = '<p class="notice">The menu couldn\'t load. Please refresh the page, or message us on ' +
      '<a href="https://instagram.com/bajanese.bb">Instagram</a>.</p>';
  }

  /* ─── Typewriter & reveal ─── */

  function initTypewriter() {
    var el = document.querySelector('[data-typewriter]');
    if (!el || B.reducedMotion) return;
    var text = el.getAttribute('data-typewriter');
    var i = 0;
    el.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);
    setTimeout(function tick() {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text.charAt(i)), cursor);
        i++;
        setTimeout(tick, 50 + Math.random() * 40);
      }
    }, 500);
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (B.reducedMotion || !window.IntersectionObserver) {
      forEachEl('.reveal', function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    forEachEl('.reveal', function (el) { observer.observe(el); });
  }

  /* ─── Theme ───
     The inline <head> script applies a saved choice before first paint; without
     one, the site follows the system setting. */

  function initThemeToggle() {
    var root = document.documentElement;
    var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function isDark() {
      var chosen = root.getAttribute('data-theme');
      if (chosen) return chosen === 'dark';
      return !!(systemDark && systemDark.matches);
    }

    function sync() {
      forEachEl('[data-theme-toggle]', function (btn) {
        btn.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
      });
    }

    forEachEl('[data-theme-toggle]', function (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var next = isDark() ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try {
          window.localStorage.setItem('bajanese.theme', next);
        } catch (e) {
          // Storage blocked: the choice still applies for this visit.
        }
        sync();
      });
    });

    if (systemDark) {
      var onSystemChange = function () { if (!root.getAttribute('data-theme')) sync(); };
      if (systemDark.addEventListener) systemDark.addEventListener('change', onSystemChange);
      else if (systemDark.addListener) systemDark.addListener(onSystemChange);
    }
    sync();
  }

  /* ─── Boot ─── */

  initThemeToggle();
  initTypewriter();
  initReveal();

  B.loadData(['site'], function (err, data) {
    if (!err) applySiteLinks(data.site);
  });

  B.loadData(['deals'], function (err, data) {
    if (!err) renderDeals(data.deals);
  });

  B.loadData(['locations'], function (err, data) {
    if (!err) renderLocations(data.locations);
  });

  B.loadData(['menu', 'locations'], function (err, data) {
    var root = document.querySelector('[data-menu]');
    if (err) {
      if (root) menuError(root);
      return;
    }
    renderFeatured(data.menu);
    if (root) renderMenu(root, data.menu, data.locations);
    if (B.syncFaves) B.syncFaves();
  });

})();
