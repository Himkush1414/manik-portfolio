/* ============================================================
   Manik Rana — hero interactions
   ============================================================ */

(function () {
  "use strict";

  /* ---- Smooth scroll for in-page anchors ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ---- Sign-up form: no-op submit (wire to a real endpoint later) ---- */
  var form = document.querySelector(".signup__form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector(".signup__input");
      if (input && input.value.trim()) {
        input.value = "";
        input.setAttribute("placeholder", "Thanks — I'll be in touch.");
        setTimeout(function () {
          input.setAttribute("placeholder", "Enter your email");
        }, 2600);
      }
    });
  }

  /* ---- Cursor-follow reveal on the watermark ----
     Two layers move together with the pointer:
       1. an SVG dashed-contour stroke, revealed through a radial mask
       2. a blurred radial glow in the background behind the letters       */
  var hero = document.getElementById("top");
  var wrap = document.getElementById("watermark");
  var svg = wrap && wrap.querySelector(".watermark__svg");
  var spot = document.getElementById("spot");
  var strokeLayer = document.getElementById("strokeLayer");
  var glow = document.getElementById("cursorGlow");
  if (!hero || !svg || !spot || !strokeLayer || !glow) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var target = { x: -9999, y: -9999 };   // latest pointer, client coords
  var eased = { x: -9999, y: -9999 };    // rendered position, client coords
  var active = false;                     // pointer within the reveal band
  var running = false;

  function inBand(clientY) {
    var r = wrap.getBoundingClientRect();
    return clientY >= r.top - 150 && clientY <= r.bottom + 40;
  }

  function onMove(e) {
    if (e.pointerType === "touch") return;
    target.x = e.clientX;
    target.y = e.clientY;

    var band = inBand(e.clientY);
    if (band && !active) {
      active = true;
      eased.x = target.x;             // jump in, don't sweep from origin
      eased.y = target.y;
      strokeLayer.classList.add("is-active");
      glow.classList.add("is-active");
    } else if (!band && active) {
      active = false;
      strokeLayer.classList.remove("is-active");
      glow.classList.remove("is-active");
    }
    start();
  }

  function onLeave() {
    active = false;
    strokeLayer.classList.remove("is-active");
    glow.classList.remove("is-active");
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    var ease = reduceMotion ? 1 : 0.24;
    eased.x += (target.x - eased.x) * ease;
    eased.y += (target.y - eased.y) * ease;

    // background glow — position in hero-local pixels
    var hr = hero.getBoundingClientRect();
    glow.style.transform =
      "translate3d(" + (eased.x - hr.left) + "px," + (eased.y - hr.top) + "px,0)";

    // dashed-stroke spotlight — map client coords into SVG user space
    var ctm = svg.getScreenCTM();
    if (ctm) {
      var p = svg.createSVGPoint();
      p.x = eased.x;
      p.y = eased.y;
      p = p.matrixTransform(ctm.inverse());
      spot.setAttribute("cx", p.x.toFixed(1));
      spot.setAttribute("cy", p.y.toFixed(1));
    }

    var dx = target.x - eased.x;
    var dy = target.y - eased.y;
    if (dx * dx + dy * dy > 0.35) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  hero.addEventListener("pointermove", onMove, { passive: true });
  hero.addEventListener("pointerleave", onLeave);
})();
