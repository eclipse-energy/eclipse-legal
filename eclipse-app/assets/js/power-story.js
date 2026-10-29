(function () {
  "use strict";

  var article = document.getElementById("power-analytics");
  if (!article) return;
  var story = article.querySelector(".story");
  var stage = article.querySelector(".story-stage");
  var curve = article.querySelector(".curve");
  var steps = Array.prototype.slice.call(article.querySelectorAll(".story-step"));
  var screen = article.querySelector(".fan .phone--center .screen");
  if (!story || !stage || !curve || !steps.length || !screen) return;

  var mq = window.matchMedia("(min-width: 800px) and (prefers-reduced-motion: no-preference)");
  var scrub = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()"));
  var lang = document.documentElement.lang || "en";
  var fmt = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  var cursorEl = article.querySelector(".curve-cursor");
  var readout = article.querySelector("[data-readout]");
  var maxOut = article.querySelector("[data-max]");

  var kw = [];
  article.querySelectorAll(".curve-bars rect").forEach(function (r) {
    kw[parseInt(r.style.getPropertyValue("--i"), 10)] = parseFloat(r.getAttribute("data-kw"));
  });
  var n = kw.length;
  var peak = Math.max.apply(null, kw);
  var peakAt = kw.indexOf(peak);

  var spikeGroup = article.querySelector(".curve-bars .curve-spike");
  var keep = parseFloat(spikeGroup.getAttribute("data-keep"));
  var shifted = kw.slice();
  spikeGroup.querySelectorAll("rect").forEach(function (r) {
    var i = parseInt(r.style.getPropertyValue("--i"), 10);
    var base = parseFloat(r.getAttribute("data-base"));
    shifted[i] = base + (kw[i] - base) * keep;
  });
  article.querySelectorAll(".curve-shift rect").forEach(function (r) {
    var i = parseInt(r.getAttribute("data-i"), 10);
    shifted[i] += parseFloat(r.getAttribute("data-kw"));
  });
  var shiftedMax = Math.max.apply(null, shifted);
  stage.style.setProperty("--keep", keep);

  function time(i) {
    var m = i * 1440 / n;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }

  function offset(el, ancestor) {
    var x = 0, y = 0;
    while (el && el !== ancestor) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: x, y: y };
  }
  function measureDock() {
    story.style.setProperty("--stage-h", stage.offsetHeight + "px");
    var c = offset(curve, stage), s = offset(screen, stage);
    var scale = (screen.offsetWidth * 0.9) / curve.offsetWidth;
    var dx = s.x + screen.offsetWidth / 2 - (c.x + curve.offsetWidth / 2);
    var dy = s.y + screen.offsetHeight * 0.55 - (c.y + curve.offsetHeight / 2);
    stage.style.setProperty("--dock-x", dx.toFixed(1) + "px");
    stage.style.setProperty("--dock-y", dy.toFixed(1) + "px");
    stage.style.setProperty("--dock-s", scale.toFixed(3));
  }

  var STATES = ["is-cursor", "is-hot", "is-max", "is-shift", "is-dock"];
  var lastStep = -1, lastMax = -1, ticking = false;

  function position() {
    var r = steps[0].getBoundingClientRect();
    return (window.innerHeight / 2 - r.top) / r.height;
  }

  function update() {
    ticking = false;
    var g = position();
    var step = g < 0 ? 0 : Math.min(steps.length, Math.floor(g) + 1);

    var cursor = g <= -.35 ? 0 : g < .5 ? (g + .35) / .85 * n : n;
    cursor = Math.max(0, Math.min(n, cursor));
    stage.style.setProperty("--cursor", cursor.toFixed(2));
    var at = Math.min(n - 1, Math.floor(cursor));
    readout.textContent = time(at) + " · " + fmt.format(kw[at]) + " kW";
    cursorEl.classList.toggle("is-flip", cursor > n * .78);
    cursorEl.style.setProperty("--ro-kw", kw[at]);
    var peakShown = step === 1 && cursor > peakAt + 1;
    article.classList.toggle("is-peak", peakShown);
    cursorEl.classList.toggle("is-near", peakShown && Math.abs(at - peakAt) <= 4);

    var max;
    if (step <= 1) max = Math.max.apply(null, kw.slice(0, Math.max(1, Math.ceil(cursor))));
    else if (step === 2 && g - 1 < .45) max = peak;
    else max = shiftedMax;
    if (max !== lastMax) {
      lastMax = max;
      stage.style.setProperty("--max-kw", max);
      maxOut.textContent = fmt.format(max) + " kW";
    }
    article.classList.toggle("is-shifted", step >= 2 && max === shiftedMax);

    if (step !== lastStep) {
      lastStep = step;
      article.setAttribute("data-step", step);
      steps.forEach(function (s, k) { s.classList.toggle("is-active", k === step - 1); });
      var on = {
        "is-cursor": step === 1,
        "is-hot": step >= 1,
        "is-max": step >= 1 && step <= 2,
        "is-shift": step >= 2,
        "is-dock": step >= 3
      };
      STATES.forEach(function (c) { article.classList.toggle(c, !!on[c]); });
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function enable() {
    article.classList.add("is-story");
    article.classList.toggle("is-scrub", scrub);
    measureDock();
    lastStep = -1; lastMax = -1;
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
  }
  function disable() {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    article.classList.remove("is-story", "is-scrub");
    STATES.concat("is-peak", "is-shifted").forEach(function (c) { article.classList.remove(c); });
    article.removeAttribute("data-step");
    steps.forEach(function (s) { s.classList.remove("is-active"); });
    ["--cursor", "--max-kw", "--dock-x", "--dock-y", "--dock-s"].forEach(function (p) { stage.style.removeProperty(p); });
    story.style.removeProperty("--stage-h");
  }
  function onResize() { measureDock(); onScroll(); }

  function apply() { if (mq.matches) enable(); else disable(); }
  if (mq.addEventListener) mq.addEventListener("change", apply); else mq.addListener(apply);
  apply();
})();
