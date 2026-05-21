/* =========================================================
   VICTORY. — Shared cart / nav / drawer logic
   ========================================================= */

const PRODUCTS = {
  'victory-rose': {
    title: 'Victory Rosé',
    sub:   'St. Tropez · 75cl',
    price: 3600,
    variant: '40123456789',
    image: 'assets/rose-1.png',
    href: 'products/rose.html',
    shopifyProductId: '15924690420094',
  },
  'victory-gin': {
    title: 'Victory Gin',
    sub:   'London Dry · 50cl',
    price: 4800,
    variant: '40123456790',
    image: 'assets/gin-1.png',
    href: 'products/gin.html',
    shopifyProductId: '15924690616702',
  },
  'victory-rouge': {
    title: 'Victory Rouge',
    sub:   'St. Tropez · 75cl',
    price: 4200,
    variant: '40123456791',
    image: 'assets/rouge-1.png',
    href: 'products/rouge.html',
    shopifyProductId: '15924690190718',
  },
  'victory-blanc': {
    title: 'Victory Blanc',
    sub:   'Sancerre · 75cl',
    price: 4000,
    variant: '40123456792',
    image: 'assets/blanc-1.png',
    href: 'products/blanc.html',
    shopifyProductId: '15924689666430',
  }
};

// allow product pages (subfolder) to fix asset paths
function rebasePaths(prefix){
  Object.values(PRODUCTS).forEach(p => {
    if(!p.image.startsWith(prefix)) p.image = prefix + p.image;
    if(!p.href.startsWith(prefix))  p.href  = prefix + p.href;
  });
}

const cart = JSON.parse(localStorage.getItem('victory-cart') || '[]');
function persistCart(){ localStorage.setItem('victory-cart', JSON.stringify(cart)); }

function usesShopify(product){
  return !!(product && product.shopifyProductId && window.VictoryShopify);
}

async function addToShopifyCart(product, qty){
  if (!usesShopify(product)) {
    console.log('[Shopify-stub] POST /cart/add.js', {id: product.variant, quantity: qty});
    return { ok: true };
  }
  await window.VictoryShopify.init();
  return window.VictoryShopify.addLineItem(product.shopifyProductId, qty);
}

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function fmt(cents){ return '€' + (cents/100).toFixed(0); }

function localCartLines(){
  return cart.filter((line) => !usesShopify(PRODUCTS[line.id]));
}

function renderLocalLine(line){
  const p = PRODUCTS[line.id]; if(!p) return '';
  return `
    <div class="cart-item">
      <div class="thumb"><img src="${p.image}" alt=""></div>
      <div>
        <div class="name">${p.title}</div>
        <div class="meta">${p.sub}</div>
        <div class="qty">
          <button onclick="changeQty('${line.id}', -1)" aria-label="Decrease">−</button>
          <span>${line.qty}</span>
          <button onclick="changeQty('${line.id}', 1)" aria-label="Increase">+</button>
        </div>
      </div>
      <div class="price">${fmt(p.price * line.qty)}</div>
    </div>
  `;
}

function renderShopifyLine(line){
  const meta = line.variantTitle ? `<div class="meta">${line.variantTitle}</div>` : '';
  const thumb = line.image ? `<img src="${line.image}" alt="">` : '';
  const price = window.VictoryShopify.money(line.linePrice || line.unitPrice * line.quantity);
  return `
    <div class="cart-item" data-shopify-line="${line.id}">
      <div class="thumb">${thumb}</div>
      <div>
        <div class="name">${line.title}</div>
        ${meta}
        <div class="qty">
          <button onclick="changeShopifyQty('${line.id}', -1)" aria-label="Decrease">−</button>
          <span>${line.quantity}</span>
          <button onclick="changeShopifyQty('${line.id}', 1)" aria-label="Increase">+</button>
        </div>
      </div>
      <div class="price">${price}</div>
    </div>
  `;
}

async function renderCart(){
  const body = $('#drawerBody');
  const foot = $('#drawerFoot');
  const cc = $('#cartCount');

  let shopifySummary = { count: 0, lines: [], total: 0 };
  if (window.VictoryShopify) {
    try {
      await window.VictoryShopify.init();
      shopifySummary = await window.VictoryShopify.getCartSummary();
    } catch (e) {
      console.error('[VictoryShopify]', e);
    }
  }

  const localLines = localCartLines();
  const localCount = localLines.reduce((s, l) => s + l.qty, 0);
  const count = localCount + shopifySummary.count;
  if (cc) cc.textContent = count;
  if (!body) return;

  if (!count) {
    body.innerHTML = `<div class="cart-empty"><p>Empty for now.</p><small>Add a bottle and it will rest here.</small></div>`;
    if (foot) foot.style.display = 'none';
    return;
  }

  if (foot) foot.style.display = '';
  const html = [
    ...shopifySummary.lines.map(renderShopifyLine),
    ...localLines.map(renderLocalLine),
  ].join('');
  body.innerHTML = html;

  const localTotal = localLines.reduce((s, l) => s + (PRODUCTS[l.id]?.price || 0) * l.qty, 0);
  const totalCents = localTotal + Math.round(shopifySummary.total * 100);
  const ct = $('#cartTotal');
  if (ct) {
    ct.textContent = shopifySummary.lines.length && !localLines.length
      ? window.VictoryShopify.money(shopifySummary.total)
      : fmt(totalCents);
  }
}

function changeQty(id, delta){
  const line = cart.find(l=>l.id===id);
  if(!line) return;
  line.qty += delta;
  if(line.qty <= 0) cart.splice(cart.indexOf(line), 1);
  persistCart();
  renderCart();
}

async function changeShopifyQty(lineItemId, delta){
  if (!window.VictoryShopify) return;
  try {
    await window.VictoryShopify.init();
    const summary = await window.VictoryShopify.getCartSummary();
    const line = summary.lines.find((l) => l.id === lineItemId);
    if (!line) return;
    await window.VictoryShopify.changeLineQuantity(lineItemId, line.quantity + delta);
    await renderCart();
  } catch (e) {
    toast(e.message || 'Could not update cart');
  }
}
window.changeShopifyQty = changeShopifyQty;

async function addToCart(id, qty=1){
  const p = PRODUCTS[id];
  if(!p) return;

  const btn = document.querySelector(`[data-add="${id}"]`);
  if (btn) btn.setAttribute('disabled', '');

  try {
    if (usesShopify(p)) {
      await addToShopifyCart(p, qty);
    } else {
      const line = cart.find(l=>l.id===id);
      if(line) line.qty += qty; else cart.push({id, qty});
      await addToShopifyCart(p, qty);
      persistCart();
    }
    await renderCart();
    openDrawer();
    toast(`${p.title} — added`);
  } catch (e) {
    toast(e.message || 'Could not add to cart');
  } finally {
    if (btn) btn.removeAttribute('disabled');
  }
}

async function goToCheckout(){
  if (!window.VictoryShopify) {
    toast('Checkout unavailable');
    return;
  }
  try {
    await window.VictoryShopify.init();
    const summary = await window.VictoryShopify.getCartSummary();
    if (!summary.count) {
      toast('Your cart is empty');
      return;
    }
    await window.VictoryShopify.redirectToCheckout();
  } catch (e) {
    toast(e.message || 'Checkout unavailable');
  }
}
window.goToCheckout = goToCheckout;

function openDrawer(){ $('#drawer')?.classList.add('show'); $('#scrim')?.classList.add('show'); }
function closeDrawer(){ $('#drawer')?.classList.remove('show'); $('#scrim')?.classList.remove('show'); }
function openMenu(){ $('#menuOverlay')?.classList.add('show'); }
function closeMenu(){ $('#menuOverlay')?.classList.remove('show'); }

let toastT;
function toast(msg){
  const el = $('#toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>el.classList.remove('show'), 2200);
}

function wireUi(){
  $('#cartBtn')?.addEventListener('click', openDrawer);
  $('#drawerClose')?.addEventListener('click', closeDrawer);
  $('#scrim')?.addEventListener('click', closeDrawer);
  $('#menuBtn')?.addEventListener('click', openMenu);
  $('#menuClose')?.addEventListener('click', closeMenu);
  $$('#menuOverlay a').forEach(a => a.addEventListener('click', closeMenu));
  $$('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.add, parseInt(btn.dataset.qty || '1', 10)));
  });
  $('#checkoutBtn')?.addEventListener('click', goToCheckout);

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold: .12, rootMargin: '0px 0px -8% 0px'});
  $$('.reveal').forEach(el => io.observe(el));

  renderCart();
}

document.addEventListener('DOMContentLoaded', wireUi);
