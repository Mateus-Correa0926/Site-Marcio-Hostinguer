/* ========================================================
   Stornoway Films — Frontend CMS Integration
   Fetches content from the admin API and updates pages
   ======================================================== */
(function () {
  'use strict';

  var API_BASE = '/api';
  var SETTINGS_CACHE_KEY = 'sf_settings';
  var PROJECTS_CACHE_KEY = 'sf_projects';
  var CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /* ---------- Helpers ---------- */
  function fetchJSON(url) {
    return fetch(API_BASE + url)
      .then(function (res) { return res.json(); })
      .then(function (json) { return json.success ? json.data : null; })
      .catch(function () { return null; });
  }

  function getCache(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
      return obj.data;
    } catch (e) { return null; }
  }

  function setCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); }
    catch (e) { /* quota exceeded, ignore */ }
  }

  function setText(selector, value) {
    var els = document.querySelectorAll(selector);
    els.forEach(function (el) { el.textContent = value; });
  }

  function setHTML(selector, value) {
    var els = document.querySelectorAll(selector);
    els.forEach(function (el) { el.innerHTML = value; });
  }

  function setSrc(selector, value) {
    var els = document.querySelectorAll(selector);
    els.forEach(function (el) { el.setAttribute('src', value); });
  }

  /* ---------- Settings Mapping ---------- */
  // Maps setting_key -> CSS selectors and update method
  var SETTINGS_MAP = {
    // Hero section
    'hero_title': { sel: '[data-cms="hero_title"]', method: 'html' },
    'hero_subtitle_top': { sel: '[data-cms="hero_subtitle_top"]', method: 'text' },
    'hero_subtitle_bottom': { sel: '[data-cms="hero_subtitle_bottom"]', method: 'text' },
    'hero_cta_text': { sel: '[data-cms="hero_cta_text"]', method: 'text' },

    // Brand statement
    'brand_statement': { sel: '[data-cms="brand_statement"]', method: 'html' },

    // CTA
    'cta_title': { sel: '[data-cms="cta_title"]', method: 'html' },
    'cta_subtitle': { sel: '[data-cms="cta_subtitle"]', method: 'text' },

    // Founder
    'founder_name': { sel: '[data-cms="founder_name"]', method: 'text' },
    'founder_bio': { sel: '[data-cms="founder_bio"]', method: 'text' },
    'founder_image': { sel: '[data-cms="founder_image"]', method: 'src' },

    // Testimonial
    'testimonial_quote': { sel: '[data-cms="testimonial_quote"]', method: 'html' },
    'testimonial_author': { sel: '[data-cms="testimonial_author"]', method: 'text' },

    // Footer
    'footer_tagline': { sel: '[data-cms="footer_tagline"]', method: 'text' },
    'footer_description': { sel: '[data-cms="footer_description"]', method: 'text' },

    // Investment
    'investment_price': { sel: '[data-cms="investment_price"]', method: 'text' },
    'investment_text': { sel: '[data-cms="investment_text"]', method: 'text' },

    // Contact
    'contact_email': { sel: '[data-cms="contact_email"]', method: 'text' },

    // Logos
    'site_logo': { sel: '[data-cms="site_logo"]', method: 'src' }
  };

  function applySettings(settings) {
    if (!settings) return;
    Object.keys(SETTINGS_MAP).forEach(function (key) {
      var val = settings[key];
      if (!val) return;
      var value = typeof val === 'object' ? val.value : val;
      if (!value) return;

      var map = SETTINGS_MAP[key];
      var els = document.querySelectorAll(map.sel);
      if (!els.length) return;

      els.forEach(function (el) {
        switch (map.method) {
          case 'text': el.textContent = value; break;
          case 'html': el.innerHTML = value; break;
          case 'src': el.setAttribute('src', value); break;
        }
      });
    });
  }

  /* ---------- Projects Integration ---------- */
  function applyProjects(projects) {
    if (!projects || !projects.length) return;

    // Update film cards grid (index.html)
    var filmGrid = document.querySelector('.films-grid__items');
    if (filmGrid) {
      var featuredProjects = projects.filter(function (p) { return p.is_featured == 1; }).slice(0, 3);
      if (featuredProjects.length > 0) {
        var html = '';
        featuredProjects.forEach(function (p) {
          var thumb = p.thumbnail_url || 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80';
          html +=
            '<a href="/featured-films.html#featured-films-' + p.id + '" class="film-card">' +
              '<img src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(p.couple_names || p.title) + '" loading="lazy" />' +
              '<div class="film-card__overlay">' +
                '<span class="film-card__name">' + escapeHtml(p.couple_names || p.title) + '</span>' +
                '<span class="film-card__location">' + escapeHtml(p.location || '') + '</span>' +
              '</div>' +
            '</a>';
        });
        filmGrid.innerHTML = html;
      }
    }

    // Update portfolio items (films.html)
    var portfolioGrid = document.querySelector('.portfolio-grid__inner');
    if (portfolioGrid) {
      var publishedProjects = projects.filter(function (p) { return p.is_published == 1; });
      if (publishedProjects.length > 0) {
        var html = '';
        publishedProjects.forEach(function (p) {
          var thumb = p.thumbnail_url || 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80';
          html +=
            '<div class="portfolio-item reveal">' +
              '<div class="portfolio-item__media">' +
                '<img src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(p.couple_names || p.title) + '" loading="lazy" />' +
              '</div>' +
              '<div class="portfolio-item__info">' +
                '<h3 class="portfolio-item__names">' + escapeHtml(p.couple_names || p.title) + '</h3>' +
                '<p class="portfolio-item__location">' + escapeHtml(p.location || '') + '</p>' +
                '<p class="portfolio-item__desc">' + escapeHtml(p.description || p.about_text || '') + '</p>' +
              '</div>' +
            '</div>';
        });
        portfolioGrid.innerHTML = html;
      }
    }

    // Update featured films page (featured-films.html)
    var featuredContainer = document.querySelector('[data-cms="featured-films"]');
    if (featuredContainer) {
      var featured = projects.filter(function (p) { return p.is_featured == 1 && p.is_published == 1; });
      if (featured.length > 0) {
        var html = '';
        featured.forEach(function (p, i) {
          var heroImg = p.thumbnail_url || 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80';
          var heroVideo = '';
          if (p.slots && p.slots.hero_video && p.slots.hero_video[0]) {
            heroVideo = p.slots.hero_video[0].url || '';
          }

          html += '<section class="featured-film" id="featured-films-' + p.id + '">';

          // Hero
          html += '<div class="featured-film__hero"><div class="featured-film__hero-bg">';
          if (heroVideo) {
            html += '<video src="' + escapeHtml(heroVideo) + '" autoplay muted loop playsinline preload="metadata"></video>';
          } else {
            html += '<img src="' + escapeHtml(heroImg) + '" alt="' + escapeHtml(p.couple_names) + '" />';
          }
          html += '</div><div class="featured-film__hero-overlay"></div>';
          html += '<div class="featured-film__hero-content">';
          html += '<h2 class="featured-film__names">' + escapeHtml(p.couple_names || p.title) + '</h2>';
          html += '<p class="featured-film__location">' + escapeHtml(p.location || '') + '</p>';
          html += '</div></div>';

          // Details
          if (p.about_text) {
            html += '<div class="featured-film__details reveal"><div class="featured-film__details-inner">';
            html += '<p class="featured-film__about-label">' + escapeHtml(p.about_title || 'Sobre o Casamento') + '</p>';
            html += '<p class="featured-film__about-text">' + escapeHtml(p.about_text) + '</p>';
            if (p.featured_on) {
              html += '<p class="featured-film__vendors-label">Publicado em</p>';
              html += '<div class="featured-film__vendors"><p>' + escapeHtml(p.featured_on) + '</p></div>';
            }
            html += '</div></div>';
          }

          // Testimonials
          if (p.testimonials && p.testimonials.length > 0) {
            var t = p.testimonials[0];
            html += '<div class="featured-film__testimonial reveal"><div class="featured-film__testimonial-inner">';
            html += '<p class="featured-film__testimonial-quote">"' + escapeHtml(t.content || t.quote || '') + '"</p>';
            html += '<p class="featured-film__testimonial-author">' + escapeHtml(t.client_name || t.author || '') + '</p>';
            html += '</div></div>';
          }

          // Video embed
          if (p.video_url) {
            var videoId = extractVideoId(p.video_url);
            if (videoId) {
              html += '<section class="film-video-section reveal"><div class="film-video-section__inner">';
              html += '<p class="film-video-section__label">Assista ao Filme</p>';
              html += '<h3 class="film-video-section__title">' + escapeHtml(p.couple_names || p.title) + '</h3>';
              html += '<div class="video-embed">';
              html += '<iframe src="https://www.youtube.com/embed/' + videoId + '" title="' + escapeHtml(p.couple_names) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
              html += '</div></div></section>';
            }
          }

          // Gallery
          if (p.slots) {
            var gallerySlots = [];
            for (var k = 1; k <= 8; k++) {
              var gSlot = p.slots['gallery_' + k];
              if (gSlot && gSlot[0] && gSlot[0].url) gallerySlots.push(gSlot[0].url);
            }
            if (gallerySlots.length > 0) {
              html += '<div class="featured-film__gallery">';
              gallerySlots.forEach(function (url) {
                html += '<img src="' + escapeHtml(url) + '" alt="" loading="lazy" />';
              });
              html += '</div>';
            }
          }

          html += '</section>';
        });
        featuredContainer.innerHTML = html;
      }
    }
  }

  function extractVideoId(url) {
    if (!url) return null;
    var match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/);
    return match ? match[1] : null;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- Init ---------- */
  function init() {
    // Don't run on admin page
    if (window.location.pathname.indexOf('/admin') === 0) return;

    // Load settings
    var cachedSettings = getCache(SETTINGS_CACHE_KEY);
    if (cachedSettings) {
      applySettings(cachedSettings);
    }
    fetchJSON('/settings').then(function (data) {
      if (data) {
        setCache(SETTINGS_CACHE_KEY, data);
        applySettings(data);
      }
    });

    // Load projects (only on pages that need them)
    var needsProjects = document.querySelector('.films-grid__items, .portfolio-grid__inner, [data-cms="featured-films"]');
    if (needsProjects) {
      var cachedProjects = getCache(PROJECTS_CACHE_KEY);
      if (cachedProjects) {
        applyProjects(cachedProjects);
      }
      fetchJSON('/projects?per_page=50').then(function (data) {
        if (data) {
          setCache(PROJECTS_CACHE_KEY, data);
          applyProjects(data);
        }
      });
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
