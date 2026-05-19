/* ========================================
   Stornoway Films — Main JavaScript
   ======================================== */

(function () {
  'use strict';

  /* ---- Replace placeholder YouTube iframes (VIDEO_ID_*) with a graceful placeholder ---- */
  (function () {
    var iframes = document.querySelectorAll('iframe[src*="VIDEO_ID_"]');
    for (var i = 0; i < iframes.length; i++) {
      var ifr = iframes[i];
      var wrap = ifr.parentElement; // .video-embed
      if (!wrap) continue;
      var placeholder = document.createElement('div');
      placeholder.className = 'video-embed__placeholder';
      placeholder.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Vídeo em breve</span>';
      wrap.replaceChild(placeholder, ifr);
    }
  })();

  /* ---- Pause background videos when offscreen (perf) ---- */
  if ('IntersectionObserver' in window) {
    var bgVids = document.querySelectorAll('video[autoplay]');
    if (bgVids.length) {
      var vidObserver = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var vid = entries[i].target;
          if (entries[i].isIntersecting) {
            var p = vid.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
          } else {
            try { vid.pause(); } catch (e) {}
          }
        }
      }, { threshold: 0.05 });
      for (var vi = 0; vi < bgVids.length; vi++) vidObserver.observe(bgVids[vi]);
    }
  }

  /* ---- Safety: force-remove intro overlay after 4s in any edge case ---- */
  setTimeout(function () {
    document.body.classList.remove('intro-active');
    var ov = document.getElementById('introOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }, 4000);

  /* ---- Safety: reveal everything after 4s if IntersectionObserver somehow failed ---- */
  setTimeout(function () {
    var stillHidden = document.querySelectorAll('.reveal:not(.visible)');
    for (var i = 0; i < stillHidden.length; i++) stillHidden[i].classList.add('visible');
  }, 4000);


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

    // Inject close button (arrow) inside the menu if not present
    if (!mobileMenu.querySelector('.nav__mobile-close')) {
      var closeBtn = document.createElement('button');
      closeBtn.className = 'nav__mobile-close';
      closeBtn.setAttribute('aria-label', 'Fechar menu');
      closeBtn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"></polyline></svg>';
      mobileMenu.insertBefore(closeBtn, mobileMenu.firstChild);
    }

    // Inject backdrop if not present
    var backdrop = document.getElementById('mobileMenuBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobileMenuBackdrop';
      backdrop.className = 'nav__backdrop';
      document.body.appendChild(backdrop);
    }

    function openMenu() {
      hamburger.classList.add('active');
      mobileMenu.classList.add('active');
      backdrop.classList.add('active');
      document.body.classList.add('no-scroll');
      hamburger.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      backdrop.classList.remove('active');
      document.body.classList.remove('no-scroll');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    function toggleMenu() {
      if (mobileMenu.classList.contains('active')) closeMenu();
      else openMenu();
    }

    hamburger.addEventListener('click', toggleMenu);

    // Close on close-button click
    var closeBtnEl = mobileMenu.querySelector('.nav__mobile-close');
    if (closeBtnEl) closeBtnEl.addEventListener('click', closeMenu);

    // Close on backdrop (outside) click
    backdrop.addEventListener('click', closeMenu);

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

  /* ---- Ensure videos play on mobile (iOS low-power, autoplay retries) + seamless loop ---- */
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
      // Only restart if the browser somehow ignored loop (safety net, no manual replay during normal loops)
      vid.addEventListener('ended', function () {
        if (!vid.loop) {
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

  /* ---- Meeting Scheduler (Google Calendar) ---- */
  var scheduler = document.getElementById('meetingScheduler');
  if (scheduler) {
    var dateInput = document.getElementById('meeting-date');
    var loadSlotsBtn = document.getElementById('load-slots-btn');
    var slotsContainer = document.getElementById('schedule-slots');
    var statusEl = document.getElementById('schedule-status');
    var bookingForm = document.getElementById('meeting-booking-form');
    /* ---- Meeting Scheduler — Visual Calendar ---- */
    var schedulerSection = document.getElementById('meetingScheduler');
    if (schedulerSection) {
      var calDaysEl      = document.getElementById('cal-days');
      var calMonthLabel  = document.getElementById('cal-month-label');
      var calPrev        = document.getElementById('cal-prev');
      var calNext        = document.getElementById('cal-next');
      var slotsContainer = document.getElementById('schedule-slots');
      var slotsHint      = document.getElementById('schedule-slots-hint');
      var statusEl       = document.getElementById('schedule-status');
      var bookingForm    = document.getElementById('meeting-booking-form');
      var selectedDateInput  = document.getElementById('meeting-slot-date');
      var selectedStartInput = document.getElementById('meeting-slot-start');
      var selectedSlotText   = document.getElementById('meeting-slot-selected');

      var today         = new Date();
      var currentYear   = today.getFullYear();
      var currentMonth  = today.getMonth(); // 0-based
      var selectedDay   = null;
      var currentSelectedSlotBtn = null;

      // Disponibilidade por mês: cache para não recarregar o mesmo mês
      var availabilityCache = {};
      var data = {};
      var MONTHS_PT = [
        'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
      ];
      formData.forEach(function (value, key) {
      // ---- Helpers ----
      function pad(n) { return n < 10 ? '0' + n : '' + n; }

      function dateStr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

      function setStatus(msg, type) {
        statusEl.className = 'schedule-status schedule-status--' + (type || 'info');
        statusEl.textContent = msg;
      }

      function clearSlots() {
        slotsContainer.innerHTML = '';
        bookingForm.style.display = 'none';
        currentSelectedSlotBtn = null;
        selectedDateInput.value = '';
        selectedStartInput.value = '';
        selectedSlotText.textContent = '';
        slotsHint.textContent = 'Selecione uma data para ver os horários.';
        slotsHint.style.display = '';
      }

      // ---- Calendário ----
      function renderCalendar(year, month, availability) {
        calDaysEl.innerHTML = '';
        calMonthLabel.textContent = MONTHS_PT[month] + ' ' + year;
        data[key] = value;
        var firstWeekday = new Date(year, month, 1).getDay(); // 0=Dom
        var daysInMonth  = new Date(year, month + 1, 0).getDate();
        var todayStr     = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
      });
        // Células vazias antes do dia 1
        for (var e = 0; e < firstWeekday; e++) {
          var empty = document.createElement('span');
          empty.className = 'schedule-day schedule-day--empty';
          calDaysEl.appendChild(empty);
        }

        for (var d = 1; d <= daysInMonth; d++) {
          var ds      = dateStr(year, month, d);
          var dayDate = new Date(year, month, d);
          var wd      = dayDate.getDay(); // 0=Dom, 6=Sab
          var btn     = document.createElement('button');
          btn.type    = 'button';
          btn.textContent = d;
          btn.setAttribute('data-date', ds);
      fetch('/api/contact', {
          var classes = ['schedule-day'];
        method: 'POST',
          if (ds === todayStr) classes.push('schedule-day--today');
          if (ds === selectedDay) classes.push('schedule-day--selected');
        headers: { 'Content-Type': 'application/json' },
          var isPast    = ds < todayStr;
          var isWeekend = wd === 0 || wd === 6;
          var isUnavail = availability && availability.unavailable && availability.unavailable.indexOf(ds) !== -1;
          var isAvail   = availability && availability.available   && availability.available.indexOf(ds)   !== -1;
        body: JSON.stringify(data)
          if (isPast || isWeekend) {
            classes.push('schedule-day--past');
            btn.disabled = true;
          } else if (isUnavail) {
            classes.push('schedule-day--unavailable');
            btn.disabled = true;
          } else if (isAvail) {
            classes.push('schedule-day--available');
          } else {
            // Disponibilidade ainda carregando
            classes.push('schedule-day--loading');
          }
      })
          btn.className = classes.join(' ');
        .then(function (res) { return res.json(); })
          if (!btn.disabled) {
            btn.addEventListener('click', function () {
              var prev = calDaysEl.querySelector('.schedule-day--selected');
              if (prev) prev.classList.remove('schedule-day--selected');
              this.classList.add('schedule-day--selected');
              selectedDay = this.getAttribute('data-date');
              fetchSlots(selectedDay);
            });
          }
        .then(function (result) {
          calDaysEl.appendChild(btn);
        }
      }
          if (result.success) {
      function fetchMonthAvailability(year, month) {
        var key = year + '-' + pad(month + 1);
        if (availabilityCache[key] !== undefined) {
          renderCalendar(year, month, availabilityCache[key]);
          return;
        }
            form.reset();
        // Renderiza sem disponibilidade enquanto carrega
        renderCalendar(year, month, null);
            showFormMessage(form, 'Obrigado! Entraremos em contato em breve.', 'success');
        fetch('/api/schedule?month=' + encodeURIComponent(key), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (result.success && result.data) {
              availabilityCache[key] = result.data;
              renderCalendar(year, month, result.data);
            }
          })
          .catch(function () { /* falha silenciosa — calendário continua usável */ });
      }
          } else {
      // ---- Horários ----
      function renderSlots(date, slots) {
        slotsContainer.innerHTML = '';
        currentSelectedSlotBtn = null;
            showFormMessage(form, result.message || 'Algo deu errado. Tente novamente.', 'error');
        if (!slots || !slots.length) {
          slotsHint.textContent = 'Sem horários disponíveis nesta data.';
          slotsHint.style.display = '';
          return;
        }
          }
        slotsHint.style.display = 'none';
        })
        for (var i = 0; i < slots.length; i++) {
          (function (slot) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'schedule-slot-btn';
            btn.textContent = slot.start;
            btn.setAttribute('data-start', slot.start);
            btn.addEventListener('click', function () {
              if (currentSelectedSlotBtn) currentSelectedSlotBtn.classList.remove('schedule-slot-btn--active');
              this.classList.add('schedule-slot-btn--active');
              currentSelectedSlotBtn = this;
        .catch(function () {
              selectedDateInput.value  = date;
              selectedStartInput.value = slot.start;
          showFormMessage(form, 'Erro de conexão. Tente novamente mais tarde.', 'error');
              // Formata a data para exibição
              var parts = date.split('-');
              var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              var weekdays = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
              var months   = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
              selectedSlotText.textContent =
                weekdays[d.getDay()] + ', ' + d.getDate() + ' de ' + months[d.getMonth()] + ' às ' + slot.start;
        });
              bookingForm.style.display = 'block';
              bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            slotsContainer.appendChild(btn);
          })(slots[i]);
        }
      }
    });
      function fetchSlots(date) {
        clearSlots();
        slotsHint.textContent = 'Consultando agenda…';
        slotsHint.style.display = '';
  }
        fetch('/api/schedule?date=' + encodeURIComponent(date), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (!result.success) {
              slotsHint.textContent = result.message || 'Não foi possível carregar os horários.';
              return;
            }
            renderSlots(date, (result.data && result.data.slots) || []);
          })
          .catch(function () {
            slotsHint.textContent = 'Erro de conexão. Tente novamente.';
          });
      }

      // ---- Navegação de mês ----
      calPrev.addEventListener('click', function () {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        clearSlots();
        selectedDay = null;
        fetchMonthAvailability(currentYear, currentMonth);
      });
  function showFormMessage(form, message, type) {
      calNext.addEventListener('click', function () {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        clearSlots();
        selectedDay = null;
        fetchMonthAvailability(currentYear, currentMonth);
      });
    // Remove existing
      // ---- Formulário de confirmação ----
      bookingForm.addEventListener('submit', function (e) {
        e.preventDefault();
    var existing = form.querySelector('.form-message');
        var payload = {
          name:       (document.getElementById('meeting-name').value  || '').trim(),
          email:      (document.getElementById('meeting-email').value || '').trim(),
          notes:      (document.getElementById('meeting-notes').value || '').trim(),
          date:       selectedDateInput.value,
          start_time: selectedStartInput.value
        };
    if (existing) existing.remove();
        if (!payload.date || !payload.start_time) {
          setStatus('Selecione um horário antes de confirmar.', 'error');
          return;
        }

        setStatus('Confirmando reunião…', 'info');
    var el = document.createElement('p');
        fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (!result.success) {
              setStatus(result.message || 'Não foi possível concluir o agendamento.', 'error');
              return;
            }
            setStatus('Reunião agendada! Você receberá confirmação por e-mail.', 'success');
            bookingForm.reset();
            bookingForm.style.display = 'none';
            // Invalida cache do mês para refletir novo bloqueio
            var key = currentYear + '-' + pad(currentMonth + 1);
            delete availabilityCache[key];
            selectedDay = null;
            fetchMonthAvailability(currentYear, currentMonth);
          })
          .catch(function () {
            setStatus('Erro de conexão ao salvar agendamento.', 'error');
          });
      });
    el.className = 'form-message form-message--' + type;
      // ---- Init ----
      fetchMonthAvailability(currentYear, currentMonth);
    }
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
