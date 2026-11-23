// Ogbomọ́ — hero background slideshow (works on any page).
// Add data-slides="images/about/slide-1.jpg,images/about/slide-2.jpg" to a
// <section class="hero">. Photos that fail to load are skipped; if none load,
// the hero keeps its plain look. Each hero on a page runs its own slideshow.
(function () {
  var INTERVAL = 6500;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(hero) {
    var list = (hero.getAttribute('data-slides') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!list.length) return;
    var loaded = [], pending = list.length;
    list.forEach(function (src, i) {
      var img = new Image();
      img.onload = function () { loaded[i] = src; done(); };
      img.onerror = function () { done(); };
      img.src = src;
    });
    function done() { if (--pending === 0) start(loaded.filter(Boolean)); }

    function start(ok) {
      if (!ok.length) return;
      var wrap = document.createElement('div');
      wrap.className = 'hero-slides'; wrap.setAttribute('aria-hidden', 'true');
      var controls = document.createElement('div');
      controls.className = 'hero-controls'; controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Background photo slideshow');
      var slides = ok.map(function (src) {
        var d = document.createElement('div');
        d.className = 'hero-slide';
        d.style.backgroundImage = 'url("' + src + '")';
        wrap.appendChild(d);
        return d;
      });
      hero.insertBefore(wrap, hero.firstChild);
      hero.appendChild(controls);
      hero.classList.add('has-slides');

      var cur = 0, timer = null, paused = reduce, dots = [];
      function show(n) {
        slides[cur].classList.remove('is-active');
        if (dots[cur]) dots[cur].removeAttribute('aria-current');
        cur = (n + slides.length) % slides.length;
        slides[cur].classList.add('is-active');
        if (dots[cur]) dots[cur].setAttribute('aria-current', 'true');
      }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      function play() { stop(); if (!paused && slides.length > 1) timer = setInterval(function () { show(cur + 1); }, INTERVAL); }

      if (slides.length > 1) {
        slides.forEach(function (_, i) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'hero-dot';
          b.setAttribute('aria-label', 'Show photo ' + (i + 1));
          b.addEventListener('click', function () { show(i); play(); });
          controls.appendChild(b); dots.push(b);
        });
        var p = document.createElement('button');
        p.type = 'button'; p.className = 'hero-pause';
        p.textContent = paused ? 'Play' : 'Pause';
        p.setAttribute('aria-label', 'Pause or play the background slideshow');
        p.addEventListener('click', function () {
          paused = !paused; p.textContent = paused ? 'Play' : 'Pause'; if (paused) stop(); else play();
        });
        controls.appendChild(p);
      }
      slides[0].classList.add('is-active');
      if (dots[0]) dots[0].setAttribute('aria-current', 'true');
      document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
      play();
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('.hero[data-slides]'), setup);
})();
