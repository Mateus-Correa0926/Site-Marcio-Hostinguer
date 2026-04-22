/* ========================================================
   Stornoway Films — Admin SPA Application
   Vanilla JS, hash-based routing, JWT auth
   ======================================================== */
(function () {
  'use strict';

  /* ============================================================
     CONFIG & CONSTANTS
     ============================================================ */
  var API = '/api';
  var SLOT_KEYS = [
    { key: 'hero_video', label: 'Vídeo Hero (principal)', type: 'video', section: 'hero', cssClass: 'slot-hero' },
    { key: 'hero_couple_image', label: 'Foto do Casal (hero)', type: 'image', section: 'hero', cssClass: 'slot-hero' },
    { key: 'teaser_video', label: 'Vídeo Teaser', type: 'video', section: 'teaser', cssClass: '' },
    { key: 'gallery_1', label: 'Galeria 1', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_2', label: 'Galeria 2', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_3', label: 'Galeria 3', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_4', label: 'Galeria 4', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_5', label: 'Galeria 5', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_6', label: 'Galeria 6', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_7', label: 'Galeria 7', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'gallery_8', label: 'Galeria 8', type: 'image', section: 'gallery', cssClass: 'slot-gallery' },
    { key: 'closing_landscape', label: 'Paisagem de Fechamento', type: 'image', section: 'closing', cssClass: '' },
    { key: 'featured_publication_logo', label: 'Logo da Publicação', type: 'image', section: 'featured', cssClass: '' }
  ];

  /* ============================================================
     UTILS
     ============================================================ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  }

  /* ============================================================
     AUTH
     ============================================================ */
  var Auth = {
    token: null,
    user: null,
    init: function () {
      this.token = localStorage.getItem('admin_token');
      this.user = JSON.parse(localStorage.getItem('admin_user') || 'null');
    },
    isLoggedIn: function () { return !!this.token; },
    login: function (token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
    },
    logout: function () {
      this.token = null;
      this.user = null;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
  };

  /* ============================================================
     API CLIENT
     ============================================================ */
  function api(method, path, body) {
    var opts = {
      method: method,
      headers: {}
    };
    if (Auth.token) opts.headers['Authorization'] = 'Bearer ' + Auth.token;
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body) {
      opts.body = body;
    }
    return fetch(API + path, opts).then(function (res) {
      if (res.status === 401) {
        Auth.logout();
        Router.go('#/login');
        return Promise.reject(new Error('Sessão expirada'));
      }
      return res.json();
    });
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function toast(message, type) {
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.textContent = message;
    var container = $('#toastContainer');
    container.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 4000);
  }

  /* ============================================================
     CONFIRM DIALOG
     ============================================================ */
  function confirm(title, text) {
    return new Promise(function (resolve) {
      var overlay = $('#confirmOverlay');
      overlay.style.display = 'flex';
      overlay.innerHTML =
        '<div class="confirm-box">' +
          '<h3 class="confirm-box__title">' + esc(title) + '</h3>' +
          '<p class="confirm-box__text">' + esc(text) + '</p>' +
          '<div class="confirm-box__actions">' +
            '<button class="btn btn-secondary" id="confirmCancel">Cancelar</button>' +
            '<button class="btn btn-danger" id="confirmOk">Confirmar</button>' +
          '</div>' +
        '</div>';
      $('#confirmOk').onclick = function () { overlay.style.display = 'none'; resolve(true); };
      $('#confirmCancel').onclick = function () { overlay.style.display = 'none'; resolve(false); };
    });
  }

  /* ============================================================
     MODAL
     ============================================================ */
  var Modal = {
    open: function (title, bodyHtml, footerHtml, large) {
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = bodyHtml;
      $('#modalFooter').innerHTML = footerHtml || '';
      if (large) $('#modalBox').classList.add('modal--large');
      else $('#modalBox').classList.remove('modal--large');
      $('#modalOverlay').classList.add('modal-overlay--active');
    },
    close: function () {
      $('#modalOverlay').classList.remove('modal-overlay--active');
    }
  };
  document.addEventListener('DOMContentLoaded', function () {
    $('#modalClose').addEventListener('click', Modal.close);
    $('#modalOverlay').addEventListener('click', function (e) {
      if (e.target === this) Modal.close();
    });
  });

  /* ============================================================
     ROUTER
     ============================================================ */
  var Router = {
    routes: {},
    register: function (hash, handler) { this.routes[hash] = handler; },
    go: function (hash) { window.location.hash = hash; },
    resolve: function () {
      var hash = window.location.hash || '#/projects';
      var parts = hash.replace('#/', '').split('/');
      var page = parts[0];
      var param = parts[1] || null;

      if (!Auth.isLoggedIn() && page !== 'login') {
        window.location.hash = '#/login';
        return;
      }

      if (Auth.isLoggedIn() && page === 'login') {
        window.location.hash = '#/projects';
        return;
      }

      // Update sidebar active state
      $$('.sidebar__link').forEach(function (link) {
        link.classList.remove('sidebar__link--active');
        if (link.dataset.page === page) link.classList.add('sidebar__link--active');
      });

      // Update UI
      if (Auth.isLoggedIn()) {
        $('#loginScreen').style.display = 'none';
        $('#adminLayout').style.display = 'flex';
        $('#adminUsername').textContent = Auth.user ? Auth.user.username : '';
      } else {
        $('#loginScreen').style.display = 'flex';
        $('#adminLayout').style.display = 'none';
      }

      var handler = this.routes[page];
      if (handler) handler(param);
    }
  };

  /* ============================================================
     PAGE: LOGIN
     ============================================================ */
  Router.register('login', function () {
    $('#loginScreen').style.display = 'flex';
    $('#adminLayout').style.display = 'none';
  });

  /* ============================================================
     PAGE: PROJECTS LIST
     ============================================================ */
  Router.register('projects', function (param) {
    if (param === 'new') return ProjectEditor.render(null);
    if (param) return ProjectEditor.render(param);

    $('#pageTitle').textContent = 'Projetos';
    $('#headerActions').innerHTML = '<a href="#/projects/new" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Novo Projeto</a>';
    $('#mainBody').innerHTML = '<div class="spinner"></div>';

    api('GET', '/projects?per_page=100').then(function (res) {
      var projects = res.data || [];
      if (!projects.length) {
        $('#mainBody').innerHTML =
          '<div class="empty-state">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8m-4-4h8"/></svg>' +
            '<p>Nenhum projeto ainda.</p>' +
            '<a href="#/projects/new" class="btn btn-primary">Criar Primeiro Projeto</a>' +
          '</div>';
        return;
      }

      var html = '<table class="data-table"><thead><tr>' +
        '<th style="width:40px"></th><th style="width:70px"></th>' +
        '<th>Casal</th><th>Localização</th><th>Status</th><th>Data</th><th style="width:150px">Ações</th>' +
        '</tr></thead><tbody>';

      projects.forEach(function (p) {
        var thumb = p.thumbnail_url
          ? '<img class="data-table__thumb" src="' + esc(p.thumbnail_url) + '" alt="" />'
          : '<div class="data-table__thumb" style="background:var(--admin-surface2)"></div>';
        var status = p.is_published == 1
          ? '<span class="badge badge-published">Publicado</span>'
          : '<span class="badge badge-draft">Rascunho</span>';
        var featured = p.is_featured == 1 ? ' <span class="badge badge-featured">Destaque</span>' : '';

        html += '<tr data-id="' + p.id + '">' +
          '<td><span class="drag-handle" title="Arrastar">&#x2630;</span></td>' +
          '<td>' + thumb + '</td>' +
          '<td><strong>' + esc(p.couple_names || p.title) + '</strong></td>' +
          '<td>' + esc(p.location) + '</td>' +
          '<td>' + status + featured + '</td>' +
          '<td>' + formatDate(p.project_date || p.created_at) + '</td>' +
          '<td>' +
            '<a href="#/projects/' + p.id + '" class="btn btn-secondary btn-sm">Editar</a> ' +
            '<button class="btn btn-danger btn-sm btn-delete-project" data-id="' + p.id + '" data-name="' + esc(p.couple_names || p.title) + '">Excluir</button>' +
          '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';
      $('#mainBody').innerHTML = html;

      // Delete handler
      $$('.btn-delete-project').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = this.dataset.id;
          var name = this.dataset.name;
          confirm('Excluir projeto?', 'Tem certeza que deseja excluir "' + name + '"? Esta ação não pode ser desfeita.').then(function (ok) {
            if (!ok) return;
            api('DELETE', '/projects/' + id).then(function () {
              toast('Projeto excluído', 'success');
              Router.resolve();
            });
          });
        });
      });
    });
  });

  /* ============================================================
     PAGE: PROJECT EDITOR
     ============================================================ */
  var ProjectEditor = {
    project: null,
    slots: {},
    isNew: false,

    render: function (id) {
      this.isNew = !id || id === 'new';
      var self = this;
      $('#pageTitle').textContent = self.isNew ? 'Novo Projeto' : 'Editar Projeto';
      $('#headerActions').innerHTML = '<a href="#/projects" class="btn btn-secondary">&larr; Voltar</a>';
      $('#mainBody').innerHTML = '<div class="spinner"></div>';

      if (self.isNew) {
        self.project = {
          title: '', couple_names: '', location: '', description: '',
          section_title: 'FEATURED FILMS', about_title: 'ABOUT THE WEDDING',
          about_text: '', featured_on: '', video_url: '', video_embed: '',
          is_featured: 0, is_published: 0
        };
        self.slots = {};
        self.renderEditor();
      } else {
        api('GET', '/projects/' + id).then(function (res) {
          self.project = res.data;
          self.slots = self.project.slots || {};
          self.renderEditor();
        });
      }
    },

    renderEditor: function () {
      var p = this.project;
      var self = this;

      var formHtml =
        '<div class="editor-form">' +
          '<div class="card" style="margin-bottom:24px;">' +
            '<h3 class="card__title">Informações do Casal</h3>' +
            '<div class="form-row">' +
              '<div class="form-group"><label class="form-label">Nome do Casal</label><input class="form-input" id="f_couple_names" value="' + esc(p.couple_names) + '" placeholder="McKenzie and Spencer" /></div>' +
              '<div class="form-group"><label class="form-label">Localização</label><input class="form-input" id="f_location" value="' + esc(p.location) + '" placeholder="Seattle, WA" /></div>' +
            '</div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label class="form-label">Título da Seção</label><input class="form-input" id="f_section_title" value="' + esc(p.section_title || 'FEATURED FILMS') + '" /></div>' +
              '<div class="form-group"><label class="form-label">Data do Evento</label><input type="date" class="form-input" id="f_project_date" value="' + esc(p.project_date || '') + '" /></div>' +
            '</div>' +
          '</div>' +

          '<div class="card" style="margin-bottom:24px;">' +
            '<h3 class="card__title">Sobre o Casamento</h3>' +
            '<div class="form-group"><label class="form-label">Título "Sobre"</label><input class="form-input" id="f_about_title" value="' + esc(p.about_title || 'ABOUT THE WEDDING') + '" /></div>' +
            '<div class="form-group"><label class="form-label">Descrição</label><textarea class="form-textarea" id="f_about_text" rows="5" placeholder="Descreva o casamento...">' + esc(p.about_text || p.description || '') + '</textarea></div>' +
          '</div>' +

          '<div class="card" style="margin-bottom:24px;">' +
            '<h3 class="card__title">Destaque</h3>' +
            '<div class="form-group"><label class="form-label">Publicado em (ex: Style Me Pretty)</label><input class="form-input" id="f_featured_on" value="' + esc(p.featured_on || '') + '" /></div>' +
            '<div class="form-group"><label class="form-label">URL do Vídeo (YouTube/Vimeo)</label><input class="form-input" id="f_video_url" value="' + esc(p.video_url || '') + '" placeholder="https://youtube.com/watch?v=..." /></div>' +
          '</div>' +

          '<div class="card" style="margin-bottom:24px;">' +
            '<h3 class="card__title">Depoimento</h3>' +
            '<div id="testimonialSection">' + self.renderTestimonials() + '</div>' +
          '</div>' +

          '<div class="card" style="margin-bottom:24px;">' +
            '<h3 class="card__title">Configurações</h3>' +
            '<div class="form-row">' +
              '<div class="form-group"><label class="form-label"><input type="checkbox" id="f_is_featured" ' + (p.is_featured == 1 ? 'checked' : '') + ' /> Projeto em Destaque</label></div>' +
              '<div class="form-group"><label class="form-label"><input type="checkbox" id="f_is_published" ' + (p.is_published == 1 ? 'checked' : '') + ' /> Publicado</label></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      // Slot preview column
      var previewHtml =
        '<div class="editor-preview">' +
          '<div class="card">' +
            '<h3 class="card__title">Layout Visual — Slots</h3>' +
            '<p class="form-hint" style="margin-bottom:16px;">Clique em cada slot para adicionar mídia. Slots vazios usarão conteúdo de fallback.</p>' +
            '<div class="slot-preview" id="slotPreview">' +
              self.renderSlotsPreview() +
            '</div>' +
          '</div>' +
        '</div>';

      $('#mainBody').innerHTML =
        '<div class="editor-layout">' + formHtml + previewHtml + '</div>' +
        '<div class="save-bar">' +
          '<button class="btn btn-secondary" id="btnSaveDraft">Salvar Rascunho</button>' +
          '<button class="btn btn-primary" id="btnPublish">Publicar</button>' +
        '</div>';

      // Bind save
      $('#btnSaveDraft').addEventListener('click', function () { self.save(false); });
      $('#btnPublish').addEventListener('click', function () { self.save(true); });

      // Bind slot clicks
      $$('.slot-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var key = this.dataset.slotKey;
          self.openMediaPicker(key);
        });
      });

      // Bind slot remove buttons
      $$('.slot-remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var key = this.dataset.slotKey;
          delete self.slots[key];
          self.refreshSlots();
        });
      });
    },

    renderTestimonials: function () {
      var testimonials = this.project.testimonials || [];
      var html = '';
      if (testimonials.length) {
        testimonials.forEach(function (t, i) {
          html +=
            '<div class="form-group" style="border:1px solid var(--admin-border);border-radius:var(--admin-radius);padding:12px;margin-bottom:12px;">' +
              '<div class="form-group"><label class="form-label">Depoimento #' + (i + 1) + '</label>' +
              '<textarea class="form-textarea testimonial-quote" data-idx="' + i + '" rows="3">' + esc(t.content || t.quote || '') + '</textarea></div>' +
              '<div class="form-row"><div class="form-group"><label class="form-label">Autor</label>' +
              '<input class="form-input testimonial-author" data-idx="' + i + '" value="' + esc(t.client_name || t.author || '') + '" /></div>' +
              '<div class="form-group"><label class="form-label">Nota (1-5)</label>' +
              '<input type="number" min="1" max="5" class="form-input testimonial-rating" data-idx="' + i + '" value="' + (t.rating || 5) + '" /></div></div>' +
            '</div>';
        });
      } else {
        html +=
          '<div class="form-group" style="border:1px solid var(--admin-border);border-radius:var(--admin-radius);padding:12px;">' +
            '<div class="form-group"><label class="form-label">Depoimento</label>' +
            '<textarea class="form-textarea testimonial-quote" data-idx="0" rows="3" placeholder="O que o casal disse..."></textarea></div>' +
            '<div class="form-row"><div class="form-group"><label class="form-label">Autor</label>' +
            '<input class="form-input testimonial-author" data-idx="0" placeholder="Nome do casal" /></div>' +
            '<div class="form-group"><label class="form-label">Nota (1-5)</label>' +
            '<input type="number" min="1" max="5" class="form-input testimonial-rating" data-idx="0" value="5" /></div></div>' +
          '</div>';
      }
      return html;
    },

    renderSlotsPreview: function () {
      var self = this;
      var html = '';
      var currentSection = '';

      SLOT_KEYS.forEach(function (slot) {
        if (slot.section !== currentSection) {
          currentSection = slot.section;
          var sectionLabels = {
            hero: 'Hero / Topo',
            teaser: 'Vídeo Teaser',
            gallery: 'Galeria de Fotos',
            closing: 'Fechamento',
            featured: 'Publicação'
          };
          html += '<p class="slot-preview__section-title">' + (sectionLabels[slot.section] || slot.section) + '</p>';
          if (slot.section === 'gallery') html += '<div class="slot-gallery-grid">';
        }

        var slotData = self.slots[slot.key];
        var filled = slotData && slotData.length > 0 && slotData[0].media_id;
        var media = filled ? slotData[0] : null;

        if (filled) {
          var src = media.url || media.thumbnail_url || '';
          var isFallback = media.is_fallback_fill ? ' (fallback)' : '';
          html +=
            '<div class="slot-item slot-item--filled ' + slot.cssClass + '" data-slot-key="' + slot.key + '">' +
              '<span class="slot-item__label">' + esc(slot.label) + isFallback + '</span>' +
              '<div class="slot-item__preview">' +
                (slot.type === 'video'
                  ? '<img src="' + esc(media.thumbnail_url || src) + '" alt="" />'
                  : '<img src="' + esc(src) + '" alt="" />') +
              '</div>' +
              '<div class="slot-item__overlay">' +
                '<button class="btn btn-sm btn-secondary">Trocar</button>' +
                '<button class="btn btn-sm btn-danger slot-remove-btn" data-slot-key="' + slot.key + '">Remover</button>' +
              '</div>' +
            '</div>';
        } else {
          html +=
            '<div class="slot-item ' + slot.cssClass + '" data-slot-key="' + slot.key + '">' +
              '<div class="slot-item__empty">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14m-7-7h14"/></svg>' +
                '<p>' + esc(slot.label) + '</p>' +
                '<p style="font-size:10px;opacity:.6">' + slot.type + ' &middot; Clique para adicionar</p>' +
              '</div>' +
            '</div>';
        }

        // Close gallery grid after last gallery item
        if (slot.key === 'gallery_8') html += '</div>';
      });

      return html;
    },

    refreshSlots: function () {
      var preview = $('#slotPreview');
      if (preview) preview.innerHTML = this.renderSlotsPreview();

      var self = this;
      $$('.slot-item').forEach(function (el) {
        el.addEventListener('click', function () {
          self.openMediaPicker(this.dataset.slotKey);
        });
      });
      $$('.slot-remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          delete self.slots[this.dataset.slotKey];
          self.refreshSlots();
        });
      });
    },

    openMediaPicker: function (slotKey) {
      var self = this;
      var slotDef = SLOT_KEYS.find(function (s) { return s.key === slotKey; });
      var typeFilter = slotDef ? slotDef.type : '';

      Modal.open('Selecionar Mídia — ' + (slotDef ? slotDef.label : slotKey),
        '<div style="margin-bottom:16px;">' +
          '<div class="upload-zone" id="pickerUploadZone">' +
            '<div class="upload-zone__icon">&#x1F4E4;</div>' +
            '<p class="upload-zone__text">Arraste um arquivo ou <strong>clique para enviar</strong></p>' +
            '<input type="file" id="pickerFileInput" style="display:none" accept="' + (typeFilter === 'video' ? 'video/*' : 'image/*') + '" />' +
          '</div>' +
        '</div>' +
        '<div class="filters-bar">' +
          '<input class="form-input" id="pickerSearch" placeholder="Buscar..." />' +
          '<select class="form-select" id="pickerType"><option value="">Todos</option><option value="image"' + (typeFilter === 'image' ? ' selected' : '') + '>Imagens</option><option value="video"' + (typeFilter === 'video' ? ' selected' : '') + '>Vídeos</option></select>' +
        '</div>' +
        '<div class="media-grid" id="pickerGrid"><div class="spinner"></div></div>',
        '<button class="btn btn-secondary" id="pickerCancel">Cancelar</button>',
        true
      );

      // Upload zone
      var zone = $('#pickerUploadZone');
      var fileInput = $('#pickerFileInput');
      zone.addEventListener('click', function () { fileInput.click(); });
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('upload-zone--drag'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('upload-zone--drag'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('upload-zone--drag');
        if (e.dataTransfer.files.length) uploadAndSelect(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', function () {
        if (this.files.length) uploadAndSelect(this.files[0]);
      });

      function uploadAndSelect(file) {
        var fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'projects');
        toast('Enviando...', 'info');
        api('POST', '/media/upload', fd).then(function (res) {
          if (res.data && res.data.length) {
            var m = res.data[0];
            self.slots[slotKey] = [{ media_id: m.id, url: m.url, thumbnail_url: m.thumbnail_url, file_type: m.file_type }];
            self.refreshSlots();
            Modal.close();
            toast('Mídia adicionada ao slot', 'success');
          }
        }).catch(function () { toast('Erro no upload', 'error'); });
      }

      // Load media list
      function loadPickerMedia() {
        var search = ($('#pickerSearch') || {}).value || '';
        var type = ($('#pickerType') || {}).value || '';
        var q = '?per_page=60';
        if (type) q += '&type=' + type;
        if (search) q += '&search=' + encodeURIComponent(search);

        api('GET', '/media' + q).then(function (res) {
          var items = res.data || [];
          var grid = $('#pickerGrid');
          if (!grid) return;
          if (!items.length) {
            grid.innerHTML = '<p class="empty-state">Nenhuma mídia encontrada.</p>';
            return;
          }
          var html = '';
          items.forEach(function (m) {
            var src = m.thumbnail_url || m.url || '';
            html +=
              '<div class="media-item" data-media-id="' + m.id + '" data-url="' + esc(m.url) + '" data-thumb="' + esc(m.thumbnail_url || '') + '" data-type="' + esc(m.file_type) + '">' +
                '<img class="media-item__img" src="' + esc(src) + '" alt="' + esc(m.original_name) + '" loading="lazy" />' +
                '<div class="media-item__info">' +
                  '<p class="media-item__name">' + esc(m.original_name) + '</p>' +
                  '<p class="media-item__meta">' + esc(m.file_type) + ' &middot; ' + formatBytes(m.file_size) + '</p>' +
                '</div>' +
              '</div>';
          });
          grid.innerHTML = html;

          // Click to select
          $$('.media-item', grid).forEach(function (item) {
            item.addEventListener('click', function () {
              var mid = this.dataset.mediaId;
              self.slots[slotKey] = [{
                media_id: parseInt(mid),
                url: this.dataset.url,
                thumbnail_url: this.dataset.thumb,
                file_type: this.dataset.type
              }];
              self.refreshSlots();
              Modal.close();
              toast('Mídia atribuída ao slot', 'success');
            });
          });
        });
      }

      loadPickerMedia();
      var searchTimer;
      if ($('#pickerSearch')) {
        $('#pickerSearch').addEventListener('input', function () {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(loadPickerMedia, 300);
        });
      }
      if ($('#pickerType')) {
        $('#pickerType').addEventListener('change', loadPickerMedia);
      }
      $('#pickerCancel').addEventListener('click', Modal.close);
    },

    save: function (publish) {
      var self = this;
      var data = {
        title: $('#f_couple_names').value || 'Sem título',
        couple_names: $('#f_couple_names').value,
        location: $('#f_location').value,
        section_title: $('#f_section_title').value,
        about_title: $('#f_about_title').value,
        about_text: $('#f_about_text').value,
        description: $('#f_about_text').value,
        featured_on: $('#f_featured_on').value,
        video_url: $('#f_video_url').value,
        project_date: $('#f_project_date').value || null,
        is_featured: $('#f_is_featured').checked ? 1 : 0,
        is_published: publish ? 1 : ($('#f_is_published').checked ? 1 : 0)
      };

      // Warn about empty slots
      var filledCount = 0;
      var totalSlots = SLOT_KEYS.length;
      SLOT_KEYS.forEach(function (s) {
        if (self.slots[s.key] && self.slots[s.key].length && self.slots[s.key][0].media_id) filledCount++;
      });
      var emptyCount = totalSlots - filledCount;

      function doSave() {
        var method = self.isNew ? 'POST' : 'PUT';
        var url = self.isNew ? '/projects' : '/projects/' + self.project.id;

        api(method, url, data).then(function (res) {
          var projectId = self.isNew ? res.data.id : self.project.id;

          // Save slots
          var slotsPayload = [];
          SLOT_KEYS.forEach(function (s) {
            var slotData = self.slots[s.key];
            if (slotData && slotData.length && slotData[0].media_id) {
              slotsPayload.push({
                slot_key: s.key,
                media_id: slotData[0].media_id,
                position: 0,
                custom_caption: slotData[0].custom_caption || ''
              });
            }
          });

          api('POST', '/project-slots/' + projectId, { slots: slotsPayload }).then(function () {
            // Save testimonial
            var quote = ($('.testimonial-quote') || {}).value;
            var author = ($('.testimonial-author') || {}).value;
            if (quote && author) {
              var existingTestimonials = self.project.testimonials || [];
              if (existingTestimonials.length > 0) {
                api('PUT', '/testimonials/' + existingTestimonials[0].id, {
                  content: quote,
                  client_name: author,
                  rating: parseInt(($('.testimonial-rating') || {}).value) || 5,
                  project_id: projectId
                });
              } else {
                api('POST', '/testimonials', {
                  content: quote,
                  client_name: author,
                  rating: parseInt(($('.testimonial-rating') || {}).value) || 5,
                  project_id: projectId
                });
              }
            }

            toast(publish ? 'Projeto publicado!' : 'Rascunho salvo!', 'success');
            Router.go('#/projects');
          });
        }).catch(function (err) {
          toast('Erro ao salvar: ' + (err.message || 'desconhecido'), 'error');
        });
      }

      if (publish && emptyCount > 0) {
        confirm(
          'Slots vazios',
          'Você tem ' + emptyCount + ' slot(s) vazio(s) de ' + totalSlots + '. Eles serão preenchidos com fallbacks. Deseja continuar?'
        ).then(function (ok) { if (ok) doSave(); });
      } else {
        doSave();
      }
    }
  };

  /* ============================================================
     PAGE: MEDIA LIBRARY
     ============================================================ */
  Router.register('media', function () {
    $('#pageTitle').textContent = 'Biblioteca de Mídia';
    $('#headerActions').innerHTML = '';
    $('#mainBody').innerHTML =
      '<div class="upload-zone" id="mediaUploadZone" style="margin-bottom:24px;">' +
        '<div class="upload-zone__icon">&#x1F4E4;</div>' +
        '<p class="upload-zone__text">Arraste arquivos ou <strong>clique para enviar</strong> — imagens e vídeos</p>' +
        '<input type="file" id="mediaFileInput" style="display:none" multiple accept="image/*,video/*" />' +
      '</div>' +
      '<div class="filters-bar">' +
        '<input class="form-input" id="mediaSearch" placeholder="Buscar nome ou alt..." />' +
        '<select class="form-select" id="mediaTypeFilter"><option value="">Todos os tipos</option><option value="image">Imagens</option><option value="video">Vídeos</option></select>' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--admin-text-muted);cursor:pointer;"><input type="checkbox" id="mediaFallbackFilter" /> Apenas fallback</label>' +
      '</div>' +
      '<div class="media-grid" id="mediaGrid"><div class="spinner"></div></div>' +
      '<div id="mediaPagination"></div>';

    var page = 1;
    var zone = $('#mediaUploadZone');
    var fileInput = $('#mediaFileInput');
    zone.addEventListener('click', function () { fileInput.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('upload-zone--drag'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('upload-zone--drag'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('upload-zone--drag');
      uploadFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', function () { uploadFiles(this.files); });

    function uploadFiles(files) {
      if (!files.length) return;
      var fd = new FormData();
      if (files.length === 1) {
        fd.append('file', files[0]);
      } else {
        for (var i = 0; i < files.length; i++) fd.append('files[]', files[i]);
      }
      fd.append('folder', 'general');
      toast('Enviando ' + files.length + ' arquivo(s)...', 'info');
      api('POST', '/media/upload', fd).then(function () {
        toast('Upload concluído!', 'success');
        loadMedia();
      }).catch(function () { toast('Erro no upload', 'error'); });
    }

    function loadMedia() {
      var search = ($('#mediaSearch') || {}).value || '';
      var type = ($('#mediaTypeFilter') || {}).value || '';
      var q = '?per_page=48&page=' + page;
      if (type) q += '&type=' + type;
      if (search) q += '&search=' + encodeURIComponent(search);

      api('GET', '/media' + q).then(function (res) {
        var items = res.data || [];
        var grid = $('#mediaGrid');
        if (!items.length) {
          grid.innerHTML = '<p class="empty-state">Nenhuma mídia encontrada.</p>';
          $('#mediaPagination').innerHTML = '';
          return;
        }

        var fallbackOnly = $('#mediaFallbackFilter') && $('#mediaFallbackFilter').checked;
        if (fallbackOnly) items = items.filter(function (m) { return m.is_fallback == 1; });

        var html = '';
        items.forEach(function (m) {
          var src = m.thumbnail_url || m.url || '';
          var fallbackBadge = m.is_fallback == 1 ? '<span class="media-item__badge">Fallback</span>' : '';
          html +=
            '<div class="media-item" data-id="' + m.id + '">' +
              fallbackBadge +
              '<img class="media-item__img" src="' + esc(src) + '" alt="' + esc(m.original_name) + '" loading="lazy" />' +
              '<div class="media-item__info">' +
                '<p class="media-item__name">' + esc(m.original_name) + '</p>' +
                '<p class="media-item__meta">' + esc(m.file_type) + ' &middot; ' + formatBytes(m.file_size) + '</p>' +
              '</div>' +
            '</div>';
        });
        grid.innerHTML = html;

        // Click to open detail
        $$('.media-item', grid).forEach(function (el) {
          el.addEventListener('click', function () { openMediaDetail(this.dataset.id); });
        });

        // Pagination
        var total = res.pagination ? res.pagination.total : items.length;
        var totalPages = Math.ceil(total / 48);
        var pagHtml = '';
        if (totalPages > 1) {
          pagHtml += '<button class="pagination__btn" ' + (page <= 1 ? 'disabled' : '') + ' data-p="' + (page - 1) + '">&laquo;</button>';
          for (var i = 1; i <= totalPages && i <= 10; i++) {
            pagHtml += '<button class="pagination__btn' + (i === page ? ' pagination__btn--active' : '') + '" data-p="' + i + '">' + i + '</button>';
          }
          pagHtml += '<button class="pagination__btn" ' + (page >= totalPages ? 'disabled' : '') + ' data-p="' + (page + 1) + '">&raquo;</button>';
        }
        var pagEl = $('#mediaPagination');
        pagEl.innerHTML = '<div class="pagination">' + pagHtml + '</div>';
        $$('.pagination__btn', pagEl).forEach(function (b) {
          b.addEventListener('click', function () {
            if (!this.disabled) { page = parseInt(this.dataset.p); loadMedia(); }
          });
        });
      });
    }

    function openMediaDetail(id) {
      api('GET', '/media/' + id).then(function (res) {
        var m = res.data;
        var src = m.url || '';
        var tags = m.tags ? (typeof m.tags === 'string' ? JSON.parse(m.tags) : m.tags) : [];

        Modal.open('Detalhes da Mídia',
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">' +
            '<div>' +
              (m.file_type === 'video'
                ? '<video src="' + esc(src) + '" controls style="width:100%;border-radius:8px;"></video>'
                : '<img src="' + esc(src) + '" style="width:100%;border-radius:8px;" />') +
            '</div>' +
            '<div>' +
              '<div class="form-group"><label class="form-label">Nome</label><p style="font-size:13px;">' + esc(m.original_name) + '</p></div>' +
              '<div class="form-group"><label class="form-label">Tipo</label><p style="font-size:13px;">' + esc(m.mime_type) + '</p></div>' +
              '<div class="form-group"><label class="form-label">Tamanho</label><p style="font-size:13px;">' + formatBytes(m.file_size) + (m.width ? ' — ' + m.width + 'x' + m.height : '') + '</p></div>' +
              '<div class="form-group"><label class="form-label">Texto alternativo</label><input class="form-input" id="detailAlt" value="' + esc(m.alt_text || '') + '" /></div>' +
              '<div class="form-group"><label class="form-label">Tags (separar por vírgula)</label><input class="form-input" id="detailTags" value="' + esc(tags.join(', ')) + '" /></div>' +
              '<div class="form-group"><label class="form-label" style="cursor:pointer;"><input type="checkbox" id="detailFallback" ' + (m.is_fallback == 1 ? 'checked' : '') + ' /> Marcar como fallback</label></div>' +
            '</div>' +
          '</div>',
          '<button class="btn btn-danger" id="detailDelete">Excluir</button>' +
          '<button class="btn btn-secondary" id="detailCancel">Cancelar</button>' +
          '<button class="btn btn-primary" id="detailSave">Salvar</button>',
          true
        );

        $('#detailSave').addEventListener('click', function () {
          var tagStr = $('#detailTags').value;
          var tagsArr = tagStr.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
          api('PUT', '/media/' + id, {
            alt_text: $('#detailAlt').value,
            tags: tagsArr,
            is_fallback: $('#detailFallback').checked ? 1 : 0
          }).then(function () {
            toast('Mídia atualizada', 'success');
            Modal.close();
            loadMedia();
          });
        });

        $('#detailDelete').addEventListener('click', function () {
          confirm('Excluir mídia?', 'Esta ação é irreversível.').then(function (ok) {
            if (!ok) return;
            api('DELETE', '/media/' + id).then(function () {
              toast('Mídia excluída', 'success');
              Modal.close();
              loadMedia();
            });
          });
        });

        $('#detailCancel').addEventListener('click', Modal.close);
      });
    }

    loadMedia();
    var timer;
    $('#mediaSearch').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { page = 1; loadMedia(); }, 300); });
    $('#mediaTypeFilter').addEventListener('change', function () { page = 1; loadMedia(); });
    $('#mediaFallbackFilter').addEventListener('change', function () { loadMedia(); });
  });

  /* ============================================================
     PAGE: FALLBACK POOL
     ============================================================ */
  Router.register('fallback', function () {
    $('#pageTitle').textContent = 'Fallback Pool';
    $('#headerActions').innerHTML =
      '<button class="btn btn-primary" id="addFallbackBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Adicionar Fallback</button>';
    $('#mainBody').innerHTML = '<div class="spinner"></div>';

    function load() {
      api('GET', '/fallback-pool').then(function (res) {
        var items = res.data || [];
        if (!items.length) {
          $('#mainBody').innerHTML =
            '<div class="empty-state">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v4m0 12v4m-7-10H1m22 0h-4"/></svg>' +
              '<p>Nenhum fallback configurado. Adicione assets genéricos da marca para preencher slots vazios.</p>' +
            '</div>';
          return;
        }

        // Group by slot_type
        var groups = {};
        items.forEach(function (item) {
          if (!groups[item.slot_type]) groups[item.slot_type] = [];
          groups[item.slot_type].push(item);
        });

        var html = '';
        var slotLabels = {};
        SLOT_KEYS.forEach(function (s) { slotLabels[s.key] = s.label; });
        slotLabels['gallery_image'] = 'Galeria (genérico)';

        Object.keys(groups).sort().forEach(function (type) {
          html += '<div class="fallback-slot-group"><h4 class="fallback-slot-group__title">' +
            '<span class="badge badge-featured">' + esc(type) + '</span> ' +
            esc(slotLabels[type] || type) +
          '</h4><div class="fallback-items">';

          groups[type].forEach(function (item) {
            var src = item.thumbnail_url || item.url || '';
            html +=
              '<div class="fallback-item" data-id="' + item.id + '">' +
                '<img class="fallback-item__img" src="' + esc(src) + '" alt="" />' +
                '<span class="fallback-item__priority">#' + (item.priority + 1) + '</span>' +
                '<button class="fallback-item__remove" data-id="' + item.id + '">&times;</button>' +
                (!item.is_active ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--admin-warning);">Inativo</div>' : '') +
              '</div>';
          });

          html += '</div></div>';
        });

        $('#mainBody').innerHTML = html;

        // Remove buttons
        $$('.fallback-item__remove').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var fbId = this.dataset.id;
            confirm('Remover fallback?', 'Este asset será removido do pool de fallback.').then(function (ok) {
              if (!ok) return;
              api('DELETE', '/fallback-pool/' + fbId).then(function () {
                toast('Fallback removido', 'success');
                load();
              });
            });
          });
        });
      });
    }

    load();

    // Add fallback button
    setTimeout(function () {
      var addBtn = $('#addFallbackBtn');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var slotOptions = '';
          SLOT_KEYS.forEach(function (s) {
            slotOptions += '<option value="' + s.key + '">' + esc(s.label) + ' (' + s.type + ')</option>';
          });
          slotOptions += '<option value="gallery_image">Galeria (genérico)</option>';

          Modal.open('Adicionar ao Fallback Pool',
            '<div class="form-group"><label class="form-label">Tipo de Slot</label>' +
            '<select class="form-select" id="fbSlotType">' + slotOptions + '</select></div>' +
            '<p class="form-label" style="margin-bottom:12px;">Selecione uma mídia:</p>' +
            '<div class="media-grid" id="fbMediaGrid"><div class="spinner"></div></div>',
            '<button class="btn btn-secondary" id="fbCancel">Cancelar</button>',
            true
          );

          api('GET', '/media?per_page=60').then(function (res) {
            var items = res.data || [];
            var grid = $('#fbMediaGrid');
            var html = '';
            items.forEach(function (m) {
              var src = m.thumbnail_url || m.url || '';
              html +=
                '<div class="media-item" data-id="' + m.id + '">' +
                  '<img class="media-item__img" src="' + esc(src) + '" loading="lazy" />' +
                  '<div class="media-item__info"><p class="media-item__name">' + esc(m.original_name) + '</p></div>' +
                '</div>';
            });
            grid.innerHTML = html;

            $$('.media-item', grid).forEach(function (el) {
              el.addEventListener('click', function () {
                var mediaId = this.dataset.id;
                var slotType = $('#fbSlotType').value;
                api('POST', '/fallback-pool', { media_id: parseInt(mediaId), slot_type: slotType }).then(function () {
                  toast('Fallback adicionado!', 'success');
                  Modal.close();
                  load();
                });
              });
            });
          });

          $('#fbCancel').addEventListener('click', Modal.close);
        });
      }
    }, 100);
  });

  /* ============================================================
     PAGE: SITE SETTINGS
     ============================================================ */
  Router.register('settings', function () {
    $('#pageTitle').textContent = 'Textos do Site';
    $('#headerActions').innerHTML =
      '<button class="btn btn-primary" id="addSettingBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Nova Chave</button>';
    $('#mainBody').innerHTML = '<div class="spinner"></div>';

    function load() {
      api('GET', '/settings').then(function (res) {
        var settings = res.data || {};
        var keys = Object.keys(settings).sort();

        if (!keys.length) {
          $('#mainBody').innerHTML = '<div class="empty-state"><p>Nenhuma configuração encontrada.</p></div>';
          return;
        }

        // Group by prefix
        var groups = {};
        keys.forEach(function (key) {
          var group = key.split('_')[0] || 'general';
          if (!groups[group]) groups[group] = [];
          groups[group].push({ key: key, value: settings[key].value || '', type: settings[key].type || 'text' });
        });

        var html = '';
        Object.keys(groups).sort().forEach(function (group) {
          html += '<div class="card" style="margin-bottom:20px;"><h3 class="card__title" style="text-transform:capitalize;">' + esc(group) + '</h3>';
          groups[group].forEach(function (s) {
            html +=
              '<div class="settings-item">' +
                '<div class="settings-item__key">' + esc(s.key) + '</div>' +
                '<div><textarea class="form-textarea setting-value" data-key="' + esc(s.key) + '" rows="2" style="min-height:40px;">' + esc(s.value) + '</textarea></div>' +
                '<div><button class="btn btn-danger btn-sm btn-delete-setting" data-key="' + esc(s.key) + '">Excluir</button></div>' +
              '</div>';
          });
          html += '</div>';
        });

        html += '<div style="margin-top:20px;"><button class="btn btn-primary" id="saveAllSettings">Salvar Todas as Configurações</button></div>';
        $('#mainBody').innerHTML = html;

        // Save all
        $('#saveAllSettings').addEventListener('click', function () {
          var payload = {};
          $$('.setting-value').forEach(function (el) {
            payload[el.dataset.key] = el.value;
          });
          api('PUT', '/settings', payload).then(function () {
            toast('Configurações salvas!', 'success');
          });
        });

        // Delete
        $$('.btn-delete-setting').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var key = this.dataset.key;
            confirm('Excluir configuração?', 'Chave "' + key + '" será removida.').then(function (ok) {
              if (!ok) return;
              api('DELETE', '/settings/' + key).then(function () {
                toast('Configuração removida', 'success');
                load();
              });
            });
          });
        });
      });
    }

    load();

    // Add setting
    setTimeout(function () {
      var btn = $('#addSettingBtn');
      if (btn) {
        btn.addEventListener('click', function () {
          Modal.open('Nova Configuração',
            '<div class="form-group"><label class="form-label">Chave (ex: footer_tagline)</label><input class="form-input" id="newSettingKey" placeholder="grupo_nome" /></div>' +
            '<div class="form-group"><label class="form-label">Valor</label><textarea class="form-textarea" id="newSettingValue" rows="3"></textarea></div>' +
            '<div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="newSettingType"><option value="text">Texto</option><option value="html">HTML</option><option value="json">JSON</option></select></div>',
            '<button class="btn btn-secondary" id="newSettingCancel">Cancelar</button>' +
            '<button class="btn btn-primary" id="newSettingSave">Salvar</button>'
          );

          $('#newSettingSave').addEventListener('click', function () {
            var key = $('#newSettingKey').value.trim();
            var val = $('#newSettingValue').value;
            var type = $('#newSettingType').value;
            if (!key) { toast('Chave é obrigatória', 'error'); return; }
            api('POST', '/settings', { setting_key: key, setting_value: val, setting_type: type }).then(function () {
              toast('Configuração adicionada', 'success');
              Modal.close();
              load();
            });
          });

          $('#newSettingCancel').addEventListener('click', Modal.close);
        });
      }
    }, 100);
  });

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    Auth.init();

    // Login form
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var user = $('#loginUser').value;
      var pass = $('#loginPass').value;
      var errEl = $('#loginError');
      errEl.style.display = 'none';

      api('POST', '/auth/login', { username: user, password: pass })
        .then(function (res) {
          if (res.data && res.data.token) {
            Auth.login(res.data.token, res.data.user || { username: user });
            Router.go('#/projects');
            Router.resolve();
          } else {
            errEl.textContent = res.message || 'Credenciais inválidas';
            errEl.style.display = 'block';
          }
        })
        .catch(function () {
          errEl.textContent = 'Erro de conexão';
          errEl.style.display = 'block';
        });
    });

    // Logout
    $('#logoutBtn').addEventListener('click', function (e) {
      e.preventDefault();
      Auth.logout();
      Router.go('#/login');
      Router.resolve();
    });

    // Sidebar toggle (mobile)
    $('#sidebarToggle').addEventListener('click', function () {
      $('#sidebar').classList.toggle('sidebar--open');
    });

    // Listen hash
    window.addEventListener('hashchange', function () { Router.resolve(); });
    Router.resolve();
  });
})();
