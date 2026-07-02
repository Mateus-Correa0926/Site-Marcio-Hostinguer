/* ============================================================
   Stornoway Films — Admin Video Manager
   Minimal, auth + video grid only
   ============================================================ */
(function () {
  'use strict';

  var API = '/api';

  /* Site video sections — must match DB section_key values */
  var SECTIONS = [
    { key: 'home_banner',     label: 'Banner Principal',    page: 'Início',       fallback: '/uploads/videos/HomeSite.mp4' },
    { key: 'about_hero',      label: 'Sobre — Hero',        page: 'Sobre',        fallback: '/uploads/videos/download%20(1).mp4' },
    { key: 'films_hero',      label: 'Filmes — Hero',       page: 'Filmes',       fallback: '/uploads/videos/download.mp4' },
    { key: 'experience_hero', label: 'Experiência — Hero',  page: 'Experiência',  fallback: '/uploads/videos/download%20(2).mp4' },
    { key: 'featured_hero',   label: 'Destaques — Hero',    page: 'Destaques',    fallback: '/uploads/videos/download%20(1).mp4' },
    { key: 'contact_hero',    label: 'Contato — Hero',      page: 'Contato',      fallback: '/uploads/videos/download%20(2).mp4' }
  ];

  /* ── Utils ────────────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  /* ── Auth ─────────────────────────────────────────── */
  var Auth = {
    token: null, user: null,
    init: function () {
      this.token = localStorage.getItem('sf_token');
      this.user  = JSON.parse(localStorage.getItem('sf_user') || 'null');
    },
    isLoggedIn: function () { return !!this.token; },
    login: function (token, user) {
      this.token = token; this.user = user;
      localStorage.setItem('sf_token', token);
      localStorage.setItem('sf_user', JSON.stringify(user));
    },
    logout: function () {
      this.token = null; this.user = null;
      localStorage.removeItem('sf_token');
      localStorage.removeItem('sf_user');
    }
  };

  /* ── API client ───────────────────────────────────── */
  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (Auth.token) opts.headers['Authorization'] = 'Bearer ' + Auth.token;
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body) {
      opts.body = body;
    }
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401) { Auth.logout(); showLogin(); return Promise.reject(new Error('Sessão expirada')); }
      return r.json();
    });
  }

  /* ── Toast ────────────────────────────────────────── */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    el.textContent = msg;
    $('#toastContainer').appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 3500);
  }

  /* ── Confirm ──────────────────────────────────────── */
  function sfConfirm(title, text) {
    return new Promise(function (resolve) {
      var ov = $('#confirmOverlay');
      ov.style.display = 'flex';
      ov.innerHTML =
        '<div class="confirm-box">' +
          '<h3>' + esc(title) + '</h3>' +
          '<p>' + esc(text) + '</p>' +
          '<div class="confirm-box__actions">' +
            '<button class="btn btn-outline" id="cfNo">Cancelar</button>' +
            '<button class="btn btn-danger" id="cfYes">Confirmar</button>' +
          '</div>' +
        '</div>';
      $('#cfYes').onclick = function () { ov.style.display = 'none'; resolve(true); };
      $('#cfNo').onclick  = function () { ov.style.display = 'none'; resolve(false); };
    });
  }

  /* ── Modal ────────────────────────────────────────── */
  var Modal = {
    open: function (title, html) {
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = html;
      $('#modalOverlay').classList.add('modal-overlay--open');
    },
    close: function () { $('#modalOverlay').classList.remove('modal-overlay--open'); }
  };

  /* ── Auth screens ─────────────────────────────────── */
  function showLogin() {
    $('#loginScreen').style.display = 'flex';
    $('#appLayout').style.display = 'none';
  }
  function showApp() {
    $('#loginScreen').style.display = 'none';
    $('#appLayout').style.display = 'block';
    $('#headerUser').textContent = Auth.user ? Auth.user.username : '';
  }

  /* ============================================================
     VIDEO MANAGER
     ============================================================ */
  var videoData = {}; /* section_key → video record | null */

  function loadVideos() {
    $('#videoGrid').innerHTML = '<div class="grid-loading">Carregando vídeos...</div>';
    api('GET', '/videos')
      .then(function (res) {
        videoData = {};
        (res.data || []).forEach(function (v) { videoData[v.section_key] = v; });
        renderGrid();
      })
      .catch(function () {
        $('#videoGrid').innerHTML = '<div class="grid-loading">Erro ao carregar. Verifique a conexão.</div>';
      });
  }

  function renderGrid() {
    $('#videoGrid').innerHTML = SECTIONS.map(renderCard).join('');
    /* bind actions */
    $$('.js-edit').forEach(function (b) {
      b.addEventListener('click', function () { openEditor(this.dataset.key); });
    });
    $$('.js-toggle').forEach(function (b) {
      b.addEventListener('click', function () { toggleVideo(this.dataset.id); });
    });
    $$('.js-remove').forEach(function (b) {
      b.addEventListener('click', function () { removeVideo(this.dataset.key); });
    });
  }

  function renderCard(sec) {
    var v  = videoData[sec.key] || null;
    var hasFallback = !v; /* no DB record — show hardcoded fallback video */

    /* ── preview ── */
    var preview = '';
    if (v && v.type === 'youtube' && v.youtube_video_id) {
      preview =
        '<div class="vc-preview">' +
          '<img src="https://img.youtube.com/vi/' + esc(v.youtube_video_id) + '/mqdefault.jpg" alt="" />' +
          '<span class="vc-badge">YouTube</span>' +
          '<span class="vc-status' + (v.is_active == 1 ? '' : ' vc-status--off') + '"></span>' +
          '<div class="vc-overlay">' +
            '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '" style="color:#fff;border-color:rgba(255,255,255,.5)">Editar</button>' +
          '</div>' +
        '</div>';
    } else if (v && v.video_url_desktop) {
      preview =
        '<div class="vc-preview">' +
          '<video src="' + esc(v.video_url_desktop) + '" muted playsinline preload="metadata"></video>' +
          '<span class="vc-badge">Upload</span>' +
          '<span class="vc-status' + (v.is_active == 1 ? '' : ' vc-status--off') + '"></span>' +
          '<div class="vc-overlay">' +
            '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '" style="color:#fff;border-color:rgba(255,255,255,.5)">Editar</button>' +
          '</div>' +
        '</div>';
    } else if (hasFallback && sec.fallback) {
      preview =
        '<div class="vc-preview">' +
          '<video src="' + sec.fallback + '" muted playsinline preload="metadata"></video>' +
          '<span class="vc-badge vc-badge--fallback">Atual (HTML)</span>' +
          '<div class="vc-preview-empty" style="position:absolute;inset:0;background:rgba(0,0,0,.45);cursor:pointer;" onclick="document.querySelector(\'[data-key=\\'' + sec.key + '\\'].js-edit\').click()"></div>' +
        '</div>';
    } else {
      preview =
        '<div class="vc-preview">' +
          '<div class="vc-preview-empty js-edit" data-key="' + sec.key + '" style="cursor:pointer;">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>' +
            '<span>Clique para adicionar</span>' +
          '</div>' +
        '</div>';
    }

    /* ── info ── */
    var info = '';
    if (v && v.type === 'youtube') {
      info = 'youtu.be/' + esc(v.youtube_video_id);
    } else if (v && v.video_file_desktop) {
      info = esc(v.video_file_desktop.split('/').pop());
    } else {
      info = hasFallback ? 'Não gerenciado pelo admin (usando HTML)' : 'Sem vídeo configurado';
    }

    /* ── actions ── */
    var actions = '';
    if (v) {
      var togLabel = v.is_active == 1 ? 'Desativar' : 'Ativar';
      var togClass = v.is_active == 1 ? 'btn-outline' : 'btn-success';
      actions =
        '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '">Editar</button>' +
        '<button class="btn ' + togClass + ' btn-sm js-toggle" data-id="' + v.id + '">' + togLabel + '</button>' +
        '<button class="btn btn-danger btn-sm js-remove" data-key="' + sec.key + '">Remover</button>';
    } else {
      actions = '<button class="btn btn-black btn-sm js-edit" data-key="' + sec.key + '">+ Configurar vídeo</button>';
    }

    return (
      '<div class="video-card' + (!v ? ' video-card--empty' : '') + '">' +
        preview +
        '<div class="vc-body">' +
          '<p class="vc-page">' + esc(sec.page) + '</p>' +
          '<p class="vc-name">' + esc(sec.label) + '</p>' +
          '<p class="vc-info">' + info + '</p>' +
          '<div class="vc-actions">' + actions + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── Editor modal ─────────────────────────────────── */
  function openEditor(sectionKey) {
    var sec = SECTIONS.find(function (s) { return s.key === sectionKey; });
    var v   = videoData[sectionKey] || null;
    var isYt = v && v.type === 'youtube';
    var ytVal = v && v.youtube_video_id ? 'https://www.youtube.com/watch?v=' + v.youtube_video_id : '';

    var html =
      '<div class="type-toggle">' +
        '<input type="radio" name="sfvtype" id="sfvt_up" value="upload" ' + (!isYt ? 'checked' : '') + ' />' +
        '<label for="sfvt_up">📁 Arquivo</label>' +
        '<input type="radio" name="sfvtype" id="sfvt_yt" value="youtube" ' + (isYt ? 'checked' : '') + ' />' +
        '<label for="sfvt_yt">▶ YouTube</label>' +
      '</div>' +

      '<div id="sfUploadSec"' + (isYt ? ' style="display:none"' : '') + '>' +
        (v && v.video_url_desktop
          ? '<div class="current-preview"><video src="' + esc(v.video_url_desktop) + '" muted controls></video><p>Vídeo atual</p></div>'
          : '') +
        '<div class="field"><label>Arquivo de vídeo (.mp4 / .webm)</label>' +
          '<div class="upload-zone" id="sfDropZone">' +
            '<input type="file" id="sfVideoFile" accept="video/mp4,video/webm" />' +
            '<div class="upload-zone__icon">📹</div>' +
            '<p class="upload-zone__text"><strong>Clique</strong> ou arraste o arquivo aqui</p>' +
            '<p id="sfDropName" class="upload-zone__name"></p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="sfYtSec"' + (!isYt ? ' style="display:none"' : '') + '>' +
        '<div class="field"><label>URL do YouTube</label>' +
          '<input type="text" id="sfYtUrl" value="' + esc(ytVal) + '" placeholder="https://www.youtube.com/watch?v=..." />' +
          '<p class="field-hint">Cole qualquer formato: watch?v=, youtu.be/ ou embed/</p>' +
        '</div>' +
        '<div class="yt-info">Embed gerado automaticamente com autoplay, mute e loop infinito.</div>' +
      '</div>' +

      '<div class="field" style="margin-top:14px;">' +
        '<label style="cursor:pointer;display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500;">' +
          '<input type="checkbox" id="sfIsActive" ' + (v ? (v.is_active == 1 ? 'checked' : '') : 'checked') + ' /> Ativo (visível no site)' +
        '</label>' +
      '</div>' +

      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="sfCancelBtn">Cancelar</button>' +
        '<button class="btn btn-black" id="sfSaveBtn">Salvar</button>' +
      '</div>';

    Modal.open((sec ? sec.label : sectionKey), html);

    /* type toggle */
    $$('[name="sfvtype"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var isY = this.value === 'youtube';
        $('#sfUploadSec').style.display = isY ? 'none' : 'block';
        $('#sfYtSec').style.display     = isY ? 'block' : 'none';
      });
    });

    /* drop zone */
    var zone  = $('#sfDropZone');
    var fInput = $('#sfVideoFile');
    zone.addEventListener('click', function () { fInput.click(); });
    zone.addEventListener('dragover',  function (e) { e.preventDefault(); zone.classList.add('upload-zone--drag'); });
    zone.addEventListener('dragleave', function ()  { zone.classList.remove('upload-zone--drag'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault(); zone.classList.remove('upload-zone--drag');
      if (e.dataTransfer.files.length) {
        try { var dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); fInput.files = dt.files; } catch(x) {}
        $('#sfDropName').textContent = e.dataTransfer.files[0].name;
      }
    });
    fInput.addEventListener('change', function () {
      if (this.files.length) $('#sfDropName').textContent = this.files[0].name;
    });

    $('#sfCancelBtn').addEventListener('click', Modal.close);
    $('#sfSaveBtn').addEventListener('click', function () { saveVideo(sectionKey, v); });
  }

  function saveVideo(sectionKey, existing) {
    var sec    = SECTIONS.find(function (s) { return s.key === sectionKey; });
    var type   = (document.querySelector('[name="sfvtype"]:checked') || {}).value || 'upload';
    var active = ($('#sfIsActive') || {}).checked ? 1 : 0;

    var fd = new FormData();
    fd.append('type',        type);
    fd.append('title',       (sec ? sec.label : sectionKey));
    fd.append('section_key', sectionKey);
    fd.append('is_active',   active);
    fd.append('sort_order',  0);

    if (type === 'youtube') {
      var ytUrl = (($('#sfYtUrl') || {}).value || '').trim();
      if (!ytUrl) { toast('URL do YouTube é obrigatória', 'error'); return; }
      fd.append('youtube_url', ytUrl);
    } else {
      var fi = $('#sfVideoFile');
      if (fi && fi.files.length) {
        fd.append('video_desktop', fi.files[0]);
      } else if (!existing) {
        toast('Selecione um arquivo de vídeo', 'error'); return;
      }
    }

    var saveBtn = $('#sfSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }

    var url = existing ? '/videos/' + existing.id + '/update' : '/videos';
    api('POST', url, fd)
      .then(function (res) {
        if (res.success) { toast('Salvo com sucesso!'); Modal.close(); loadVideos(); }
        else toast(res.message || 'Erro ao salvar', 'error');
      })
      .catch(function (e) { toast('Erro: ' + (e.message || ''), 'error'); })
      .then(function () {
        var b = $('#sfSaveBtn');
        if (b) { b.disabled = false; b.textContent = 'Salvar'; }
      });
  }

  function removeVideo(sectionKey) {
    var v = videoData[sectionKey];
    if (!v) return;
    sfConfirm('Remover vídeo?', 'O registro será removido. O arquivo no servidor será mantido.').then(function (ok) {
      if (!ok) return;
      api('DELETE', '/videos/' + v.id).then(function () { toast('Removido'); loadVideos(); });
    });
  }

  function toggleVideo(id) {
    api('PUT', '/videos/' + id + '/toggle').then(function (res) {
      if (res.success) {
        toast(res.data && res.data.is_active ? 'Ativado' : 'Desativado');
        loadVideos();
      }
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    Auth.init();

    if (Auth.isLoggedIn()) { showApp(); loadVideos(); }
    else showLogin();

    /* Login */
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = $('#loginError');
      errEl.style.display = 'none';
      api('POST', '/auth/login', {
        username: $('#loginUser').value,
        password: $('#loginPass').value
      }).then(function (res) {
        if (res.data && res.data.token) {
          Auth.login(res.data.token, res.data.user || { username: $('#loginUser').value });
          showApp(); loadVideos();
        } else {
          errEl.textContent = res.message || 'Credenciais inválidas';
          errEl.style.display = 'block';
        }
      }).catch(function () {
        errEl.textContent = 'Erro de conexão';
        errEl.style.display = 'block';
      });
    });

    /* Logout */
    $('#logoutBtn').addEventListener('click', function () { Auth.logout(); showLogin(); });

    /* Refresh */
    $('#refreshBtn').addEventListener('click', loadVideos);

    /* Modal */
    $('#modalClose').addEventListener('click', Modal.close);
    $('#modalOverlay').addEventListener('click', function (e) { if (e.target === this) Modal.close(); });
  });

})();
