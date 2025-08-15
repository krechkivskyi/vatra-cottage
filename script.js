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

function openLightbox(src, alt){
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src; lightboxImg.alt = alt || 'Зображення';
  lightbox.classList.add('open');
}
function closeLightbox(){
  if (!lightbox || !lightboxImg) return;
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  lbImages = [];
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
    openGallery([{src: t.src, alt: t.alt}], 0);
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

// Хелпер для Viber/Telegram (за потреби)
