/* ========================================
   Stornoway Films — Scheduler Page
   ======================================== */

(function () {
  'use strict';

  var schedulerSection = document.getElementById('meetingScheduler');
  if (!schedulerSection) return;

  var calDaysEl = document.getElementById('cal-days');
  var calMonthLabel = document.getElementById('cal-month-label');
  var calPrev = document.getElementById('cal-prev');
  var calNext = document.getElementById('cal-next');
  var slotsContainer = document.getElementById('schedule-slots');
  var slotsHint = document.getElementById('schedule-slots-hint');
  var statusEl = document.getElementById('schedule-status');
  var bookingForm = document.getElementById('meeting-booking-form');
  var selectedDateInput = document.getElementById('meeting-slot-date');
  var selectedStartInput = document.getElementById('meeting-slot-start');
  var selectedSlotText = document.getElementById('meeting-slot-selected');
  var confirmationBox = document.getElementById('schedule-confirmation');
  var confirmationText = document.getElementById('schedule-confirmation-text');
  var confirmationContinue = document.getElementById('schedule-confirmation-continue');
  var integrationNote = document.getElementById('schedule-integration-note');

  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth();
  var selectedDay = null;
  var currentSelectedSlotBtn = null;
  var availabilityCache = {};
  var currentProvider = 'admin';

  var MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  var MONTHS_PT_LOWER = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  var WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function dateStr(y, m, d) {
    return y + '-' + pad(m + 1) + '-' + pad(d);
  }

  function setStatus(msg, type) {
    statusEl.className = 'schedule-status schedule-status--' + (type || 'info');
    statusEl.textContent = msg || '';
  }

  function setIntegrationNote(provider) {
    if (!integrationNote) return;
    if (provider === 'google') {
      integrationNote.textContent = 'Agenda sincronizada com Google Calendar do administrador.';
    } else {
      integrationNote.textContent = 'Agenda usando calendario administrativo interno (fallback automatico).';
    }
  }

  function clearSlots() {
    slotsContainer.innerHTML = '';
    bookingForm.style.display = 'none';
    currentSelectedSlotBtn = null;
    selectedDateInput.value = '';
    selectedStartInput.value = '';
    selectedSlotText.textContent = '';
    slotsHint.textContent = 'Selecione uma data para ver os horarios.';
    slotsHint.style.display = '';
    if (confirmationBox) confirmationBox.style.display = 'none';
  }

  function renderCalendar(year, month, availability) {
    calDaysEl.innerHTML = '';
    calMonthLabel.textContent = MONTHS_PT[month] + ' ' + year;

    var firstWeekday = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

    for (var e = 0; e < firstWeekday; e++) {
      var empty = document.createElement('span');
      empty.className = 'schedule-day schedule-day--empty';
      calDaysEl.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var ds = dateStr(year, month, d);
      var dayDate = new Date(year, month, d);
      var wd = dayDate.getDay();
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = d;
      btn.setAttribute('data-date', ds);

      var classes = ['schedule-day'];
      if (ds === todayStr) classes.push('schedule-day--today');
      if (ds === selectedDay) classes.push('schedule-day--selected');

      var isPast = ds < todayStr;
      var isWeekend = wd === 0 || wd === 6;
      var isUnavail = availability && availability.unavailable && availability.unavailable.indexOf(ds) !== -1;
      var isAvail = availability && availability.available && availability.available.indexOf(ds) !== -1;

      if (isPast || isWeekend) {
        classes.push('schedule-day--past');
        btn.disabled = true;
      } else if (isUnavail) {
        classes.push('schedule-day--unavailable');
        btn.disabled = true;
      } else if (isAvail) {
        classes.push('schedule-day--available');
      } else {
        classes.push('schedule-day--loading');
      }

      btn.className = classes.join(' ');

      if (!btn.disabled) {
        btn.addEventListener('click', function () {
          var prev = calDaysEl.querySelector('.schedule-day--selected');
          if (prev) prev.classList.remove('schedule-day--selected');
          this.classList.add('schedule-day--selected');
          selectedDay = this.getAttribute('data-date');
          fetchSlots(selectedDay);
        });
      }

      calDaysEl.appendChild(btn);
    }
  }

  function fetchMonthAvailability(year, month) {
    var key = year + '-' + pad(month + 1);
    if (availabilityCache[key] !== undefined) {
      renderCalendar(year, month, availabilityCache[key]);
      return;
    }

    renderCalendar(year, month, null);
    setStatus('Carregando disponibilidade do mes...', 'info');

    fetch('/api/schedule?month=' + encodeURIComponent(key), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (!result.success || !result.data) {
          setStatus(result.message || 'Nao foi possivel consultar a agenda.', 'error');
          return;
        }

        availabilityCache[key] = result.data;
        currentProvider = result.data.provider || 'admin';
        setIntegrationNote(currentProvider);
        renderCalendar(year, month, result.data);
        setStatus('Selecione um dia disponivel para ver os horarios.', 'info');
      })
      .catch(function () {
        setStatus('Erro de conexao ao carregar disponibilidade.', 'error');
      });
  }

  function renderSlots(date, slots) {
    slotsContainer.innerHTML = '';
    currentSelectedSlotBtn = null;

    if (!slots || !slots.length) {
      slotsHint.textContent = 'Sem horarios disponiveis nesta data.';
      slotsHint.style.display = '';
      return;
    }

    slotsHint.style.display = 'none';

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

          selectedDateInput.value = date;
          selectedStartInput.value = slot.start;
          selectedSlotText.textContent = formatSelectedText(date, slot.start);
          bookingForm.style.display = 'block';
          if (confirmationBox) confirmationBox.style.display = 'none';
          bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        slotsContainer.appendChild(btn);
      })(slots[i]);
    }
  }

  function fetchSlots(date) {
    clearSlots();
    slotsHint.textContent = 'Consultando horarios...';
    slotsHint.style.display = '';

    fetch('/api/schedule?date=' + encodeURIComponent(date), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (!result.success) {
          slotsHint.textContent = result.message || 'Nao foi possivel carregar os horarios.';
          return;
        }

        currentProvider = (result.data && result.data.provider) || currentProvider;
        setIntegrationNote(currentProvider);
        renderSlots(date, (result.data && result.data.slots) || []);
      })
      .catch(function () {
        slotsHint.textContent = 'Erro de conexao. Tente novamente.';
      });
  }

  function formatSelectedText(date, time) {
    var parts = date.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return WEEKDAYS_PT[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS_PT_LOWER[d.getMonth()] + ' as ' + time;
  }

  function formatConfirmationText(date, time) {
    var parts = date.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return 'Sua reuniao foi confirmada para ' + WEEKDAYS_PT[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS_PT_LOWER[d.getMonth()] + ' as ' + time + '.';
  }

  calPrev.addEventListener('click', function () {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    clearSlots();
    selectedDay = null;
    fetchMonthAvailability(currentYear, currentMonth);
  });

  calNext.addEventListener('click', function () {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    clearSlots();
    selectedDay = null;
    fetchMonthAvailability(currentYear, currentMonth);
  });

  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var payload = {
      name: (document.getElementById('meeting-name').value || '').trim(),
      email: (document.getElementById('meeting-email').value || '').trim(),
      subject: (document.getElementById('meeting-subject').value || '').trim(),
      notes: (document.getElementById('meeting-notes').value || '').trim(),
      date: selectedDateInput.value,
      start_time: selectedStartInput.value
    };

    if (!payload.date || !payload.start_time) {
      setStatus('Selecione um horario antes de confirmar.', 'error');
      return;
    }

    if (payload.subject.length < 3) {
      setStatus('Escreva um assunto com pelo menos 3 caracteres.', 'warning');
      return;
    }

    setStatus('Confirmando reuniao...', 'info');

    fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (!result.success) {
          setStatus(result.message || 'Nao foi possivel concluir o agendamento.', 'error');
          return;
        }

        setStatus('Reuniao agendada com sucesso.', 'success');
        bookingForm.reset();
        bookingForm.style.display = 'none';

        if (confirmationText && confirmationBox) {
          confirmationText.textContent = formatConfirmationText(payload.date, payload.start_time);
          confirmationBox.style.display = 'flex';
        }

        var key = currentYear + '-' + pad(currentMonth + 1);
        delete availabilityCache[key];
        selectedDay = null;
        fetchMonthAvailability(currentYear, currentMonth);
      })
      .catch(function () {
        setStatus('Erro de conexao ao salvar agendamento.', 'error');
      });
  });

  if (confirmationContinue) {
    confirmationContinue.addEventListener('click', function () {
      if (confirmationBox) confirmationBox.style.display = 'none';
      setStatus('Se quiser, voce pode marcar outro horario.', 'info');
      window.scrollTo({ top: schedulerSection.offsetTop - 60, behavior: 'smooth' });
    });
  }

  fetchMonthAvailability(currentYear, currentMonth);
})();
