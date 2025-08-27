// Поточний рік у футері
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

// Мобільне меню
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
menuBtn?.addEventListener('click', () => {
  if (!menu || !menuBtn) return;
  menu.classList.toggle('open');
  const newState = menu.classList.contains('open');
  menuBtn.setAttribute('aria-expanded', String(newState));
});

// Плавний скрол до секцій
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if(id && id.length > 1){
      const target = document.querySelector(id);
      if(target){
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        menu?.classList.remove('open');
      }
    }
  });
});

// Лайтбокс для галереї
const gallery = document.getElementById('galleryGrid');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

let lbImages = [];
let lbIndex = 0;

let zoom = 1;
let offsetX = 0, offsetY = 0;
let dragStartX = 0, dragStartY = 0;
let isDragging = false;
let pinchDist = 0;
let pinchZoom = 1;

function updateZoom(){
  if(!lightboxImg) return;
  if(zoom === 1){
    offsetX = 0;
    offsetY = 0;
    lightboxImg.style.transition = 'transform 0.3s ease';
  } else {
    lightboxImg.style.transition = 'none';
  }
  lightboxImg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  lightboxImg.style.cursor = zoom > 1 ? 'grab' : 'auto';
}
function resetZoom(){
  zoom = 1; offsetX = 0; offsetY = 0; updateZoom();
}

function openLightbox(src, alt){
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src; lightboxImg.alt = alt || 'Зображення';
  lightbox.classList.add('open');
  resetZoom();
}
function closeLightbox(){
  if (!lightbox || !lightboxImg) return;
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  lbImages = [];
  resetZoom();
}

function openGallery(images, start=0){
  lbImages = images;
  lbIndex = start;
  openLightbox(lbImages[lbIndex].src, lbImages[lbIndex].alt);
  const showControls = lbImages.length > 1;
  if(lightboxPrev && lightboxNext){
    lightboxPrev.style.display = showControls ? 'block' : 'none';
    lightboxNext.style.display = showControls ? 'block' : 'none';
  }
}
function showNext(step){
  if(!lbImages.length) return;
  lbIndex = (lbIndex + step + lbImages.length) % lbImages.length;
  openLightbox(lbImages[lbIndex].src, lbImages[lbIndex].alt);
}

gallery?.addEventListener('click', (e) => {
  const t = e.target;
  if(t && t.tagName === 'IMG'){
    const imgs = Array.from(gallery.querySelectorAll('img'));
    const arr = imgs.map(img => ({src: img.src, alt: img.alt}));
    const idx = imgs.indexOf(t);
    openGallery(arr, idx);
  }
});
lightboxPrev?.addEventListener('click', (e) => { e.stopPropagation(); showNext(-1); });
lightboxNext?.addEventListener('click', (e) => { e.stopPropagation(); showNext(1); });
lightboxClose?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', (e) => { if(e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if(!lightbox?.classList.contains('open')) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowRight') showNext(1);
  if(e.key === 'ArrowLeft') showNext(-1);
});

// Zoom & swipe controls for lightbox image
lightbox?.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.min(Math.max(zoom * factor, 1), 5);
  updateZoom();
}, { passive: false });

lightboxImg?.addEventListener('pointerdown', (e) => {
  if(e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  isDragging = true;
  lightboxImg.setPointerCapture(e.pointerId);
});
lightboxImg?.addEventListener('dragstart', (e) => e.preventDefault());
lightboxImg?.addEventListener('pointermove', (e) => {
  if(!isDragging) return;
  if(zoom > 1){
    offsetX += e.clientX - dragStartX;
    offsetY += e.clientY - dragStartY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    updateZoom();
  }
});
lightboxImg?.addEventListener('pointerup', (e) => {
  lightboxImg.releasePointerCapture(e.pointerId);
  if(isDragging && zoom === 1){
    const dx = e.clientX - dragStartX;
    if(Math.abs(dx) > 50) showNext(dx < 0 ? 1 : -1);
  }
  isDragging = false;
});
lightboxImg?.addEventListener('pointercancel', () => { isDragging = false; });

lightboxImg?.addEventListener('touchstart', (e) => {
  if(e.touches.length === 2){
    e.preventDefault();
    isDragging = false;
    pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    pinchZoom = zoom;
  }
}, {passive:false});
lightboxImg?.addEventListener('touchmove', (e) => {
  if(e.touches.length === 2){
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    zoom = Math.min(Math.max(pinchZoom * dist / pinchDist, 1), 5);
    updateZoom();
  }
}, {passive:false});

// Слайдер для карток котеджів
document.querySelectorAll('.card-gallery').forEach(gal => {
  const imgs = gal.querySelectorAll('img');
  let idx = 0;
  const show = (i) => imgs.forEach((img,j)=>img.classList.toggle('active', j===i));
  gal.querySelector('.prev')?.addEventListener('click', (e)=>{ e.stopPropagation(); idx=(idx-1+imgs.length)%imgs.length; show(idx); });
  gal.querySelector('.next')?.addEventListener('click', (e)=>{ e.stopPropagation(); idx=(idx+1)%imgs.length; show(idx); });
  gal.addEventListener('click', () => {
    const arr = Array.from(imgs).map(img => ({src: img.src, alt: img.alt}));
    openGallery(arr, idx);
  });
  show(0);
});

// Відгуки гостей (можна додати більше за потреби)
const allReviews = [
  { source: 'google', author: 'Іван', date: '2024-04-03', rating: 5, text: 'Чудовий відпочинок! Чисто і затишно.' },
  { source: 'booking', author: 'Марія', date: '2024-04-10', rating: 4.8, text: 'Сподобалося місце, є все необхідне. Власники дуже привітні і завжди готові допомогти. Номер чистий, ліжка зручні, а з вікна відкривається прекрасний вид на гори. Особливо сподобалась тераса, де ми щоранку пили каву. До центру містечка кілька хвилин ходьби, але навколо тиша й спокій, що дає змогу відпочити від міської метушні. Обовʼязково приїдемо ще!' },
  { source: 'booking', author: 'Олег', date: '2024-05-05', rating: 5, text: 'Дуже гостинні господарі та гарна природа.' },
  { source: 'booking', author: 'Наталія', date: '2024-05-20', rating: 4.5, text: 'Комфортно та затишно. Рекомендую.' },
  { source: 'google', author: 'Анна', date: '2024-06-15', rating: 5, text: 'Прекрасний сервіс і краєвиди.' },
  { source: 'google', author: 'Петро', date: '2024-06-20', rating: 5, text: 'Все сподобалось, будемо ще.' },
  { source: 'booking', author: 'Олена', date: '2024-06-25', rating: 4.2, text: 'Затишно та чисто.' },
  { source: 'google', author: 'Сергій', date: '2024-07-01', rating: 5, text: 'Красива природа та комфортні умови.' },
  { source: 'booking', author: 'Юлія', date: '2024-07-05', rating: 4.7, text: 'Дуже сподобалось перебування.' },
  { source: 'google', author: 'Роман', date: '2024-07-10', rating: 4, text: 'Добре місце для сімейного відпочинку.' }
];

function getRandomReviews(count){
  const shuffled = allReviews.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function renderStars(r){
  const full = Math.round(r);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function formatDate(str){
  return new Date(str).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatBookingScore(r){
  const score = r * 2;
  return score === 10 ? '10' : score.toFixed(1).replace('.', ',');
}

function reviewHTML(r, full=false){
  const icon = r.source === 'google' ? 'images/Google_Icon_2025.svg' : 'images/Booking.com_Icon_2022.svg';
  const ratingHtml = r.source === 'booking'
    ? `<div class="booking-rating">${formatBookingScore(r.rating)}</div>`
    : `<div class="stars" aria-label="Рейтинг: ${r.rating} з 5">${renderStars(r.rating)}</div>`;
  let text = r.text;
  if(!full && text.length > 255){
    text = `${text.slice(0,255).trim()}… <button class="read-more">Переглянути весь відгук</button>`;
  }
  return `
      <div class="review-header">
        <img class="source-icon" src="${icon}" alt="${r.source}" />
        <div>
          <div class="author">${r.author}</div>
          <div class="date">${formatDate(r.date)}</div>
        </div>
        ${ratingHtml}
      </div>
      <p>${text}</p>
  `;
}

function renderReviews(){
  const list = document.getElementById('reviewsList');
  const summary = document.getElementById('reviewSummary');
  if(!list || !summary) return;

  const reviews = getRandomReviews(10);
  list.innerHTML = '';
  reviews.forEach((r,i) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.dataset.index = String(i);
    card.innerHTML = reviewHTML(r);
    list.appendChild(card);
  });

  const cards = Array.from(list.children);
  const maxHeight = Math.max(...cards.map(c => c.offsetHeight));
  const carousel = list.parentElement;
  const padding = parseInt(getComputedStyle(carousel).getPropertyValue('--carousel-bottom-padding')) || 0;
  list.style.height = `${maxHeight + padding}px`;

  const minHeight = Math.min(...cards.map(c => c.offsetHeight));
  document.querySelectorAll('.review-nav').forEach(nav => {
    nav.style.top = `${(minHeight + padding) / 2}px`;
  });

  if(list.children.length){
    const gap = parseInt(getComputedStyle(list).columnGap || getComputedStyle(list).gap) || 0;
    const cardWidth = cards[0].offsetWidth + gap;
    const visible = Math.max(1, Math.round(list.clientWidth / cardWidth));

    for(let i = visible - 1; i >= 0; i--){
      list.insertBefore(cards[cards.length - visible + i].cloneNode(true), list.firstElementChild);
    }
    for(let i = 0; i < visible; i++){
      list.appendChild(cards[i].cloneNode(true));
    }

    const total = cards.length;
    list.scrollLeft = cardWidth * visible;
    const getMaxScroll = () => list.scrollWidth - list.clientWidth;
    const buffer = 1; // tolerance in px to detect scroll edges

    list.addEventListener('scroll', () => {
      const maxScroll = getMaxScroll();
      if (list.scrollLeft <= 0) {
        list.style.scrollBehavior = 'auto';
        list.scrollLeft += cardWidth * total;
        list.style.scrollBehavior = 'smooth';
      } else if (list.scrollLeft + buffer >= maxScroll) {
        list.style.scrollBehavior = 'auto';
        list.scrollLeft -= cardWidth * total;
        list.style.scrollBehavior = 'smooth';
      }
    });

    const prev = document.getElementById('reviewsPrev');
    const next = document.getElementById('reviewsNext');
    const scrollByCard = (dir) => {
      const maxScroll = getMaxScroll();
      if (dir > 0 && list.scrollLeft + cardWidth >= maxScroll - buffer) {
        list.style.scrollBehavior = 'auto';
        list.scrollLeft -= cardWidth * total;
        list.style.scrollBehavior = 'smooth';
      } else if (dir < 0 && list.scrollLeft - cardWidth <= buffer) {
        list.style.scrollBehavior = 'auto';
        list.scrollLeft += cardWidth * total;
        list.style.scrollBehavior = 'smooth';
      }
      list.scrollBy({ left: cardWidth * dir, behavior: 'smooth' });
    };
    prev.addEventListener('click', () => scrollByCard(-1));
    next.addEventListener('click', () => scrollByCard(1));

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.read-more');
      if(btn){
        const card = btn.closest('.review-card');
        if(!card) return;
        const idx = Number(card.dataset.index);
        openFullReview(reviews[idx]);
      }
    });
  }

  const stats = {};
  let total = 0;
  allReviews.forEach(r => {
    total += r.rating;
    stats[r.source] = stats[r.source] || {sum:0,count:0};
    stats[r.source].sum += r.rating;
    stats[r.source].count++;
  });
  const overall = (total / allReviews.length).toFixed(1);
  const sourcesHtml = Object.keys(stats).map(src => {
    const avg = (stats[src].sum / stats[src].count).toFixed(1);
    const label = src === 'google' ? 'Google' : 'Booking.com';
    const icon = src === 'google' ? 'images/Google_Icon_2025.svg' : 'images/Booking.com_Icon_2022.svg';
    return `<div class="source-rating"><img class="source-icon" src="${icon}" alt="${label}" />${label} ${avg}</div>`;
  }).join('');
  summary.innerHTML = `
    <div class="source-ratings">${sourcesHtml}</div>
    <div class="overall">Загальний рейтинг <strong>${overall}</strong> <span class="stars">${renderStars(overall)}</span></div>
  `;
}

document.addEventListener('DOMContentLoaded', renderReviews);

const reviewLightbox = document.getElementById('reviewLightbox');
const reviewLightboxContent = document.getElementById('reviewLightboxContent');
const reviewLightboxClose = document.getElementById('reviewLightboxClose');

function openFullReview(review){
  if(!reviewLightbox || !reviewLightboxContent) return;
  reviewLightboxContent.innerHTML = `<article class="review-card">${reviewHTML(review, true)}</article>`;
  reviewLightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeFullReview(){
  if(!reviewLightbox || !reviewLightboxContent) return;
  reviewLightbox.classList.remove('open');
  reviewLightboxContent.innerHTML = '';
  document.body.style.overflow = '';
}

reviewLightboxClose?.addEventListener('click', closeFullReview);
reviewLightbox?.addEventListener('click', (e) => { if(e.target === reviewLightbox) closeFullReview(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && reviewLightbox?.classList.contains('open')) closeFullReview(); });

// Price modal
const priceLightbox = document.getElementById('priceLightbox');
const priceLightboxContent = document.getElementById('priceLightboxContent');
const priceLightboxClose = document.getElementById('priceLightboxClose');

const priceInfo = {
  1: {
    title: 'Ціни за добу проживання в Котеджі #1',
    list: [
      '6 осіб: 3000 гривень',
      '5 осіб: 2800 гривень',
      '4 особи: 2600 гривень',
      '3 особи: 2400 гривень',
      '2 особи: 2200 гривень'
    ]
  },
  2: {
    title: 'Ціни за добу проживання в Котеджі #2',
    list: [
      '4 особи: 2600 гривень',
      '3 особи: 2400 гривень',
      '2 особи: 2200 гривень'
    ]
  },
  extra: 'Ціна за проживання дітей така ж, як і за проживання дорослих. Домашні улюбленці можуть проживати за додаткову плату 200 гривень за добу.'
};

function openPrices(id){
  if(!priceLightbox || !priceLightboxContent) return;
  const data = priceInfo[id];
  if(!data) return;
  const list = data.list.map(item => `<li>${item}</li>`).join('');
  priceLightboxContent.innerHTML = `
    <article class="price-card">
      <h3>${data.title}</h3>
      <ul class="price-list">${list}</ul>
      <p>${priceInfo.extra}</p>
    </article>`;
  priceLightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePrices(){
  if(!priceLightbox || !priceLightboxContent) return;
  priceLightbox.classList.remove('open');
  priceLightboxContent.innerHTML = '';
  document.body.style.overflow = '';
}

document.querySelectorAll('.price-btn').forEach(btn => {
  btn.addEventListener('click', () => openPrices(btn.dataset.cottage));
});
priceLightboxClose?.addEventListener('click', closePrices);
priceLightbox?.addEventListener('click', (e) => { if(e.target === priceLightbox) closePrices(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && priceLightbox?.classList.contains('open')) closePrices(); });

// Calendar modal
const calendarLightbox = document.getElementById('calendarLightbox');
const calendarLightboxContent = document.getElementById('calendarLightboxContent');
const calendarLightboxClose = document.getElementById('calendarLightboxClose');

const icsLinks = {
  1: 'https://ical.booking.com/v1/export?t=efa96061-4119-4efd-8218-b047a22de77f',
  2: 'https://ical.booking.com/v1/export?t=34812d3f-ed21-4935-ab56-76452c38388f'
};

function dateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function fetchIcsEvents(url){
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    const text = await res.text();
    const jcal = ICAL.parse(text);
    const comp = new ICAL.Component(jcal);
    const busy = new Set();
    comp.getAllSubcomponents('vevent').forEach(v => {
      const ev = new ICAL.Event(v);
      let day = ev.startDate.toJSDate();
      const end = ev.endDate.toJSDate();
      while (day < end) {
        busy.add(dateKey(day));
        day.setDate(day.getDate() + 1);
      }
    });
    return busy;
  } catch (e) {
    console.error('Не вдалося завантажити календар', e);
    return new Set();
  }
}

function placeTodayBtn(calendarEl){
  const toolbar = calendarEl.querySelector('.fc-header-toolbar');
  const todayBtn = toolbar?.querySelector('.fc-today-button');
  if (!toolbar || !todayBtn) return;
  let wrap = calendarEl.querySelector('.fc-today-wrap');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.className = 'fc-today-wrap';
    toolbar.after(wrap);
  }
  wrap.innerHTML = '';
  wrap.appendChild(todayBtn);
}

async function openCalendar(id){
  if(!calendarLightbox || !calendarLightboxContent) return;
  const url = icsLinks[id];
  if(!url) return;
  calendarLightboxContent.innerHTML = `
    <article class="calendar-card">
      <h3>Календар вільних для бронювання дат в Котеджі #${id}</h3>
      <div id="calendar"></div>
      <div class="legend"><div class="legend-item free"><span></span> Вільно</div><div class="legend-item busy"><span></span> Зайнято</div></div>
    </article>`;
  calendarLightbox.classList.add('open');
  document.body.style.overflow = 'hidden';

  const busyDates = await fetchIcsEvents(url);
  const calendarEl = document.getElementById('calendar');
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 12, 0);
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 600,
    locale: 'uk',
    firstDay: 1,
    headerToolbar: { left: 'prev', center: 'title', right: 'next' },
    buttonText: { today: 'Сьогодні' },
    titleFormat: { year: 'numeric', month: 'long' },
    titleDidMount: (arg) => { arg.el.textContent = arg.el.textContent.replace(/\s*р\.$/, ''); },
    validRange: { start, end },
    dayCellClassNames: (arg) => busyDates.has(dateKey(arg.date)) ? ['occupied'] : [],
    datesSet: () => placeTodayBtn(calendarEl)
  });
  calendar.render();
}

function closeCalendar(){
  if(!calendarLightbox || !calendarLightboxContent) return;
  calendarLightbox.classList.remove('open');
  calendarLightboxContent.innerHTML = '';
  document.body.style.overflow = '';
}

document.querySelectorAll('.calendar-btn').forEach(btn => {
  btn.addEventListener('click', () => openCalendar(btn.dataset.cottage));
});
calendarLightboxClose?.addEventListener('click', closeCalendar);
calendarLightbox?.addEventListener('click', (e) => { if(e.target === calendarLightbox) closeCalendar(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && calendarLightbox?.classList.contains('open')) closeCalendar(); });

// Хелпер для Viber/Telegram (за потреби)
