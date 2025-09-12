// Роки у футері
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) {
    const startYear = 2006;
    const currentYear = new Date().getFullYear();
    y.textContent = currentYear === startYear ? String(startYear) : `${startYear}-${currentYear}`;
  }
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

// Плавний скрол до секцій з урахуванням висоти хедера
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if(id && id.length > 1){
      const target = document.querySelector(id);
      if(target){
        e.preventDefault();

        const headerHeight = document.querySelector('header')?.offsetHeight || 0;
        const paddingTop = parseFloat(getComputedStyle(target).paddingTop) || 0;
        const margin = 16; // невеликий відступ під хедером
        const elementTop = target.getBoundingClientRect().top + window.pageYOffset;
        const offset = elementTop - headerHeight - margin + paddingTop;

        window.scrollTo({ top: offset, behavior: 'smooth' });
        menu?.classList.remove('open');
      }
    }
  });
});

// Підсвічування пунктів меню при скролі
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.menu a');

// Відстежуємо видиму площу кожної секції та підсвічуємо ту,
// яка займає більшу частину екрана
const visible = new Map();
let activeId = '';

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const id = entry.target.getAttribute('id');
    if(entry.intersectionRatio > 0){
      visible.set(id, entry.intersectionRatio);
    } else {
      visible.delete(id);
    }
  });

  let maxRatio = 0;
  let newActive = activeId;
  visible.forEach((ratio, id) => {
    if(ratio > maxRatio){
      maxRatio = ratio;
      newActive = id;
    }
  });

  if(newActive !== activeId){
    activeId = newActive;
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
    });
  }
}, {
  threshold: Array.from({length: 101}, (_, i) => i / 100)
});

sections.forEach(section => observer.observe(section));

const MODAL_TRANSITION_MS = 300;

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
  setTimeout(() => {
    lightboxImg.src = '';
    lbImages = [];
    resetZoom();
  }, MODAL_TRANSITION_MS);
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
  { source: 'booking', author: 'Anna', date: '2022-11-19', rating: 10,
    text: 'Місцерозташування казкове- за котеджем починається ліс, подалі від черги на джерела та дороги, спокій, прекрасна панорама, доглянута велика територія з качелями і мангалом, закритий паркінг для машин. В будинку тепло і затишно, є все необхідне.' },
  { source: 'booking', author: 'Марія', date: '2024-04-10', rating: 4.8,
    text: 'Сподобалося місце, є все необхідне. Власники дуже привітні і завжди готові допомогти. Номер чистий, ліжка зручні, а з вікна відкривається прекрасний вид на гори. Особливо сподобалась тераса, де ми щоранку пили каву. До центру містечка кілька хвилин ходьби, але навколо тиша й спокій, що дає змогу відпочити від міської метушні. Обовʼязково приїдемо ще!' },
  { source: 'booking', author: 'Дмитро', date: '2023-02-19', rating: 10,
    text: 'Все дуже затишно i гарно. Гарний будинок iз дерева, красива природа.' },
  { source: 'booking', author: 'Anna', date: '2023-07-21', rating: 9.0,
    text: 'Плюси:<br>' +
        '- перш за все - це розташування: будиночок знаходиться на околиці міста та ще й на горі, тому вид там надчудовий, чудовий варіант для спостереження за заходами та сходами сонця<br>' +
        '- чуйний та ввічливий господар, який завжди на зв’язку і у разі виникнення питань, швидко їх вирішує<br>' +
        '- добре облаштована територія: гойдалки, альтанки, мангал, балкон та багато місця для активностей (ми були з песиком - йому було де розігнатися)<br>' +
        '- в будинку було все необхідне<br>' +
        '- їздила з батьками 50+ віку, їм сподобалося дуже, тому для сімейного спокійного відпочинку - це чудовий варіант<br><br>' +
        'Мінуси:<br>' +
        '- незручна дешева, приходилося довго прибирати після прийняття душу'},
  { source: 'booking', author: 'Андрій', date: '2023-09-19', rating: 10,
    text: 'Дуже приємний господар. Чудовий відпочинок. Адекватна ціна. Як котедж, так і територія охайні та придбані. Є мангальна зона та дрова для смаження шашлику, діти можуть пограти в бадмінтон чи інші ігри у дворі. До джерел №5 та №6 десять хвилин пішки (тропою через ліс), джерело 2С також відносно недалеко. Зручно, що в котеджі два санвузла (на обох поверхах). Із ньюансів - упродовж нашого відпочинку на горі щось будували й дорогою біля котеджу їздило дуже багато вантажних машин - мені це не заважало, проте людям, які чутливо сплять, слід це врахувати (з розмови з сусідом зрозумів, що проблема виникла нещодавно, вони намагаються з цим (проіздом вантажівок через село) боротися, оскільки начебто є обїздна дорога, проте досі не вдається).' },
  { source: 'booking', author: 'Игорь', date: '2024-04-21', rating: 10,
    text: 'дуже рекомендую для сімейного так і для компанії друзів відпочинку. чудова гарна територія, двоповерховий котедж дає змогу розміститися компанії друзів. ванна туалет кухня кухонні прилади все є. альтанка мангал качелі.' },
  { source: 'booking', author: 'Hanna', date: '2025-08-22', rating: 10,
    text: 'Поряд було де їсти комплексні обіди. Дуже гарний вид на гори та ліс. Недалеко від центру усюди можна дійти за 30 хвилин. Локація супер. Господар привітний. З усім допоміг. Дуже сподобалося. Є мангал, дрова, альтанки. Прекрасна відпочили.' },
  { source: 'google', author: 'Ludmila', date: '2024-07-01', rating: 5,
    text: 'Красива природа та комфортні умови.' },
  { source: 'booking', author: 'Юлія', date: '2024-07-05', rating: 4.7,
    text: 'Дуже сподобалось перебування.' },
  { source: 'google', author: 'Роман', date: '2024-07-10', rating: 4,
    text: 'Добре місце для сімейного відпочинку.' }
];

// Рейтинги для відображення у підсумку (можна змінювати вручну)
const summaryRatings = {
  google: 4.7,
  booking: 9.4
};

function getRandomReviews(count){
  const shuffled = allReviews.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function renderStars(r){
  const stars = [];
  for(let i = 1; i <= 5; i++){
    let fill = 0;
    if(r >= i) fill = 100;
    else if(r + 1 > i) fill = Math.round((r - (i - 1)) * 100);
    stars.push(`<span class="star" style="--fill:${fill}%;">★</span>`);
  }
  return stars.join('');
}

function formatDate(str){
  const date = new Date(str);
  const now = new Date();
  const diff = date - now;
  const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'always' });
  const units = [
    { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: 'day', ms: 1000 * 60 * 60 * 24 },
    { unit: 'hour', ms: 1000 * 60 * 60 },
    { unit: 'minute', ms: 1000 * 60 }
  ];
  for (const {unit, ms} of units) {
    const value = diff / ms;
    if (Math.abs(value) >= 1) {
      return rtf.format(Math.round(value), unit);
    }
  }
  return rtf.format(0, 'second');
}

function formatBookingScore(r){
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
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

  const sourcesHtml = Object.entries(summaryRatings).map(([src, rating]) => {
    const label = src === 'google' ? 'Google' : 'Booking.com';
    const icon = src === 'google' ? 'images/Google_Icon_2025.svg' : 'images/Booking.com_Icon_2022.svg';
    const ratingHtml = src === 'google'
      ? `${rating.toFixed(1)} <span class="stars">${renderStars(rating)}</span>`
      : `<div class="booking-rating">${formatBookingScore(rating)}</div>`;
    return `<div class="source-rating"><img class="source-icon" src="${icon}" alt="${label}" />${label} ${ratingHtml}</div>`;
  }).join('');
  summary.innerHTML = `<div class="source-ratings">${sourcesHtml}</div>`;
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
  setTimeout(() => {
    reviewLightboxContent.innerHTML = '';
    document.body.style.overflow = '';
  }, MODAL_TRANSITION_MS);
}

reviewLightboxClose?.addEventListener('click', closeFullReview);
reviewLightbox?.addEventListener('click', (e) => { if(e.target === reviewLightbox) closeFullReview(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && reviewLightbox?.classList.contains('open')) closeFullReview(); });

// FAQ modal
const faqBtn = document.getElementById('faqBtn');
const faqLightbox = document.getElementById('faqLightbox');
const faqLightboxClose = document.getElementById('faqLightboxClose');

function openFaq(){
  faqLightbox?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeFaq(){
  faqLightbox?.classList.remove('open');
  document.body.style.overflow = '';
}

faqBtn?.addEventListener('click', openFaq);
faqLightboxClose?.addEventListener('click', closeFaq);
faqLightbox?.addEventListener('click', (e) => { if(e.target === faqLightbox) closeFaq(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && faqLightbox?.classList.contains('open')) closeFaq(); });

document.querySelectorAll('.faq-item').forEach(item => {
  const btn = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  if (!btn || !answer) return;

  function toggle() {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    item.classList.toggle('open', !expanded);
    if (!expanded) {
      answer.setAttribute('aria-hidden', 'false');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      answer.addEventListener(
        'transitionend',
        (e) => {
          if (e.propertyName === 'max-height') {
            answer.style.maxHeight = 'none';
          }
        },
        { once: true }
      );
    } else {
      answer.style.maxHeight = answer.scrollHeight + 'px';
      requestAnimationFrame(() => {
        answer.style.maxHeight = '0';
      });
      answer.addEventListener(
        'transitionend',
        (e) => {
          if (e.propertyName === 'max-height') {
            answer.setAttribute('aria-hidden', 'true');
          }
        },
        { once: true }
      );
    }
  }

  btn.addEventListener('click', toggle);
  answer.addEventListener('click', toggle);
});

// Price modal
const priceLightbox = document.getElementById('priceLightbox');
const priceLightboxContent = document.getElementById('priceLightboxContent');
const priceLightboxClose = document.getElementById('priceLightboxClose');

const priceInfo = {
  1: {
    title: 'Ціни за добу проживання в Котеджі #1',
    table: [
      { guests: '6 осіб', price: '3600 грн' },
      { guests: '5 осіб', price: '3300 грн' },
      { guests: '4 особи', price: '3000 грн' },
      { guests: '3 особи', price: '2700 грн' },
      { guests: '1-2 особи', price: '2400 грн' }
    ]
  },
  2: {
    title: 'Ціни за добу проживання в Котеджі #2',
    table: [
      { guests: '4 особи', price: '3000 грн' },
      { guests: '3 особи', price: '2700 грн' },
      { guests: '1-2 особи', price: '2400 грн' }
    ]
  },
  notes: [
    'Ціна за проживання дітей така ж, як і за проживання дорослих.',
    'Домашні улюбленці можуть проживати за додаткову плату 200 гривень за добу.'
  ]
};

function openPrices(id){
  if(!priceLightbox || !priceLightboxContent) return;
  const data = priceInfo[id];
  if(!data) return;
  const rows = data.table.map(r => `<tr><td>${r.guests}</td><td>${r.price}</td></tr>`).join('');
  const notes = priceInfo.notes.map(n => `<li>${n}</li>`).join('');
  priceLightboxContent.innerHTML = `
    <article class="price-card">
      <h3>${data.title}</h3>
      <table class="price-table">
        <thead><tr><th>Кількість гостей</th><th>Ціна за добу</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <ul class="price-notes">${notes}</ul>
    </article>`;
  priceLightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePrices(){
  if(!priceLightbox || !priceLightboxContent) return;
  priceLightbox.classList.remove('open');
  setTimeout(() => {
    priceLightboxContent.innerHTML = '';
    document.body.style.overflow = '';
  }, MODAL_TRANSITION_MS);
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
const busyDatesCache = {};
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
Object.entries(icsLinks).forEach(([id, url]) => {
  busyDatesCache[id] = fetchIcsEvents(url);
});
function placeTodayBtn(calendarEl){
  const toolbar = calendarEl.querySelector('.fc-header-toolbar');
  const todayBtn = toolbar?.querySelector('.fc-today-button');
  if (!toolbar || !todayBtn) return;
  const leftChunk = toolbar.querySelector('.fc-toolbar-chunk:first-child');
  if (!leftChunk) return;
  let wrap = leftChunk.querySelector('.fc-today-wrap');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.className = 'fc-today-wrap';
    leftChunk.appendChild(wrap);
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
      <h3>Календар Котеджу #${id}</h3>
      <div id="calendar"></div>
      <div class="legend"><div class="legend-item free"><span></span> Вільно</div><div class="legend-item busy"><span></span> Зайнято</div></div>
    </article>`;
  calendarLightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  const busyDates = await (busyDatesCache[id] || (busyDatesCache[id] = fetchIcsEvents(url)));
  const calendarEl = document.getElementById('calendar');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 12, 0);
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 600,
    locale: 'uk',
    firstDay: 1,
    headerToolbar: { left: 'prev', center: 'title', right: 'next today' },
    buttonText: { today: 'Сьогодні' },
    titleFormat: { year: 'numeric', month: 'long' },
    validRange: { start, end },
    dayCellClassNames: (arg) => {
      const cls = [];
      if (busyDates.has(dateKey(arg.date))) cls.push('occupied');
      const viewStart = arg.view.currentStart;
      if (
          arg.date < today &&
          arg.date.getMonth() === viewStart.getMonth() &&
          arg.date.getFullYear() === viewStart.getFullYear()
      ) cls.push('past');
      return cls;
    },
    datesSet: (info) => {
      placeTodayBtn(calendarEl);
      const titleEl = calendarEl.querySelector('.fc-toolbar-title');
      if (titleEl) titleEl.textContent = info.view.title.replace(/\s*р\.$/, '');
    }
  });
  calendar.render();
}
function closeCalendar(){
  if(!calendarLightbox || !calendarLightboxContent) return;
  calendarLightbox.classList.remove('open');
  setTimeout(() => {
    calendarLightboxContent.innerHTML = '';
    document.body.style.overflow = '';
  }, MODAL_TRANSITION_MS);
}

document.querySelectorAll('.calendar-btn').forEach(btn => {
  btn.addEventListener('click', () => openCalendar(btn.dataset.cottage));
});
calendarLightboxClose?.addEventListener('click', closeCalendar);
calendarLightbox?.addEventListener('click', (e) => {
  if (!e.target.closest('.calendar-card')) closeCalendar();
});
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && calendarLightbox?.classList.contains('open')) closeCalendar(); });

// Хелпер для Viber/Telegram (за потреби)
