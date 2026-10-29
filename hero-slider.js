// Ogbomọ́ — hero background slideshow.
// Add photos to images/hero/ and list them below. Slides that fail to load are skipped;
// if none load, the hero keeps its original plain look.
(function () {
  var SLIDES = [
    'https://res.cloudinary.com/dkkiuteyj/image/upload/v1793263343/slide-1_yv7mag.jpg',
    'https://res.cloudinary.com/dkkiuteyj/image/upload/v1793263343/slide-2_fbh5zp.jpg',
    'https://res.cloudinary.com/dkkiuteyj/image/upload/v1793263343/slide-3_fuzu1a.jpg',
    'https://res.cloudinary.com/dkkiuteyj/image/upload/v1793263343/slide-4_ea82gr.jpg',
    'https://res.cloudinary.com/dkkiuteyj/image/upload/v1793263343/slide-5_lms6sb.jpg'
  ];
  var INTERVAL = 6500;
  var hero = document.getElementById('hero');
  var wrap = document.getElementById('hero-slides');
  var controls = document.getElementById('hero-controls');
  if (!hero || !wrap || !controls) return;

  var loaded = [], pending = SLIDES.length;

  SLIDES.forEach(function (src, i) {
    var img = new Image();
    img.onload = function () { loaded[i] = src; done(); };
    img.onerror = function () { done(); };
    img.src = src;
  });

  function done() { if (--pending === 0) start(loaded.filter(Boolean)); }

  function start(list) {
    if (!list.length) return;
    var slides = list.map(function (src) {
      var d = document.createElement('div');
      d.className = 'hero-slide';
      d.style.backgroundImage = 'url("' + src + '")';
      wrap.appendChild(d);
      return d;
    });
    hero.classList.add('has-slides');
    var cur = 0, timer = null;
    var dots = [];

    function show(n) {
      slides[cur].classList.remove('is-active');
      dots[cur] && dots[cur].removeAttribute('aria-current');
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add('is-active');
      dots[cur] && dots[cur].setAttribute('aria-current', 'true');
    }
    function play() { stop(); if (slides.length > 1) timer = setInterval(function () { show(cur + 1); }, INTERVAL); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    if (slides.length > 1) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'hero-dot';
        b.setAttribute('aria-label', 'Show photo ' + (i + 1));
        b.addEventListener('click', function () { show(i); play(); });
        controls.appendChild(b); dots.push(b);
      });
    }
    slides[0].classList.add('is-active');
    dots[0] && dots[0].setAttribute('aria-current', 'true');
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });
    play();
  }
})();
