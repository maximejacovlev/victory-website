/* ============================================================
   AURORE — Shopify theme JS
   Real Shopify AJAX cart integration
   ============================================================ */

(function(){
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ------- Shopify money formatting (handles {{amount}} etc.)
  function formatMoney(cents, format){
    format = format || (window.theme && window.theme.moneyFormat) || '€{{amount}}';
    if (typeof cents === 'string') cents = cents.replace('.','');
    const value = (cents/100);
    const placeholder = /\{\{\s*(\w+)\s*\}\}/;

    function thousands(num, decimals, ts, ds){
      if (isNaN(num) || num == null) return 0;
      decimals = (decimals == null) ? 2 : decimals;
      const fixed = (Math.abs(parseFloat(num)).toFixed(decimals)).toString().split('.');
      const left = fixed[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + (ts || ','));
      const right = fixed[1] ? (ds || '.') + fixed[1] : '';
      return left + right;
    }

    let formatted = format;
    switch(format.match(placeholder)[1]){
      case 'amount':                 formatted = format.replace(placeholder, thousands(value, 2)); break;
      case 'amount_no_decimals':     formatted = format.replace(placeholder, thousands(value, 0)); break;
      case 'amount_with_comma_separator':           formatted = format.replace(placeholder, thousands(value, 2, '.', ',')); break;
      case 'amount_no_decimals_with_comma_separator': formatted = format.replace(placeholder, thousands(value, 0, '.', ',')); break;
      case 'amount_with_space_separator':           formatted = format.replace(placeholder, thousands(value, 2, ' ', ',')); break;
      case 'amount_no_decimals_with_space_separator': formatted = format.replace(placeholder, thousands(value, 0, ' ')); break;
    }
    return formatted;
  }

  // ------- Cart API
  const routes = (window.theme && window.theme.routes) || {
    cart_add_url:    '/cart/add',
    cart_change_url: '/cart/change',
    cart_url:        '/cart',
    cart_get_url:    '/cart.js'
  };

  async function fetchCart(){
    const r = await fetch(routes.cart_get_url, {headers:{'Accept':'application/json'}});
    return r.json();
  }

  async function addItem(variantId, quantity){
    const r = await fetch(routes.cart_add_url + '.js', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({id: variantId, quantity: quantity || 1})
    });
    if (!r.ok) {
      const err = await r.json().catch(()=>({description:'Unable to add to cart'}));
      throw new Error(err.description || 'Unable to add to cart');
    }
    return r.json();
  }

  async function changeItem(key, quantity){
    const r = await fetch(routes.cart_change_url + '.js', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({id: key, quantity: quantity})
    });
    return r.json();
  }

  // ------- UI helpers
  function openDrawer(){ $('#cartDrawer')?.classList.add('show'); $('#scrim')?.classList.add('show'); document.body.style.overflow='hidden' }
  function closeDrawer(){ $('#cartDrawer')?.classList.remove('show'); $('#scrim')?.classList.remove('show'); document.body.style.overflow='' }
  function openMenu(){ $('#menuOverlay')?.classList.add('show'); document.body.style.overflow='hidden' }
  function closeMenu(){ $('#menuOverlay')?.classList.remove('show'); document.body.style.overflow='' }

  let toastT;
  function toast(msg){
    const el = $('#toast'); if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(()=>el.classList.remove('show'), 2400);
  }
  window.aurore_toast = toast;

  // ------- Cart rendering
  function renderCart(cart){
    const body = $('#cartDrawerBody');
    const foot = $('#cartDrawerFoot');
    const count = cart.item_count;
    $$('[data-cart-count]').forEach(el => el.textContent = count);

    if (!body) return;
    if (count === 0){
      body.innerHTML = `<div class="cart-empty"><p>Empty for now.</p><small>Add a bottle and it will rest here.</small></div>`;
      if (foot) foot.style.display = 'none';
      return;
    }
    if (foot) foot.style.display = '';

    body.innerHTML = cart.items.map(line => `
      <div class="cart-item" data-key="${line.key}">
        <div class="thumb">${line.image ? `<img src="${line.image}" alt="">` : ''}</div>
        <div>
          <div class="name">${line.product_title}</div>
          <div class="meta">${line.variant_title && line.variant_title !== 'Default Title' ? line.variant_title : ''}</div>
          <div class="qty">
            <button type="button" data-qty="-1" data-key="${line.key}" aria-label="Decrease">−</button>
            <span>${line.quantity}</span>
            <button type="button" data-qty="1" data-key="${line.key}" aria-label="Increase">+</button>
          </div>
          <a class="cart-item-remove" data-key="${line.key}" data-remove>Remove</a>
        </div>
        <div class="price">${formatMoney(line.final_line_price)}</div>
      </div>
    `).join('');

    const totalEl = $('#cartTotal');
    if (totalEl) totalEl.textContent = formatMoney(cart.total_price);
  }

  async function refresh(){
    try { const cart = await fetchCart(); renderCart(cart); }
    catch(e){ console.error(e); }
  }

  // ------- Add-to-cart wiring (works for both <form action="/cart/add"> and [data-add])
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[action$="/cart/add"]');
    if (!form) return;
    e.preventDefault();
    const idInput = form.querySelector('[name="id"]');
    const qtyInput = form.querySelector('[name="quantity"]');
    if (!idInput) return;
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.setAttribute('disabled','');
    try {
      await addItem(idInput.value, qtyInput ? +qtyInput.value : 1);
      await refresh();
      openDrawer();
      toast('Added to cart');
    } catch(err){
      toast(err.message || 'Could not add');
    } finally {
      if (btn) btn.removeAttribute('disabled');
    }
  });

  // ------- Cart drawer qty / remove (event delegation)
  document.addEventListener('click', async (e) => {
    const qBtn = e.target.closest('[data-qty]');
    if (qBtn){
      const key = qBtn.dataset.key;
      const delta = parseInt(qBtn.dataset.qty, 10);
      const row = qBtn.closest('.cart-item');
      const current = parseInt(row.querySelector('.qty span').textContent, 10);
      const cart = await changeItem(key, Math.max(0, current + delta));
      renderCart(cart);
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm){
      const cart = await changeItem(rm.dataset.key, 0);
      renderCart(cart);
      return;
    }
    if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openDrawer(); refresh(); }
    if (e.target.closest('[data-close-cart]')) closeDrawer();
    if (e.target.closest('[data-open-menu]'))  openMenu();
    if (e.target.closest('[data-close-menu]')) closeMenu();
    if (e.target.matches('#scrim')) closeDrawer();
    if (e.target.closest('#menuOverlay a'))   closeMenu();
  });

  // ------- Nav solid on scroll
  function navOnScroll(){
    const nav = $('#siteNav');
    const hero = $('.hero');
    if (!nav) return;
    const heroH = hero ? hero.offsetHeight - 80 : 200;
    nav.classList.toggle('solid', window.scrollY > heroH);
  }
  window.addEventListener('scroll', navOnScroll, {passive:true});
  navOnScroll();

  // ------- Reveal-on-scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting){
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
  $$('.reveal').forEach(el => io.observe(el));

  // ------- Subtle parallax on hero
  const heroPhoto = $('.hero-photo');
  if (heroPhoto){
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight){
        heroPhoto.style.transform = `translateY(${y * 0.15}px) scale(1.05)`;
      }
    }, {passive:true});
  }

  // ------- PDP variant picker
  $$('[data-variant-picker]').forEach(picker => {
    picker.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-variant-id]');
      if (!opt) return;
      picker.querySelectorAll('[data-variant-id]').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const form = document.querySelector('form[action$="/cart/add"]');
      if (form){
        form.querySelector('[name="id"]').value = opt.dataset.variantId;
        const priceEl = document.querySelector('[data-variant-price]');
        if (priceEl && opt.dataset.price) priceEl.textContent = formatMoney(opt.dataset.price);
      }
    });
  });

  // ------- Newsletter inline success
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('.nl-form');
    if (!f) return;
    // Let Shopify customer form handle the POST — show optimistic message
    setTimeout(() => {
      const ok = f.querySelector('.nl-success');
      if (ok) ok.style.display = 'block';
    }, 200);
  });

  // ------- Boot: refresh cart on load so badge is accurate
  refresh();

})();
