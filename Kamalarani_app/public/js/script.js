// Mobile menu toggle with aria-expanded support
const menuBtn  = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', isOpen);
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

// Scroll reveal using IntersectionObserver
const revealEls = document.querySelectorAll('.offer-card, .gallery-grid a, .team-card, .contact-card, .support-card');
revealEls.forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.10 });
revealEls.forEach(el => io.observe(el));

// Auto-hide flash messages after 6 seconds
document.querySelectorAll('.flash').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 6000);
});

// Hero Slider carousel logic
(function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.slider-dots .dot');
  const prevBtn = document.getElementById('heroPrevBtn');
  const nextBtn = document.getElementById('heroNextBtn');
  let currentSlide = 0;
  let slideInterval = null;

  if (!slides.length) return;

  function showSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    currentSlide = index;
  }

  function startSlideTimer() {
    stopSlideTimer();
    slideInterval = setInterval(() => {
      showSlide(currentSlide + 1);
    }, 6000);
  }

  function stopSlideTimer() {
    if (slideInterval) clearInterval(slideInterval);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      showSlide(currentSlide - 1);
      startSlideTimer();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      showSlide(currentSlide + 1);
      startSlideTimer();
    });
  }
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const targetIndex = parseInt(e.target.getAttribute('data-goto'), 10);
      showSlide(targetIndex);
      startSlideTimer();
    });
  });

  const sliderElem = document.getElementById('heroSlider');
  if (sliderElem) {
    sliderElem.addEventListener('mouseenter', stopSlideTimer);
    sliderElem.addEventListener('mouseleave', startSlideTimer);
  }

  startSlideTimer();
})();

// Accordion toggle helper for team members section
function toggleAccordion(id) {
  const item = document.getElementById(id);
  if (!item) return;
  const isOpen = item.classList.contains('open');

  // Close all accordion items
  document.querySelectorAll('.accordion-item').forEach(el => {
    el.classList.remove('open');
    const btn = el.querySelector('.accordion-header');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });

  // Toggle clicked item if it wasn't already open
  if (!isOpen) {
    item.classList.add('open');
    const btn = item.querySelector('.accordion-header');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

