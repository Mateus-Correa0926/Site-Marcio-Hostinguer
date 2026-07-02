/* ============================================================
   Stornoway Films — Admin Video Manager  |  Premium Edition
   ============================================================ */
(function () {
  'use strict';

  var API = '/api';

  var SECTIONS = [
    { key: 'home_banner',     label: 'Banner Principal',   page: 'Inicio',      fallback: '/uploads/videos/HomeSite.mp4' },
    { key: 'about_hero',      label: 'Sobre - Hero',       page: 'Sobre',       fallback: '/uploads/videos/download%20(1).mp4' },
    { key: 'films_hero',      label: 'Filmes - Hero',      page: 'Filmes',      fallback: '/uploads/videos/download.mp4' },
    { key: 'experience_hero', label: 'Experiencia - Hero', page: 'Experiencia', fallback: '/uploads/videos/download%20(2).mp4' },
    { key: 'featured_hero',   label: 'Destaques - Hero',   page: 'Destaques',   fallback: '/uploads/videos/download%20(1).mp4' },
    { key: 'contact_hero',    label: 'Contato - Hero',     page: 'Contato',     fallback: '/uploads/videos/download%20(2).mp4' }
  ];

  /* ── Helpers ──────────────────────────────────────────────── */
  function q(sel, ctx)  { return (ctx || document).querySelector(sel); }
  function qq(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  /* ── Auth ─────────────────────────────────────────────────── */
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

  /* ── API Client ───────────────────────────────────────────── */
  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (Auth.token) opts.headers['Authorization'] = 'Bearer ' + Auth.token;
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401) { Auth.logout(); showLogin(); return Promise.reject(new Error('Sessao expirada')); }
      return r.json();
    });
  }

  /* ── Toast ────────────────────────────────────────────────── */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    el.textContent = msg;
    q('#toastContainer').appendChild(el);
    setTimeout(function () {
      el.classList.add('toast--out');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 220);
    }, 3200);
  }

  /* ── Confirm ──────────────────────────────────────────────── */
  function sfConfirm(title, text) {
    return new Promise(function (resolve) {
      var ov = q('#confirmOverlay');
      ov.style.display = 'flex';
      ov.innerHTML =
        '<div class="confirm-box">' +
          '<div class="confirm-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
          '</div>' +
          '<h3>' + esc(title) + '</h3>' +
          '<p>' + esc(text) + '</p>' +
          '<div class="confirm-box__actions">' +
            '<button class="btn btn-outline btn-sm" id="cfNo">Cancelar</button>' +
            '<button class="btn btn-danger btn-sm" id="cfYes">Remover</button>' +
          '</div>' +
        '</div>';
      q('#cfYes').onclick = function () { ov.style.display = 'none'; resolve(true); };
      q('#cfNo').onclick  = function () { ov.style.display = 'none'; resolve(false); };
    });
  }

  /* ── Modal ────────────────────────────────────────────────── */
  var Modal = {
    open: function (title, html) {
      q('#modalTitle').textContent = title;
      q('#modalBody').innerHTML    = html;
      q('#modalOverlay').classList.add('modal-overlay--open');
    },
    close: function () { q('#modalOverlay').classList.remove('modal-overlay--open'); }
  };

  /* ── Screen Helpers ───────────────────────────────────────── */
  function showLogin() {
    q('#loginScreen').style.display = 'flex';
    q('#appLayout').style.display   = 'none';
    if (q('#loginUser')) q('#loginUser').value = '';
    if (q('#loginPass')) q('#loginPass').value = '';
  }

  function showApp() {
    q('#loginScreen').style.display = 'none';
    q('#appLayout').style.display   = 'flex';
    var user = Auth.user;
    if (user && q('#sidebarUser')) q('#sidebarUser').textContent = user.username || '';
    if (q('#welcomeUser')) q('#welcomeUser').textContent = (user && user.username) ? user.username : 'Admin';
  }

  /* ── Mobile Sidebar ───────────────────────────────────────── */
  function openSidebar() {
    q('#sidebar').classList.add('is-open');
    q('#sidebarBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    q('#sidebar').classList.remove('is-open');
    q('#sidebarBackdrop').classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ============================================================
     VIDEO MANAGER
     ============================================================ */
  var videoData = {};
  var pageFilter = 'all';
  var currentView = 'videos';
  var libraryCache = [];

  function loadVideoLibrary() {
    return api('GET', '/videos/library').then(function (res) {
      libraryCache = (res && res.data) ? res.data : [];
      return libraryCache;
    }).catch(function () {
      libraryCache = [];
      return [];
    });
  }

  function switchView(view) {
    currentView = view === 'library' ? 'library' : 'videos';
    if (q('#videosView')) q('#videosView').style.display = currentView === 'videos' ? 'block' : 'none';
    if (q('#libraryView')) q('#libraryView').style.display = currentView === 'library' ? 'grid' : 'none';
    if (q('#navVideos')) q('#navVideos').classList.toggle('is-active', currentView === 'videos');
    if (q('#navLibrary')) q('#navLibrary').classList.toggle('is-active', currentView === 'library');
  }

  function renderLibraryPage() {
    var root = q('#libraryPageList');
    if (!root) return;
    if (!libraryCache.length) {
      root.innerHTML = '<p class="library-loading">Nenhum vídeo encontrado em uploads/videos.</p>';
      return;
    }

    root.innerHTML = libraryCache.map(function (item) {
      var kb = Math.round((item.size || 0) / 1024);
      return '' +
        '<div class="library-card">' +
          '<video src="' + esc(item.url) + '" muted playsinline preload="metadata"></video>' +
          '<div class="library-card__body">' +
            '<p class="library-card__name">' + esc(item.name || item.file_path) + '</p>' +
            '<p class="library-card__meta">' + kb + ' KB</p>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function loadLibraryPage() {
    return loadVideoLibrary().then(function () {
      renderLibraryPage();
    });
  }

  function loadVideos() {
    q('#videoGrid').innerHTML =
      '<div class="grid-loading">' +
        '<div class="ld-dots"><span></span><span></span><span></span></div>' +
        '<p>Carregando videos...</p>' +
      '</div>';
    api('GET', '/videos')
      .then(function (res) {
        videoData = {};
        (res.data || []).forEach(function (v) {
          if (!videoData[v.section_key]) {
            videoData[v.section_key] = v;
            return;
          }
          if (v.is_active == 1 && videoData[v.section_key].is_active != 1) {
            videoData[v.section_key] = v;
          }
        });
        renderPageTabs();
        updateCounters();
        renderGrid();
      })
      .catch(function () {
        q('#videoGrid').innerHTML =
          '<div class="grid-loading"><p style="color:var(--red)">Erro ao carregar. Verifique a conexao com a API.</p></div>';
      });
  }

  function updateCounters() {
    var configured = Object.keys(videoData).length;
    if (q('#videoBadge')) q('#videoBadge').textContent = String(configured);
    if (q('#videoCountInfo')) {
      var visible = getVisibleSections().length;
      q('#videoCountInfo').textContent = visible + ' de ' + SECTIONS.length + ' espaços exibidos';
    }
  }

  function getVisibleSections() {
    if (pageFilter === 'all') return SECTIONS.slice();
    return SECTIONS.filter(function (sec) { return sec.page === pageFilter; });
  }

  function renderPageTabs() {
    var tabsRoot = q('#videoPageTabs');
    if (!tabsRoot) return;

    var pages = [];
    for (var i = 0; i < SECTIONS.length; i++) {
      if (pages.indexOf(SECTIONS[i].page) === -1) pages.push(SECTIONS[i].page);
    }

    var html = '<button class="ct-tab' + (pageFilter === 'all' ? ' is-active' : '') + '" type="button" data-page="all">Todas as páginas</button>';
    for (var p = 0; p < pages.length; p++) {
      var active = pageFilter === pages[p] ? ' is-active' : '';
      html += '<button class="ct-tab' + active + '" type="button" data-page="' + esc(pages[p]) + '">' + esc(pages[p]) + '</button>';
    }

    tabsRoot.innerHTML = html;
    qq('.ct-tab', tabsRoot).forEach(function (btn) {
      btn.addEventListener('click', function () {
        pageFilter = this.dataset.page || 'all';
        renderPageTabs();
        updateCounters();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    var visibleSections = getVisibleSections();
    q('#videoGrid').innerHTML = visibleSections.map(renderCard).join('');
    qq('.js-edit').forEach(function (b) {
      b.addEventListener('click', function () { openEditor(this.dataset.key); });
    });
    qq('.js-toggle').forEach(function (b) {
      b.addEventListener('click', function () { toggleVideo(this.dataset.id); });
    });
    qq('.js-remove').forEach(function (b) {
      b.addEventListener('click', function () { removeVideo(this.dataset.key); });
    });
    qq('.vc-empty[data-key]').forEach(function (el) {
      el.addEventListener('click', function () { openEditor(this.dataset.key); });
    });

    if (!visibleSections.length) {
      q('#videoGrid').innerHTML = '<div class="grid-loading"><p>Nenhuma seção encontrada para esse filtro.</p></div>';
    }
  }

  function statusPill(isActive) {
    var on = isActive == 1;
    return (
      '<div class="vc-pill">' +
        '<span class="vc-pill__dot' + (on ? '' : ' vc-pill__dot--off') + '"></span>' +
        '<span class="vc-pill__label">' + (on ? 'Ativo' : 'Inativo') + '</span>' +
      '</div>'
    );
  }

  function renderCard(sec) {
    var v = videoData[sec.key] || null;
    var noRecord = !v;

    /* preview */
    var preview = '';
    if (v && v.type === 'youtube' && v.youtube_video_id) {
      preview =
        '<div class="vc-preview">' +
          '<img src="https://img.youtube.com/vi/' + esc(v.youtube_video_id) + '/mqdefault.jpg" alt="" />' +
          '<span class="vc-badge vc-badge--yt">YouTube</span>' +
          statusPill(v.is_active) +
          '<div class="vc-hover">' +
            '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '" style="color:#fff;border-color:rgba(255,255,255,.4)">Editar</button>' +
          '</div>' +
        '</div>';
    } else if (v && v.video_url_desktop) {
      preview =
        '<div class="vc-preview">' +
          '<video src="' + esc(v.video_url_desktop) + '" muted playsinline preload="metadata"></video>' +
          '<span class="vc-badge vc-badge--upload">Upload</span>' +
          statusPill(v.is_active) +
          '<div class="vc-hover">' +
            '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '" style="color:#fff;border-color:rgba(255,255,255,.4)">Editar</button>' +
          '</div>' +
        '</div>';
    } else if (noRecord && sec.fallback) {
      preview =
        '<div class="vc-preview">' +
          '<video src="' + sec.fallback + '" muted playsinline preload="metadata"></video>' +
          '<span class="vc-badge vc-badge--html">Padrao HTML</span>' +
          '<div class="vc-hover">' +
            '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '" style="color:#fff;border-color:rgba(255,255,255,.4)">+ Gerenciar</button>' +
          '</div>' +
        '</div>';
    } else {
      preview =
        '<div class="vc-preview">' +
          '<div class="vc-empty" data-key="' + sec.key + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>' +
            '<span>Adicionar video</span>' +
          '</div>' +
        '</div>';
    }

    /* info text */
    var info = '';
    if (v && v.type === 'youtube') {
      info = 'youtu.be/' + esc(v.youtube_video_id);
    } else if (v && v.video_file_desktop) {
      info = esc(v.video_file_desktop.split('/').pop());
    } else if (noRecord) {
      info = 'Video padrao (definido no HTML)';
    } else {
      info = 'Sem video configurado';
    }

    /* actions */
    var actions = '';
    if (v) {
      var togLabel = v.is_active == 1 ? 'Desativar' : 'Ativar';
      var togClass = v.is_active == 1 ? 'btn-outline' : 'btn-success';
      actions =
        '<button class="btn btn-outline btn-sm js-edit" data-key="' + sec.key + '">Editar</button>' +
        '<button class="btn ' + togClass + ' btn-sm js-toggle" data-id="' + v.id + '">' + togLabel + '</button>' +
        '<button class="btn btn-danger btn-sm js-remove" data-key="' + sec.key + '">Remover</button>';
    } else {
      actions = '<button class="btn btn-primary btn-sm js-edit" data-key="' + sec.key + '">+ Configurar video</button>';
    }

    return (
      '<div class="video-card' + (noRecord ? ' video-card--empty' : '') + '">' +
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

  /* ── Editor Modal ─────────────────────────────────────────── */
  function openEditor(sectionKey) {
    var sec  = SECTIONS.find(function (s) { return s.key === sectionKey; });
    var v    = videoData[sectionKey] || null;
    var isYt = v && v.type === 'youtube';
    var ytVal = v && v.youtube_video_id ? 'https://www.youtube.com/watch?v=' + v.youtube_video_id : '';

    var currentLibraryFile = (v && v.video_file_desktop) ? v.video_file_desktop : '';

    var html =
      '<div class="type-toggle">' +
        '<input type="radio" name="sfvtype" id="sfvt_up" value="upload" ' + (!isYt ? 'checked' : '') + '/>' +
        '<label for="sfvt_up">Arquivo</label>' +
        '<input type="radio" name="sfvtype" id="sfvt_yt" value="youtube" ' + (isYt ? 'checked' : '') + '/>' +
        '<label for="sfvt_yt">YouTube</label>' +
      '</div>' +
      '<div id="sfUploadSec"' + (isYt ? ' style="display:none"' : '') + '>' +
        '<div class="type-toggle" style="margin-bottom:12px">' +
          '<input type="radio" name="sffilemode" id="sfmode_library" value="library" checked />' +
          '<label for="sfmode_library">Biblioteca</label>' +
          '<input type="radio" name="sffilemode" id="sfmode_upload" value="upload" />' +
          '<label for="sfmode_upload">Importar novo</label>' +
        '</div>' +
        '<input type="hidden" id="sfLibraryPath" value="' + esc(currentLibraryFile) + '" />' +
        '<div id="sfLibrarySec">' +
          '<div class="field" style="margin-bottom:10px">' +
            '<label>Vídeos salvos em uploads/videos</label>' +
            '<select id="sfLibrarySelect"></select>' +
            '<p id="sfLibraryMsg" class="field-hint">Carregando biblioteca...</p>' +
          '</div>' +
        '</div>' +
        '<div id="sfUploadNewSec" style="display:none">' +
        (v && v.video_url_desktop
          ? '<div class="current-preview"><video src="' + esc(v.video_url_desktop) + '" muted controls></video><p>Video atual</p></div>'
          : '') +
        '<div class="field"><label>Arquivo de video (.mp4 / .webm)</label>' +
          '<div class="upload-zone" id="sfDropZone">' +
            '<input type="file" id="sfVideoFile" accept="video/mp4,video/webm" />' +
            '<div class="upload-zone__icon">&#x1F4F9;</div>' +
            '<p class="upload-zone__text"><strong>Clique</strong> ou arraste o arquivo aqui</p>' +
            '<p id="sfDropName" class="upload-zone__name"></p>' +
          '</div>' +
        '</div>' +
        '</div>' +
      '</div>' +
      '<div id="sfYtSec"' + (!isYt ? ' style="display:none"' : '') + '>' +
        '<div class="field"><label>URL do YouTube</label>' +
          '<input type="text" id="sfYtUrl" value="' + esc(ytVal) + '" placeholder="https://www.youtube.com/watch?v=..." />' +
          '<p class="field-hint">Aceita qualquer formato: watch?v=, youtu.be/, embed/</p>' +
        '</div>' +
        '<div class="yt-info">Embed gerado automaticamente com autoplay, mute e loop infinito.</div>' +
      '</div>' +
      '<div class="field" style="margin-top:14px">' +
        '<label style="cursor:pointer;display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500">' +
          '<input type="checkbox" id="sfIsActive" ' + (v ? (v.is_active == 1 ? 'checked' : '') : 'checked') + ' /> Ativo (visivel no site)' +
        '</label>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline btn-sm" id="sfCancelBtn">Cancelar</button>' +
        '<button class="btn btn-primary btn-sm" id="sfSaveBtn">Salvar alteracoes</button>' +
      '</div>';

    Modal.open(sec ? sec.label : sectionKey, html);

    /* type toggle */
    qq('[name="sfvtype"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var isY = this.value === 'youtube';
        q('#sfUploadSec').style.display = isY ? 'none' : 'block';
        q('#sfYtSec').style.display     = isY ? 'block' : 'none';
      });
    });

    function renderLibrarySelect() {
      var list = q('#sfLibrarySelect');
      var msg = q('#sfLibraryMsg');
      var current = (q('#sfLibraryPath') || {}).value || '';
      if (!list || !msg) return;

      if (!libraryCache.length) {
        list.innerHTML = '<option value="">Nenhum vídeo encontrado</option>';
        msg.textContent = 'Nenhum vídeo encontrado na pasta uploads/videos.';
        return;
      }

      msg.textContent = 'Selecione um arquivo já importado para essa seção.';
      var options = '<option value="">Selecione um vídeo</option>';
      options += libraryCache.map(function (item) {
        var selected = current === item.file_path ? ' selected' : '';
        return '<option value="' + esc(item.file_path) + '"' + selected + '>' + esc(item.name || item.file_path) + '</option>';
      }).join('');
      list.innerHTML = options;
      list.addEventListener('change', function () {
        if (q('#sfLibraryPath')) q('#sfLibraryPath').value = this.value || '';
      });
    }

    function toggleFileMode() {
      var modeEl = document.querySelector('[name="sffilemode"]:checked');
      var mode = modeEl ? modeEl.value : 'library';
      if (q('#sfLibrarySec')) q('#sfLibrarySec').style.display = mode === 'library' ? 'block' : 'none';
      if (q('#sfUploadNewSec')) q('#sfUploadNewSec').style.display = mode === 'upload' ? 'block' : 'none';
    }

    qq('[name="sffilemode"]').forEach(function (radio) {
      radio.addEventListener('change', toggleFileMode);
    });
    toggleFileMode();
    loadVideoLibrary().then(renderLibrarySelect);

    /* drop zone */
    var zone  = q('#sfDropZone');
    var fInput = q('#sfVideoFile');
    if (zone && fInput) {
      zone.addEventListener('click',     function ()  { fInput.click(); });
      zone.addEventListener('dragover',  function (e) { e.preventDefault(); zone.classList.add('upload-zone--drag'); });
      zone.addEventListener('dragleave', function ()  { zone.classList.remove('upload-zone--drag'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('upload-zone--drag');
        if (e.dataTransfer.files.length) {
          try { var dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); fInput.files = dt.files; } catch (x) {}
          if (q('#sfDropName')) q('#sfDropName').textContent = e.dataTransfer.files[0].name;
        }
      });
      fInput.addEventListener('change', function () {
        if (this.files.length && q('#sfDropName')) q('#sfDropName').textContent = this.files[0].name;
      });
    }

    q('#sfCancelBtn').addEventListener('click', function () { Modal.close(); });
    q('#sfSaveBtn').addEventListener('click',   function () { saveVideo(sectionKey, v); });
  }

  function saveVideo(sectionKey, existing) {
    var sec    = SECTIONS.find(function (s) { return s.key === sectionKey; });
    var type   = (document.querySelector('[name="sfvtype"]:checked') || {}).value || 'upload';
    var active = (q('#sfIsActive') || {}).checked ? 1 : 0;
    var fd = new FormData();
    fd.append('type',        type);
    fd.append('title',       sec ? sec.label : sectionKey);
    fd.append('section_key', sectionKey);
    fd.append('is_active',   active);
    fd.append('sort_order',  0);

    if (type === 'youtube') {
      var ytUrl = ((q('#sfYtUrl') || {}).value || '').trim();
      if (!ytUrl) { toast('URL do YouTube e obrigatoria', 'error'); return; }
      fd.append('youtube_url', ytUrl);
    } else {
      var fileModeEl = document.querySelector('[name="sffilemode"]:checked');
      var fileMode = fileModeEl ? fileModeEl.value : 'library';
      var fi = q('#sfVideoFile');
      var selectedPath = ((q('#sfLibraryPath') || {}).value || '').trim();

      if (fileMode === 'upload') {
        if (fi && fi.files.length) {
          fd.append('video_desktop', fi.files[0]);
        } else if (!existing) {
          toast('Selecione um arquivo para importar', 'error'); return;
        }
      } else {
        if (selectedPath) {
          fd.append('video_library_desktop', selectedPath);
        } else if (!existing) {
          toast('Selecione um vídeo da biblioteca', 'error'); return;
        }
      }
    }

    var saveBtn = q('#sfSaveBtn');
    var resetBtn = function () {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar alteracoes'; }
    };
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }

    var url = existing ? '/videos/' + existing.id + '/update' : '/videos';
    api('POST', url, fd)
      .then(function (res) {
        if (res.success) { toast('Salvo com sucesso!'); Modal.close(); loadVideos(); }
        else             { toast(res.message || 'Erro ao salvar', 'error'); resetBtn(); }
      })
      .catch(function (e) {
        toast('Erro: ' + (e.message || 'inesperado'), 'error'); resetBtn();
      });
  }

  function removeVideo(sectionKey) {
    var v = videoData[sectionKey];
    if (!v) return;
    sfConfirm('Remover video?', 'O registro sera removido do banco de dados. O arquivo no servidor sera mantido.').then(function (ok) {
      if (!ok) return;
      api('DELETE', '/videos/' + v.id).then(function (res) {
        toast(res.success !== false ? 'Video removido' : (res.message || 'Erro ao remover'), res.success !== false ? '' : 'error');
        loadVideos();
      });
    });
  }

  function toggleVideo(id) {
    api('PUT', '/videos/' + id + '/toggle').then(function (res) {
      if (res.success) {
        toast(res.data && res.data.is_active ? 'Video ativado' : 'Video desativado');
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
    q('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl   = q('#loginError');
      var spinner = q('#loginSpinner');
      var btnText = q('#loginBtnText');
      var loginBtn = q('#loginBtn');
      errEl.style.display = 'none';
      loginBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (btnText) btnText.style.display = 'none';

      api('POST', '/auth/login', {
        username: q('#loginUser').value.trim(),
        password: q('#loginPass').value
      }).then(function (res) {
        if (res.data && res.data.token) {
          Auth.login(res.data.token, res.data.user || { username: q('#loginUser').value });
          showApp(); loadVideos();
        } else {
          errEl.textContent  = res.message || 'Credenciais invalidas';
          errEl.style.display = 'block';
          loginBtn.disabled   = false;
          if (spinner) spinner.style.display = 'none';
          if (btnText) btnText.style.display  = 'inline';
        }
      }).catch(function () {
        errEl.textContent  = 'Erro de conexao. Tente novamente.';
        errEl.style.display = 'block';
        loginBtn.disabled   = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.display  = 'inline';
      });
    });

    /* Logout */
    q('#logoutBtn').addEventListener('click', function () { Auth.logout(); showLogin(); });

    /* Refresh */
    q('#refreshBtn').addEventListener('click', loadVideos);

    /* Quick add */
    if (q('#importVideoBtn')) {
      q('#importVideoBtn').addEventListener('click', function () {
        switchView('library');
        loadLibraryPage();
      });
    }

    if (q('#navVideos')) {
      q('#navVideos').addEventListener('click', function (e) {
        e.preventDefault();
        switchView('videos');
      });
    }

    if (q('#navLibrary')) {
      q('#navLibrary').addEventListener('click', function (e) {
        e.preventDefault();
        switchView('library');
        loadLibraryPage();
      });
    }

    if (q('#libraryRefreshBtn')) {
      q('#libraryRefreshBtn').addEventListener('click', function () {
        loadLibraryPage();
      });
    }

    if (q('#libraryDropZone') && q('#libraryFileInput')) {
      var lz = q('#libraryDropZone');
      var li = q('#libraryFileInput');
      var ln = q('#libraryFileName');
      lz.addEventListener('click', function () { li.click(); });
      lz.addEventListener('dragover', function (e) { e.preventDefault(); lz.classList.add('upload-zone--drag'); });
      lz.addEventListener('dragleave', function () { lz.classList.remove('upload-zone--drag'); });
      lz.addEventListener('drop', function (e) {
        e.preventDefault(); lz.classList.remove('upload-zone--drag');
        if (!e.dataTransfer.files.length) return;
        try { var dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); li.files = dt.files; } catch (x) {}
        if (ln) ln.textContent = e.dataTransfer.files[0].name;
      });
      li.addEventListener('change', function () {
        if (ln) ln.textContent = this.files.length ? this.files[0].name : '';
      });
    }

    if (q('#libraryUploadBtn')) {
      q('#libraryUploadBtn').addEventListener('click', function () {
        var input = q('#libraryFileInput');
        if (!input || !input.files.length) { toast('Selecione um vídeo para importar', 'error'); return; }
        var fd = new FormData();
        fd.append('file', input.files[0]);
        var btn = q('#libraryUploadBtn');
        var info = q('#libraryUploadInfo');
        btn.disabled = true;
        btn.textContent = 'Importando...';
        if (info) info.textContent = 'Enviando arquivo...';
        api('POST', '/videos/library-upload', fd)
          .then(function (res) {
            if (res.success) {
              toast('Vídeo importado com sucesso');
              if (info) info.textContent = 'Importado! Agora edite uma seção e selecione este vídeo na biblioteca.';
              if (input) input.value = '';
              if (q('#libraryFileName')) q('#libraryFileName').textContent = '';
              loadLibraryPage();
            } else {
              toast(res.message || 'Erro ao importar', 'error');
              if (info) info.textContent = '';
            }
          })
          .catch(function (e) {
            toast('Erro: ' + (e.message || 'falha no upload'), 'error');
            if (info) info.textContent = '';
          })
          .then(function () {
            btn.disabled = false;
            btn.textContent = 'Importar vídeo';
          });
      });
    }

    var route = (window.location.hash || '').replace('#', '').toLowerCase();
    if (route === 'biblioteca' || route === 'library') {
      switchView('library');
      loadLibraryPage();
    } else {
      switchView('videos');
    }

    /* Modal close */
    q('#modalClose').addEventListener('click', function () { Modal.close(); });
    q('#modalOverlay').addEventListener('click', function (e) { if (e.target === this) Modal.close(); });

    /* Mobile sidebar */
    if (q('#menuToggle'))       q('#menuToggle').addEventListener('click', openSidebar);
    if (q('#sidebarBackdrop'))  q('#sidebarBackdrop').addEventListener('click', closeSidebar);
  });

})();