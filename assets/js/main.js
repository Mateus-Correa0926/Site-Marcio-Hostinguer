/* ========================================
   Stornoway Films — Main JavaScript
   ======================================== */

(function () {
  'use strict';

  /* ---- Navbar Scroll Effect ---- */
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const handleScroll = function () {
      if (window.scrollY > 80) {
        navbar.classList.add('nav--scrolled');
      } else {
        navbar.classList.remove('nav--scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /* ---- Hamburger Toggle ---- */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-controls', 'mobileMenu');

    function openMenu() {
      hamburger.classList.add('active');
      mobileMenu.classList.add('active');
      document.body.classList.add('no-scroll');
      hamburger.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.classList.remove('no-scroll');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    function toggleMenu() {
      if (mobileMenu.classList.contains('active')) closeMenu();
      else openMenu();
    }

    hamburger.addEventListener('click', toggleMenu);

    // Close on link click
    var mobileLinks = mobileMenu.querySelectorAll('.nav__mobile-link');
    for (var i = 0; i < mobileLinks.length; i++) {
      mobileLinks[i].addEventListener('click', closeMenu);
    }

    // Close on ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('active')) closeMenu();
    });

    // Close on resize to desktop
    var mq = window.matchMedia('(min-width: 901px)');
    var onMqChange = function () {
      if (mq.matches) closeMenu();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMqChange);
    else if (mq.addListener) mq.addListener(onMqChange);
  }

  /* ---- Ensure videos play on mobile (iOS low-power, autoplay retries) + force loop ---- */
  var bgVideos = document.querySelectorAll('video[autoplay]');
  for (var v = 0; v < bgVideos.length; v++) {
    (function (vid) {
      vid.muted = true;
      vid.playsInline = true;
      vid.loop = true;
      vid.setAttribute('loop', '');
      var tryPlay = function () {
        var p = vid.play();
        if (p && typeof p.catch === 'function') p.catch(function () { /* ignore */ });
      };
      // Fallback loop: some browsers/devices ignore `loop` when preload="metadata"
      vid.addEventListener('ended', function () {
        try { vid.currentTime = 0; } catch (e) {}
        tryPlay();
      });
      // Extra safety: if near the end and paused, restart
      vid.addEventListener('pause', function () {
        if (vid.duration && vid.currentTime >= vid.duration - 0.3) {
          try { vid.currentTime = 0; } catch (e) {}
          tryPlay();
        }
      });
      vid.addEventListener('canplay', tryPlay, { once: true });
      vid.addEventListener('loadeddata', tryPlay, { once: true });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) tryPlay();
      });
    })(bgVideos[v]);
  }

  /* ---- FAQ Accordion ---- */
  var faqItems = document.querySelectorAll('.faq__question');
  for (var i = 0; i < faqItems.length; i++) {
    faqItems[i].addEventListener('click', function () {
      var parent = this.parentElement;
      var answer = parent.querySelector('.faq__answer');
      var isActive = parent.classList.contains('active');

      // Close all
      var allItems = document.querySelectorAll('.faq__item');
      for (var j = 0; j < allItems.length; j++) {
        allItems[j].classList.remove('active');
        var ans = allItems[j].querySelector('.faq__answer');
        if (ans) ans.style.maxHeight = null;
      }

      // Open clicked
      if (!isActive) {
        parent.classList.add('active');
        if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  }

  /* ---- Contact Form Tabs ---- */
  var contactTabs = document.querySelectorAll('.contact-tab');
  var couplesForm = document.getElementById('couplesForm');
  var plannersForm = document.getElementById('plannersForm');

  if (contactTabs.length && couplesForm && plannersForm) {
    for (var i = 0; i < contactTabs.length; i++) {
      contactTabs[i].addEventListener('click', function () {
        // Toggle active tab
        for (var j = 0; j < contactTabs.length; j++) {
          contactTabs[j].classList.remove('contact-tab--active');
        }
        this.classList.add('contact-tab--active');

        var target = this.getAttribute('data-tab');
        if (target === 'couples') {
          couplesForm.style.display = 'flex';
          plannersForm.style.display = 'none';
        } else {
          couplesForm.style.display = 'none';
          plannersForm.style.display = 'flex';
        }
      });
    }
  }

  /* ---- Contact Form Submission ---- */
  var contactForms = document.querySelectorAll('.contact-form__form');
  for (var i = 0; i < contactForms.length; i++) {
    contactForms[i].addEventListener('submit', function (e) {
      e.preventDefault();
      var form = this;
      var formData = new FormData(form);
      var data = {};
      formData.forEach(function (value, key) {
        data[key] = value;
      });

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result.success) {
            form.reset();
            showFormMessage(form, 'Obrigado! Entraremos em contato em breve.', 'success');
          } else {
            showFormMessage(form, result.message || 'Algo deu errado. Tente novamente.', 'error');
          }
        })
        .catch(function () {
          showFormMessage(form, 'Erro de conexão. Tente novamente mais tarde.', 'error');
        });
    });
  }

  function showFormMessage(form, message, type) {
    // Remove existing
    var existing = form.querySelector('.form-message');
    if (existing) existing.remove();

    var el = document.createElement('p');
    el.className = 'form-message form-message--' + type;
    el.textContent = message;
    form.appendChild(el);

    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 6000);
  }

  /* ---- Scroll Reveal (IntersectionObserver) ---- */
  var revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealElements.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            entries[i].target.classList.add('visible');
            observer.unobserve(entries[i].target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    for (var i = 0; i < revealElements.length; i++) {
      observer.observe(revealElements[i]);
    }
  } else {
    // Fallback: show all
    for (var i = 0; i < revealElements.length; i++) {
      revealElements[i].classList.add('visible');
    }
  }

  /* ---- Smooth Scroll for Anchor Links ---- */
  var anchorLinks = document.querySelectorAll('a[href^="#"]');
  for (var i = 0; i < anchorLinks.length; i++) {
    anchorLinks[i].addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href && href.length > 1) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }
})();
