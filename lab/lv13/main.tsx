// /lab/lv13/ — standalone Contact-page concept. Fully isolated: no shared
// site CSS/JS imported, nothing here is reachable from any other route.
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// The custom cursor, the nav's scroll-tied closing-in animation, the
// drag-to-spin wheel and the click->Flip handoff are all genuinely
// desktop/fine-pointer interactions — same "skip outright rather than
// adapt" convention the rest of the site already uses for this class of
// effect (projects-rows.ts, projects-cursor-trail.ts, ShapeBlur's
// coarsePointer checks). Reduced-motion gets the same static fallback:
// none of this is essential content, all of it is motion.
const skipAdvanced = coarsePointer || reduceMotion;

/* ============================================================
   CUSTOM CURSOR
   ============================================================ */
let cursorEl: HTMLElement | null = null;
if (!skipAdvanced) {
  const cursor = document.getElementById('lv13-cursor');
  const label = cursor?.querySelector<HTMLElement>('.lv13-cursor__label');

  if (cursor) {
    cursorEl = cursor;
    gsap.set(cursor, { xPercent: -50, yPercent: -50, x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const quickX = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3.out' });
    const quickY = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3.out' });

    window.addEventListener('mousemove', e => {
      quickX(e.clientX);
      quickY(e.clientY);
    });

    document.querySelectorAll<HTMLElement>('[data-cursor-label]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('is-hover');
        if (label) label.textContent = el.dataset.cursorLabel ?? '';
      });
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });
  }
}

/* ============================================================
   NAV — progressive scroll-tied "closing in", not a two-state snap.
   Method: a plain rAF-throttled scroll listener computes progress
   (0-1 over a fixed px threshold) and, every frame, interpolates the
   brand's `left` and the tabs' `right`-as-`left` pixel positions
   between their measured "wide" (edge-padded) and "shrunk" (merged,
   centered) targets — a direct lerp, not a CSS-transitioned class swap,
   so the two groups visibly track scroll position as they close the
   gap. A separate pill-background element is sized every frame from
   the two groups' own live getBoundingClientRect() (not hardcoded),
   so it always wraps them exactly, and fades in via the same progress
   value. Only once progress reaches ~1 does .is-shrunk get added (purely
   to collapse the brand name via its own CSS max-width transition —
   everything else is already fully interpolated by then).
   ============================================================ */
if (!skipAdvanced) {
  const nav = document.getElementById('lv13-nav');
  const brand = document.getElementById('lv13-nav-brand');
  const tabs = document.getElementById('lv13-nav-tabs');
  const pillbg = document.getElementById('lv13-nav-pillbg');

  if (nav && brand && tabs && pillbg) {
    const EDGE = 56;
    const TOP_WIDE = 40;
    const TOP_SHRUNK = 16;
    const MERGE_GAP = 26; // gap between brand and tabs once merged into the pill
    const PILL_PAD_X = 20;
    const PILL_PAD_Y = 10;
    const THRESHOLD = 280; // px of scroll over which the whole close-in plays out

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    let ticking = false;

    function updateNav() {
      ticking = false;
      const progress = Math.max(0, Math.min(1, window.scrollY / THRESHOLD));
      const vw = window.innerWidth;

      const brandWidth = brand!.offsetWidth;
      const tabsWidth = tabs!.offsetWidth;

      const wideLeft = EDGE;
      const wideTabsLeft = vw - EDGE - tabsWidth;

      const shrunkTotal = brandWidth + MERGE_GAP + tabsWidth;
      const shrunkLeft = (vw - shrunkTotal) / 2;
      const shrunkTabsLeft = shrunkLeft + brandWidth + MERGE_GAP;

      const top = lerp(TOP_WIDE, TOP_SHRUNK, progress);
      const brandLeft = lerp(wideLeft, shrunkLeft, progress);
      const tabsLeft = lerp(wideTabsLeft, shrunkTabsLeft, progress);

      brand!.style.top = `${top}px`;
      brand!.style.left = `${brandLeft}px`;
      tabs!.style.top = `${top}px`;
      tabs!.style.left = `${tabsLeft}px`;
      tabs!.style.right = 'auto';

      nav!.classList.toggle('is-shrunk', progress > 0.85);

      const br = brand!.getBoundingClientRect();
      const tr = tabs!.getBoundingClientRect();
      const left = Math.min(br.left, tr.left) - PILL_PAD_X;
      const right = Math.max(br.right, tr.right) + PILL_PAD_X;
      const t = Math.min(br.top, tr.top) - PILL_PAD_Y;
      const bttm = Math.max(br.bottom, tr.bottom) + PILL_PAD_Y;
      pillbg!.style.left = `${left}px`;
      pillbg!.style.top = `${t}px`;
      pillbg!.style.width = `${right - left}px`;
      pillbg!.style.height = `${bttm - t}px`;
      pillbg!.style.opacity = String(progress);
    }

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateNav);
        }
      },
      { passive: true }
    );
    window.addEventListener('resize', updateNav);
    updateNav();
  }
}

/* ============================================================
   SECTION 2 — scroll-lit copy panel (unchanged mechanism, now just
   playing across more/longer lines — see lv13.css for the width change).
   ============================================================ */
if (!skipAdvanced) {
  // Only load ScrollTrigger for this — the drag-based wheel below no
  // longer needs it at all now that the scroll-jack is gone.
  void import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
    gsap.registerPlugin(ScrollTrigger);

    const lines = gsap.utils.toArray<HTMLElement>('.lv13-copy__line');
    const cta = document.getElementById('lv13-copy-cta');

    if (lines.length) {
      gsap.timeline({
        scrollTrigger: { trigger: '#lv13-copy', start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
      }).to(lines, { color: '#EDEAE3', stagger: 0.22, ease: 'none' });
    }
    if (cta) {
      gsap.to(cta, {
        color: '#EDEAE3',
        ease: 'none',
        scrollTrigger: { trigger: cta, start: 'top 88%', end: 'top 55%', scrub: 0.6 },
      });
    }
  });
} else {
  // Static fallback: fully lit, no scroll-linked motion.
  document.querySelectorAll<HTMLElement>('.lv13-copy__line, .lv13-copy__cta').forEach(el => {
    el.style.color = '#EDEAE3';
  });
}

/* ============================================================
   SECTION 3 — drag-to-spin curved card wheel + click-gated Section 4
   ============================================================ */
interface CardCopy {
  title: string;
  text: string;
}
const CARD_COPY: CardCopy[] = [
  {
    title: 'Portfolio',
    text: "A quiet, confident showcase built entirely around the work itself — a fast-loading gallery, a case-study layout that actually gets read, and just enough motion to feel considered instead of noisy. Good for designers, developers, photographers and anyone whose best pitch is simply “look at this.”",
  },
  {
    title: 'E-Commerce',
    text: 'Product pages that load instantly and a checkout that gets out of the way — built on the idea that every extra second between "want it" and "bought it" is a customer you didn’t need to lose.',
  },
  {
    title: 'SaaS Landing',
    text: 'One clear promise, one clear action. A landing page built to answer "what is this and why should I care" in the first five seconds, then get out of the way and let the call-to-action do its job.',
  },
  {
    title: 'Personal Brand',
    text: "A site that reads like you wrote it, not a template you filled in. Considered typography, a structure that's easy to keep updated, and just enough personality to be memorable.",
  },
  {
    title: 'Restaurant & Local',
    text: "Menu, hours, location and booking, front and centre — the handful of things people actually open a local business's site to find, presented so they don't have to hunt for them.",
  },
];

if (!skipAdvanced) {
  const stage = document.getElementById('lv13-wheel-stage');
  const track = document.getElementById('lv13-wheel-track');
  const photoSlot = document.getElementById('lv13-detail-photo-slot');
  const detailWrap = document.getElementById('lv13-detail-wrap');
  const detailEyebrow = document.getElementById('lv13-detail-eyebrow');
  const detailText = document.getElementById('lv13-detail-text');

  if (stage && track && photoSlot && detailWrap) {
    const trackEl = track;
    const photoSlotEl = photoSlot;
    const detailWrapEl = detailWrap;

    const cards = gsap.utils.toArray<HTMLElement>('.lv13-card', trackEl);
    const N = cards.length;

    const SPACING = 300;
    const MAX_ANGLE = 46;
    const ANGLE_PER_STEP = 26;
    const SCALE_FALLOFF = 0.12;
    const OPACITY_FALLOFF = 0.28;
    const Z_STEP = 90;
    const DRAG_PX_PER_CARD = 220;
    const CLICK_MOVE_THRESHOLD = 6; // px — below this, a pointerup is treated as a click, not a drag release

    let centerFloat = 0;
    let openIndex: number | null = null;
    let detailAnimating = false;
    let momentumTween: gsap.core.Tween | null = null;

    function clamp(v: number) {
      return Math.max(0, Math.min(N - 1, v));
    }

    function updateWheel(center: number) {
      cards.forEach((card, i) => {
        if (openIndex === i) return; // this one's docked in Section 4 right now — leave it alone
        const delta = i - center;
        const abs = Math.abs(delta);
        const x = delta * SPACING;
        const z = -abs * Z_STEP;
        const rotateY = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, delta * ANGLE_PER_STEP));
        const scale = Math.max(0.55, 1 - abs * SCALE_FALLOFF);
        const opacity = Math.max(0.12, 1 - abs * OPACITY_FALLOFF);
        card.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${rotateY}deg) scale(${scale})`;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(1000 - Math.round(abs * 10));
      });
    }

    function updateDetailCopy(index: number) {
      const c = CARD_COPY[index];
      if (!c) return;
      if (detailEyebrow) detailEyebrow.textContent = c.title;
      if (detailText) detailText.textContent = c.text;
    }

    function fadeCardText(card: HTMLElement, toVisible: boolean, delay = 0) {
      gsap.to(card.querySelectorAll<HTMLElement>('.lv13-card__title, .lv13-card__desc'), {
        opacity: toVisible ? 1 : 0,
        duration: toVisible ? 0.4 : 0.3,
        delay,
        ease: 'power1.out',
      });
    }

    function openDetail(index: number) {
      if (detailAnimating) return;
      detailAnimating = true;
      const isSwap = openIndex !== null && openIndex !== index;
      const prevIndex = openIndex;
      openIndex = index;

      updateDetailCopy(index);
      cards[index].classList.add('is-active');
      if (prevIndex !== null) cards[prevIndex].classList.remove('is-active');

      const card = cards[index];
      const state = Flip.getState(card, { props: 'borderRadius' });
      photoSlotEl.appendChild(card);
      card.classList.add('lv13-card--docked');
      fadeCardText(card, false);
      Flip.from(state, { duration: 0.9, ease: 'power3.inOut', absolute: true, scale: true });

      if (isSwap && prevIndex !== null) {
        const prevCard = cards[prevIndex];
        const prevState = Flip.getState(prevCard);
        trackEl.appendChild(prevCard);
        prevCard.classList.remove('lv13-card--docked');
        Flip.from(prevState, { duration: 0.7, ease: 'power3.inOut', absolute: true, scale: true });
        fadeCardText(prevCard, true, 0.15);
        updateWheel(centerFloat);
      }

      const target = detailWrapEl.scrollHeight || detailWrapEl.getBoundingClientRect().height;
      gsap.to(detailWrapEl, {
        height: target,
        duration: isSwap ? 0.5 : 0.85,
        ease: 'power3.inOut',
        onComplete: () => {
          detailAnimating = false;
          detailWrapEl.style.height = 'auto';
        },
      });
    }

    function closeDetail() {
      if (detailAnimating || openIndex === null) return;
      detailAnimating = true;
      const idx = openIndex;
      openIndex = null;
      const card = cards[idx];
      card.classList.remove('is-active');

      const state = Flip.getState(card, { props: 'borderRadius' });
      trackEl.appendChild(card);
      card.classList.remove('lv13-card--docked');
      Flip.from(state, { duration: 0.8, ease: 'power3.inOut', absolute: true, scale: true });
      fadeCardText(card, true, 0.15);
      updateWheel(centerFloat);

      gsap.to(detailWrapEl, {
        height: 0,
        duration: 0.7,
        ease: 'power3.inOut',
        onComplete: () => {
          detailAnimating = false;
        },
      });
    }

    // ---- drag-to-spin ----
    let dragging = false;
    let dragStartX = 0;
    let dragStartCenter = 0;
    let dragMoved = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // px/ms
    // Resolved at pointerDOWN, not read from the pointerup event's own
    // `e.target` — once stage.setPointerCapture() runs below, EVERY
    // subsequent pointer event for that pointerId reports its target as
    // the capturing element (the stage itself), not whatever's visually
    // under the cursor, so a card lookup on pointerup's own target always
    // came back empty.
    let downCard: HTMLElement | null = null;

    stage.addEventListener('pointerdown', e => {
      dragging = true;
      dragMoved = 0;
      downCard = (e.target as HTMLElement)?.closest<HTMLElement>('.lv13-card') ?? null;
      dragStartX = e.clientX;
      dragStartCenter = centerFloat;
      lastX = e.clientX;
      lastT = performance.now();
      velocity = 0;
      momentumTween?.kill();
      stage.setPointerCapture(e.pointerId);
      cursorEl?.classList.add('is-drag');
    });

    stage.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      dragMoved = Math.max(dragMoved, Math.abs(dx));
      centerFloat = clamp(dragStartCenter - dx / DRAG_PX_PER_CARD);
      updateWheel(centerFloat);

      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) velocity = (e.clientX - lastX) / dt;
      lastX = e.clientX;
      lastT = now;
    });

    function endDrag(e: PointerEvent) {
      if (!dragging) return;
      dragging = false;
      cursorEl?.classList.remove('is-drag');

      if (dragMoved < CLICK_MOVE_THRESHOLD) {
        if (downCard) {
          const idx = Number(downCard.dataset.index);
          if (openIndex === idx) closeDetail();
          else openDetail(idx);
        }
        return;
      }

      // Momentum: project a bit more travel from release velocity, then
      // coast to a stop — a quick GSAP tween over the (virtual) centerFloat
      // value reads as inertia without hand-rolling a decay loop.
      const projected = velocity * 260; // px of "extra" travel implied by release speed
      const target = clamp(centerFloat - projected / DRAG_PX_PER_CARD);
      const proxy = { v: centerFloat };
      momentumTween = gsap.to(proxy, {
        v: target,
        duration: 0.9,
        ease: 'power3.out',
        onUpdate: () => {
          centerFloat = proxy.v;
          updateWheel(centerFloat);
        },
      });
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // Once a card is docked it's re-parented OUT of #lv13-wheel-stage (into
    // #lv13-detail-photo-slot), so the stage's own pointerdown/pointerup
    // pair — which resolves the clicked card from the pointerDOWN target,
    // see downCard above — never sees clicks on it at all. A plain click
    // listener scoped to the slot itself (no drag to disambiguate here,
    // the docked image doesn't move) is what lets clicking it again close
    // Section 4.
    photoSlotEl.addEventListener('click', () => {
      if (openIndex !== null) closeDetail();
    });

    updateWheel(0);
  }
} else {
  // Static/reduced-motion fallback: no drag, no Flip — Section 4 simply
  // never appears (nothing wires a click handler), matching "no card
  // clicked -> no Section 4" on the path where clicking isn't the
  // available interaction anyway (touch already gets tap-to-follow-link
  // affordances elsewhere on the site; this page has no link per card).
  const photoSlot = document.getElementById('lv13-detail-photo-slot');
  if (photoSlot) photoSlot.style.background = 'linear-gradient(150deg, #1c2b4a 0%, #0d1524 100%)';
}
