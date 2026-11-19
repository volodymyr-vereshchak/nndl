// Место чтения и закладки. Хранятся в localStorage этого браузера.
(function () {
  "use strict";
  var KEY_LAST = "nndl-ru:last", KEY_BM = "nndl-ru:bookmarks";
  var page = location.pathname.split("/").pop() || "index.html";
  var isChapter = /^part\d+\.html$/.test(page);

  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var blocks = [];
  function collect() {
    blocks = Array.prototype.slice.call(document.querySelectorAll(
      "article h1, article h2, article h3, article h4, article p, article pre, article li, article figure, article .math.display, article img"));
  }
  function chapterTitle() {
    var h = document.querySelector("article h1");
    return h ? h.textContent.trim() : document.title;
  }
  // первый блок, видимый в верхней части экрана
  function currentIndex() {
    for (var i = 0; i < blocks.length; i++) {
      var r = blocks[i].getBoundingClientRect();
      if (r.bottom > 60 && r.height > 0) return i;
    }
    return 0;
  }
  function sectionFor(i) {
    for (var j = i; j >= 0; j--) if (/^H[23]$/.test(blocks[j].tagName)) return blocks[j].textContent.trim();
    return "";
  }
  function snippet(i) {
    for (var j = i; j < blocks.length && j < i + 5; j++) {
      var t = blocks[j].textContent.replace(/\s+/g, " ").trim();
      if (t.length > 20 && !/^H/.test(blocks[j].tagName)) return t.slice(0, 90) + (t.length > 90 ? "…" : "");
    }
    return "";
  }
  function progress() {
    var h = document.documentElement.scrollHeight - innerHeight;
    return h > 0 ? Math.round(100 * scrollY / h) : 0;
  }
  function position() {
    var i = currentIndex(), el = blocks[i], f = 0;
    if (el) { var r = el.getBoundingClientRect(); f = r.height > 0 ? Math.max(0, (60 - r.top) / r.height) : 0; }
    return { page: page, pos: i, f: Math.round(f * 1000) / 1000, chapter: chapterTitle(), section: sectionFor(i),
             text: snippet(i), pct: progress(), t: Date.now() };
  }
  function goTo(i, f) {
    var el = blocks[Math.min(i, blocks.length - 1)];
    if (!el) return;
    var r = el.getBoundingClientRect();
    scrollTo(0, scrollY + r.top + (f || 0) * r.height - 60);
    if (!f) flash(el);
  }
  function flash(el) {
    el.classList.add("bm-flash");
    setTimeout(function () { el.classList.remove("bm-flash"); }, 1800);
  }
  function href(p) { return p.page + "#pos=" + p.pos + (p.f ? "," + p.f : ""); }
  function label(p) { return (p.section && p.section !== p.chapter ? p.chapter + " → " + p.section : p.chapter); }

  // ---------- интерфейс ----------
  var panel;
  function renderPanel() {
    if (!panel) return;
    var last = load(KEY_LAST, null), bms = load(KEY_BM, []);
    var h = "";
    if (last && !(isChapter && last.page === page)) {
      h += '<a class="bm-continue" href="' + esc(href(last)) + '">↪ Продолжить чтение<small>' +
           esc(label(last)) + " · " + last.pct + "%</small></a>";
    }
    h += '<div class="bm-head">Закладки' + (isChapter ? ' <button class="bm-add" title="Добавить закладку на текущее место">+ добавить</button>' : "") + "</div>";
    if (!bms.length) h += '<div class="bm-empty">' + (isChapter ? "Нажмите «+ добавить» или 🔖 внизу справа." : "Закладок пока нет.") + "</div>";
    h += "<ul>";
    bms.forEach(function (b, k) {
      h += '<li><a href="' + esc(href(b)) + '" title="' + esc(b.text) + '">' + esc(label(b)) +
           "<small>" + esc(b.text) + "</small></a>" +
           '<button class="bm-del" data-k="' + k + '" title="Удалить">×</button></li>';
    });
    panel.innerHTML = h + "</ul>";
  }
  function addBookmark() {
    var p = position(), bms = load(KEY_BM, []);
    bms.unshift(p);
    save(KEY_BM, bms.slice(0, 100));
    renderPanel();
    toast("Закладка добавлена");
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "bm-toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  function init() {
    collect();
    var side = document.querySelector(".sidebar");
    if (side) {
      panel = document.createElement("div");
      panel.className = "bm-panel";
      side.insertBefore(panel, side.querySelector(".toc"));
      panel.addEventListener("click", function (e) {
        var t = e.target;
        if (t.classList.contains("bm-add")) addBookmark();
        if (t.classList.contains("bm-del")) {
          var bms = load(KEY_BM, []); bms.splice(+t.dataset.k, 1); save(KEY_BM, bms); renderPanel();
        }
      });
    }
    if (isChapter) {
      var fab = document.createElement("button");
      fab.className = "bm-fab"; fab.title = "Закладка на этом месте"; fab.textContent = "🔖";
      fab.addEventListener("click", addBookmark);
      document.body.appendChild(fab);
    }
    renderPanel();

    // обложка: заметная кнопка «Продолжить»
    var cover = document.querySelector(".cover"), last = load(KEY_LAST, null);
    if (cover && last) {
      var a = document.createElement("a");
      a.className = "bm-cover"; a.href = href(last);
      a.innerHTML = "↪ Продолжить чтение: " + esc(label(last)) + " (" + last.pct + "%)";
      cover.appendChild(a);
    }
    if (!isChapter) return;

    // переход к позиции
    var m = location.hash.match(/^#pos=(\d+)(?:,([\d.]+))?$/);
    if (m) goTo(+m[1], +(m[2] || 0));
    else if (!location.hash && last && last.page === page && history.scrollRestoration !== undefined &&
             performance.getEntriesByType && (performance.getEntriesByType("navigation")[0] || {}).type !== "reload") {
      goTo(last.pos, last.f);
    }
    // автосохранение места чтения
    var timer;
    addEventListener("scroll", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { save(KEY_LAST, position()); }, 400);
    }, { passive: true });
    addEventListener("pagehide", function () { save(KEY_LAST, position()); });
    addEventListener("hashchange", function () {
      var m = location.hash.match(/^#pos=(\d+)(?:,([\d.]+))?$/); if (m) goTo(+m[1], +(m[2] || 0));
    });
  }

  // ждём MathJax: формулы меняют высоту страницы
  function start() {
    var mj = window.MathJax && MathJax.startup && MathJax.startup.promise;
    if (mj) mj.then(init, init); else init();
  }
  if (document.readyState === "complete") start();
  else addEventListener("load", start);
})();
