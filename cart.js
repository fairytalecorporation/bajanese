(function () {
  'use strict';

  var B = window.Bajanese;
  if (!B) return;

  var CART = 'bajanese.cart';
  var FAVES = 'bajanese.faves';
  var ORDERS = 'bajanese.orders';
  var esc = B.esc;
  var isArray = Array.isArray;

  /* ─── Storage ───
     localStorage when it works; otherwise an in-memory copy for this visit
     (private browsing, blocked site data). */

  var memory = {};

  var store = {
    get: function (key, fallback) {
      if (memory.hasOwnProperty(key)) return memory[key];
      try {
        var raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        delete memory[key];
      } catch (e) {
        memory[key] = value;
      }
    }
  };

  function getCart() {
    var cart = store.get(CART, null);
    if (!cart || !isArray(cart.lines)) cart = { locationId: null, lines: [] };
    return cart;
  }

  function saveCart(cart) {
    if (!cart.lines.length) cart.locationId = null;
    store.set(CART, cart);
    updateCount();
  }

  function getFaves() {
    var faves = store.get(FAVES, []);
    return isArray(faves) ? faves : [];
  }

  function getOrders() {
    var orders = store.get(ORDERS, []);
    return isArray(orders) ? orders : [];
  }

  function updateCount() {
    var count = 0;
    getCart().lines.forEach(function (line) { count += line.qty || 0; });
    B.forEachEl('[data-cart-count]', function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
    B.forEachEl('[data-cart-link]', function (el) {
      el.setAttribute('aria-label', 'Your order, ' + count + (count === 1 ? ' item' : ' items'));
    });
  }

  /* ─── Toast ─── */

  var toastEl = document.createElement('div');
  var toastTimer;
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);

  B.toast = function (text, link) {
    toastEl.innerHTML = '<span>' + esc(text) + '</span>' +
      (link ? '<a href="' + esc(link.href) + '">' + esc(link.text) + '</a>' : '');
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 4000);
  };

  /* ─── Adding to the cart ─── */

  function itemProblem(item, now) {
    if (item.available === false) return item.name + ' is sold out right now.';
    if (!B.isAvailableToday(item, now)) return item.name + ' is back ' + B.nextDayName(item.days, now) + '.';
    return '';
  }

  function unitPrice(item, sizeId, optionIds) {
    var size = B.findById(item.sizes, sizeId);
    if (!size) return null;
    var cents = size.priceCents;
    for (var i = 0; i < optionIds.length; i++) {
      var parts = optionIds[i].split(':');
      var option = B.findById(item.options, parts[0]);
      var choice = option ? B.findById(option.choices, parts[1]) : null;
      if (!choice) return null;
      cents += choice.priceCents || 0;
    }
    return cents;
  }

  function lineKey(itemId, sizeId, optionIds) {
    return itemId + '|' + sizeId + '|' + optionIds.slice().sort().join(',');
  }

  function addLine(item, sizeId, optionIds, data) {
    var cart = getCart();
    var locationId = item.locationIds.indexOf(cart.locationId) !== -1 ? cart.locationId : item.locationIds[0];

    if (cart.lines.length && cart.locationId !== locationId) {
      var from = B.findLocation(data.locations, cart.locationId);
      var to = B.findLocation(data.locations, locationId);
      var ok = window.confirm('Your order is from ' + (from ? from.name : 'another location') +
        '. Start a new order from ' + (to ? to.name : 'this location') + ' instead? This clears your current order.');
      if (!ok) return;
      cart = { locationId: null, lines: [] };
    }

    cart.locationId = locationId;
    var price = unitPrice(item, sizeId, optionIds);
    var key = lineKey(item.id, sizeId, optionIds);
    var existing = null;
    cart.lines.forEach(function (line) {
      if (lineKey(line.itemId, line.sizeId, line.optionIds || []) === key) existing = line;
    });
    if (existing) {
      existing.qty = Math.min(existing.qty + 1, 50);
      existing.priceCents = price;
    } else {
      cart.lines.push({ itemId: item.id, sizeId: sizeId, optionIds: optionIds, qty: 1, priceCents: price });
    }
    saveCart(cart);
    if (orderData) drawOrder();
    B.toast('Added ' + item.name + '.', document.querySelector('[data-order-page]') ? null : { href: 'order.html', text: 'View order' });
  }

  function defaultOptionIds(item) {
    var ids = [];
    (item.options || []).forEach(function (option) {
      if (option.required && option.choices.length) ids.push(option.id + ':' + option.choices[0].id);
    });
    return ids;
  }

  function startAdd(itemId) {
    B.loadData(['menu', 'locations'], function (err, data) {
      if (err) {
        B.toast('Sorry, the menu couldn\'t load. Please refresh and try again.');
        return;
      }
      var item = B.findItem(data.menu, itemId);
      if (!item) return;
      var problem = itemProblem(item, B.barbadosNow());
      if (problem) {
        B.toast(problem);
        return;
      }
      if (item.sizes.length > 1 || (item.options && item.options.length)) openPicker(item, data);
      else addLine(item, item.sizes[0].id, [], data);
    });
  }

  /* ─── Size & option picker ─── */

  var dialog = null;

  function choiceHTML(type, name, value, label, cents, checked, absolute) {
    return '<label class="choice"><span><input type="' + type + '" name="' + esc(name) + '" value="' + esc(value) + '"' +
      (checked ? ' checked' : '') + '>' + esc(label) + '</span>' +
      (cents ? '<span class="choice-price">' + (absolute ? '' : '+') + B.formatPrice(cents) + '</span>' : '') + '</label>';
  }

  function choiceFieldset(name, legend, required, choices, multiple, absolute) {
    var type = multiple ? 'checkbox' : 'radio';
    var html = '<fieldset><legend>' + esc(legend) + (required ? '' : ' <span class="optional">(optional)</span>') + '</legend>';
    if (!required && !multiple) html += choiceHTML(type, name, '', 'None', 0, true, absolute);
    choices.forEach(function (choice, i) {
      html += choiceHTML(type, name, choice.id, choice.label, choice.priceCents, !multiple && required && i === 0, absolute);
    });
    return html + '</fieldset>';
  }

  function checkedValues(form, name) {
    var values = [];
    for (var i = 0; i < form.elements.length; i++) {
      var el = form.elements[i];
      if (el.name === name && el.checked && el.value) values.push(el.value);
    }
    return values;
  }

  function openPicker(item, data) {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'picker-dialog';
      document.body.appendChild(dialog);
    }
    if (typeof dialog.showModal !== 'function') {
      addLine(item, item.sizes[0].id, defaultOptionIds(item), data);
      return;
    }

    var html = '<form class="picker"><h2 class="picker-title">' + esc(item.name) + '</h2>';
    if (item.sizes.length > 1) html += choiceFieldset('size', 'Size', true, item.sizes, false, true);
    (item.options || []).forEach(function (option) {
      html += choiceFieldset('opt-' + option.id, option.label, option.required, option.choices, option.multiple, false);
    });
    html += '<div class="picker-actions"><button type="button" class="btn btn-secondary" data-picker-cancel>Cancel</button>' +
      '<button type="submit" class="btn btn-order">Add to order</button></div></form>';
    dialog.innerHTML = html;

    var form = dialog.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var sizeId = item.sizes.length > 1 ? checkedValues(form, 'size')[0] : item.sizes[0].id;
      var optionIds = [];
      (item.options || []).forEach(function (option) {
        checkedValues(form, 'opt-' + option.id).forEach(function (choiceId) {
          optionIds.push(option.id + ':' + choiceId);
        });
      });
      dialog.close();
      addLine(item, sizeId, optionIds, data);
    });
    dialog.querySelector('[data-picker-cancel]').addEventListener('click', function () { dialog.close(); });
    dialog.showModal();
  }

  /* ─── Favourites ─── */

  function refreshFavesFilter() {
    var menu = document.querySelector('[data-menu]');
    if (!menu) return;
    var on = menu.classList.contains('is-faves-only');
    B.forEachEl('.menu-section', function (section) {
      section.hidden = on && !section.querySelector('.menu-item.is-fave');
    }, menu);
    B.forEachEl('[role="tabpanel"]', function (panel) {
      var empty = panel.querySelector('[data-faves-empty]');
      if (empty) empty.hidden = !(on && !panel.querySelector('.menu-item.is-fave'));
    }, menu);
  }

  B.syncFaves = function () {
    var faves = getFaves();
    B.forEachEl('[data-action="fave"]', function (btn) {
      var on = faves.indexOf(btn.getAttribute('data-item-id')) !== -1;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var row = btn.closest('.menu-item');
      if (row) row.classList.toggle('is-fave', on);
    });
    refreshFavesFilter();
  };

  function toggleFave(itemId) {
    var faves = getFaves();
    var index = faves.indexOf(itemId);
    if (index === -1) faves.push(itemId);
    else faves.splice(index, 1);
    store.set(FAVES, faves);
    B.syncFaves();
    B.toast(index === -1 ? 'Saved to My Faves.' : 'Removed from My Faves.');
  }

  function toggleFavesFilter(btn) {
    var menu = document.querySelector('[data-menu]');
    if (!menu) return;
    var on = !menu.classList.contains('is-faves-only');
    menu.classList.toggle('is-faves-only', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    refreshFavesFilter();
  }

  /* ─── Order page ─── */

  var orderData = null;

  function describeLine(line, data, now) {
    var item = B.findItem(data.menu, line.itemId);
    var out = { line: line, name: item ? item.name : 'An item no longer on the menu', meta: '', unitCents: 0, issues: [], blocking: false };
    function issue(text, blocking) {
      out.issues.push({ text: text, blocking: blocking });
      if (blocking) out.blocking = true;
    }
    if (!item) {
      issue('No longer on the menu', true);
      return out;
    }
    var size = B.findById(item.sizes, line.sizeId);
    var unit = unitPrice(item, line.sizeId, line.optionIds || []);
    if (!size || unit === null) {
      issue('Choices have changed. Remove it and add it again.', true);
      return out;
    }
    var labels = item.sizes.length > 1 ? [size.label] : [];
    (line.optionIds || []).forEach(function (ref) {
      var parts = ref.split(':');
      labels.push(B.findById(B.findById(item.options, parts[0]).choices, parts[1]).label);
    });
    out.meta = labels.join(' · ');
    out.unitCents = unit;
    if (item.available === false) issue('Sold out right now', true);
    else if (!B.isAvailableToday(item, now)) issue('Only available ' + B.daysText(item.days) + ', back ' + B.nextDayName(item.days, now), true);
    if (typeof line.priceCents === 'number' && line.priceCents !== unit) {
      issue('Price changed from ' + B.formatPrice(line.priceCents) + ' to ' + B.formatPrice(unit), false);
    }
    return out;
  }

  function checkCart(cart, data) {
    var now = B.barbadosNow();
    var result = { lines: [], totalCents: 0, blocking: false };
    cart.lines.forEach(function (line) {
      var desc = describeLine(line, data, now);
      result.lines.push(desc);
      result.totalCents += desc.unitCents * line.qty;
      if (desc.blocking) result.blocking = true;
    });
    return result;
  }

  function lineHTML(desc, index) {
    var name = esc(desc.name);
    return '<li class="order-line"><div class="order-line-main">' +
      '<span class="order-line-name">' + name + '</span>' +
      (desc.meta ? '<span class="order-line-meta">' + esc(desc.meta) + '</span>' : '') +
      desc.issues.map(function (issue) {
        return '<span class="order-line-issue' + (issue.blocking ? '' : ' is-info') + '">' + esc(issue.text) + '</span>';
      }).join('') +
      '<button type="button" class="link-btn" data-action="remove" data-index="' + index + '">Remove</button></div>' +
      '<div class="qty" role="group" aria-label="Quantity of ' + name + '">' +
      '<button type="button" data-action="qty-down" data-index="' + index + '" aria-label="One fewer ' + name + '">&minus;</button>' +
      '<span class="qty-value">' + desc.line.qty + '</span>' +
      '<button type="button" data-action="qty-up" data-index="' + index + '" aria-label="One more ' + name + '">+</button></div>' +
      '<span class="order-line-total">' + B.formatPrice(desc.unitCents * desc.line.qty) + '</span></li>';
  }

  function appHandoffUrl(base, cart) {
    var payload = {
      locationId: cart.locationId,
      lines: cart.lines.map(function (line) {
        return { itemId: line.itemId, sizeId: line.sizeId, optionIds: line.optionIds || [], qty: line.qty };
      })
    };
    return base + (base.indexOf('?') === -1 ? '?' : '&') + 'cart=' + encodeURIComponent(JSON.stringify(payload));
  }

  function renderRecent() {
    var section = document.querySelector('[data-recent-orders]');
    if (!section) return;
    var orders = getOrders();
    section.hidden = !orders.length;
    section.querySelector('[data-recent-list]').innerHTML = orders.map(function (order, i) {
      var loc = B.findLocation(orderData.locations, order.locationId);
      var when = new Date(order.placedAt);
      var date = isNaN(when.getTime()) ? '' : when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      var summary = (order.lines || []).map(function (line) { return line.qty + ' × ' + line.name; }).join(', ');
      return '<li class="recent-order"><div><p class="recent-order-title">' + esc(date) + ' · ' +
        esc(loc ? loc.name : 'Bajanese') + '</p><p class="recent-order-items">' + esc(summary) + '</p></div>' +
        '<div class="recent-order-side"><span>' + B.formatPrice(order.totalCents || 0) + '</span>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-action="reorder" data-index="' + i + '">Reorder</button></div></li>';
    }).join('');
  }

  function drawOrder(focusAction, focusIndex) {
    var page = document.querySelector('[data-order-page]');
    var cartEl = page.querySelector('[data-order-cart]');
    var form = page.querySelector('[data-checkout]');
    var appBox = page.querySelector('[data-app-checkout]');
    var cart = getCart();
    var check = checkCart(cart, orderData);

    renderRecent();
    page.querySelector('[data-checkout-error]').hidden = true;

    if (!check.lines.length) {
      cartEl.innerHTML = '<div class="empty-order"><p>Your order is empty.</p>' +
        '<a class="btn btn-order" href="menu.html">Browse the menu</a></div>';
      form.hidden = true;
      appBox.hidden = true;
      return;
    }

    var loc = B.findLocation(orderData.locations, cart.locationId);
    cartEl.innerHTML = '<p class="order-from">Ordering from <strong>' + esc(loc ? loc.name : 'Bajanese') + '</strong>' +
      (loc ? ' · ' + esc(B.addressLine(loc)) : '') + ' · Pickup</p>' +
      '<ul class="order-lines">' + check.lines.map(lineHTML).join('') + '</ul>' +
      '<p class="order-summary"><span>Estimated total</span><span>BBD ' + B.formatPrice(check.totalCents) + '</span></p>' +
      '<p class="hint">Our staff confirm prices when they reply. Pay when you pick up.</p>' +
      (check.blocking ? '<p class="checkout-error">Remove the flagged items to continue.</p>' : '');

    if (orderData.site.orderUrl) {
      form.hidden = true;
      appBox.hidden = check.blocking;
      appBox.querySelector('a').href = appHandoffUrl(orderData.site.orderUrl, cart);
    } else {
      appBox.hidden = true;
      form.hidden = false;
      form.querySelector('[type="submit"]').disabled = check.blocking;
    }

    if (focusAction) {
      var target = cartEl.querySelector('[data-action="' + focusAction + '"][data-index="' + focusIndex + '"]') ||
        cartEl.querySelector('[data-action="qty-up"]');
      if (target) target.focus();
    }
  }

  function changeQty(index, delta) {
    var cart = getCart();
    var line = cart.lines[index];
    if (!line) return;
    line.qty = Math.min(line.qty + delta, 50);
    if (line.qty <= 0) cart.lines.splice(index, 1);
    saveCart(cart);
  }

  function removeLine(index) {
    var cart = getCart();
    cart.lines.splice(index, 1);
    saveCart(cart);
  }

  function reorder(index) {
    var order = getOrders()[index];
    if (!order) return;
    if (getCart().lines.length && !window.confirm('Replace your current order with this one?')) return;
    saveCart({
      locationId: order.locationId,
      lines: (order.lines || []).map(function (line) {
        return { itemId: line.itemId, sizeId: line.sizeId, optionIds: line.optionIds || [], qty: line.qty, priceCents: line.priceCents };
      })
    });
    drawOrder();
    B.toast('Order added again. Check it over, then send.');
  }

  function clean(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function buildMessage(loc, check, details) {
    var lines = ['Hi ' + loc.name + '! I\'d like to order for pickup:', ''];
    check.lines.forEach(function (desc) {
      lines.push(desc.line.qty + ' × ' + desc.name + (desc.meta ? ' (' + desc.meta + ')' : '') +
        ' — ' + B.formatPrice(desc.unitCents * desc.line.qty));
    });
    lines.push('', 'Estimated total: BBD ' + B.formatPrice(check.totalCents) + ' (prices confirmed by staff)');
    lines.push('Pickup: ' + (details.time || 'As soon as possible'));
    if (details.name) lines.push('Name: ' + details.name);
    if (details.notes) lines.push('Notes: ' + details.notes);
    return lines.join('\n');
  }

  function saveOrder(cart, check) {
    var orders = getOrders();
    orders.unshift({
      placedAt: new Date().toISOString(),
      locationId: cart.locationId,
      totalCents: check.totalCents,
      lines: check.lines.map(function (desc) {
        return {
          itemId: desc.line.itemId,
          sizeId: desc.line.sizeId,
          optionIds: desc.line.optionIds || [],
          qty: desc.line.qty,
          priceCents: desc.unitCents,
          name: desc.name
        };
      })
    });
    store.set(ORDERS, orders.slice(0, 10));
  }

  function submitOrder(e) {
    e.preventDefault();
    var page = document.querySelector('[data-order-page]');
    var errorEl = page.querySelector('[data-checkout-error]');
    var cart = getCart();
    var check = checkCart(cart, orderData);
    if (!check.lines.length || check.blocking) {
      drawOrder();
      return;
    }

    var loc = B.findLocation(orderData.locations, cart.locationId);
    var number = loc && loc.whatsapp ? String(loc.whatsapp).replace(/\D/g, '') : '';
    if (!number) {
      errorEl.textContent = 'Online ordering isn\'t set up for ' + (loc ? 'the ' + loc.shortName : 'this location') +
        ' yet. Please message us on Instagram instead.';
      errorEl.hidden = false;
      return;
    }

    var message = buildMessage(loc, check, {
      name: clean(document.getElementById('order-name').value, 60),
      time: clean(document.getElementById('order-time').value, 5),
      notes: clean(document.getElementById('order-notes').value, 300)
    });
    var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);

    saveOrder(cart, check);
    saveCart({ locationId: null, lines: [] });
    e.target.reset();
    page.querySelector('[data-order-status]').textContent =
      'Your order is ready in WhatsApp. Press send there, and we\'ll reply to confirm it.';
    drawOrder();

    var win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url;
  }

  function initOrderPage() {
    var page = document.querySelector('[data-order-page]');
    if (!page) return;
    page.querySelector('[data-checkout]').addEventListener('submit', submitOrder);
    B.loadData(['menu', 'locations', 'site'], function (err, data) {
      if (err) {
        page.querySelector('[data-order-cart]').innerHTML =
          '<p class="notice">We couldn\'t load the menu, so your order can\'t be shown. Please refresh the page.</p>';
        return;
      }
      orderData = { menu: data.menu, locations: data.locations, site: data.site };
      drawOrder();
    });
  }

  /* ─── Events ─── */

  document.addEventListener('click', function (e) {
    var target = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!target) return;
    var action = target.getAttribute('data-action');
    var index = parseInt(target.getAttribute('data-index'), 10);

    if (action === 'add') startAdd(target.getAttribute('data-item-id'));
    else if (action === 'fave') toggleFave(target.getAttribute('data-item-id'));
    else if (action === 'faves-filter') toggleFavesFilter(target);
    else if (action === 'reorder') reorder(index);
    else if (orderData && (action === 'qty-up' || action === 'qty-down' || action === 'remove')) {
      if (action === 'remove') removeLine(index);
      else changeQty(index, action === 'qty-up' ? 1 : -1);
      drawOrder(action === 'remove' ? null : action, index);
    }
  });

  window.addEventListener('storage', function (e) {
    if (e.key === CART) {
      updateCount();
      if (orderData) drawOrder();
    } else if (e.key === FAVES) {
      B.syncFaves();
    }
  });

  updateCount();
  initOrderPage();

})();
