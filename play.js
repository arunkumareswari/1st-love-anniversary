/* ================================================================
   play.js — Memory Discovery Card Game
   ================================================================
   Flow:
   1. 7 cards orbit face-down.
   2. User picks cards — 3 correct types to find: image, video, envelope.
   3. Correct card → flip reveal → show its panel (photos / videos / letter).
   4. Wrong card  → flip reveal → oops panel.
   5. After all 3 found → Surprise Card unlocks on the right side (face-down).
   6. Click Surprise Card → card flies to centre, flips open, 5-second wait,
      then fullscreen wish video plays.
   ================================================================ */

import gsap from 'gsap';

/* ── Clear stale localStorage so progress resets each visit ── */
localStorage.removeItem('birthday_discovered_memories');

/* ── DOM Refs ───────────────────────────────────────────────── */
const sceneOrbit        = document.getElementById('sceneOrbit');
const orbitSystem       = document.getElementById('orbitSystem');
const orbitCards        = document.querySelectorAll('.orbit-card');
const flash             = document.getElementById('flash');
const allPanels         = document.querySelectorAll('.content-panel');
const backBtns          = document.querySelectorAll('.back-btn');
const tryAgainBtn       = document.getElementById('tryAgainBtn');

/* Love Meter */
const trackerHearts = {
  image:    document.getElementById('heart1'),
  video:    document.getElementById('heart2'),
  envelope: document.getElementById('heart3'),
};
const surpriseToast       = document.getElementById('surpriseToast');
const unlockedSurpriseBtn = document.getElementById('unlockedSurpriseBtn');


/* Envelope */
const envelopeBody   = document.getElementById('envelopeBody');
const envelopeSeal   = document.getElementById('envelopeSeal');
const letterCard     = document.getElementById('letterCard');
const letterBody     = document.getElementById('letterBody');

/* Wrong */
const wrongBox       = document.getElementById('wrongBox');

/* Surprise sequence */
const surpriseBackdrop      = document.getElementById('surpriseBackdrop');
const surpriseCardClone     = document.getElementById('surpriseCardClone');
const surpriseCardCloneInner= document.getElementById('surpriseCardCloneInner');
const heartsCanvas          = document.getElementById('heartsCanvas');
const surpriseVideoOverlay  = document.getElementById('surpriseVideoOverlay');
const surpriseVideo         = document.getElementById('surpriseVideo');
const surpriseVideoClose    = document.getElementById('surpriseVideoClose');

/* ── State ──────────────────────────────────────────────────── */
let fired = false;
const discoveredTypes = new Set();
const TOTAL_CORRECT   = 3;


/* ── Load videos from /public/videos ──────────────────────── */
const VIDEO_ITEMS = [
  { src: '/videos/video (1).mp4', title: 'Happy 1st Anniversary', date: 'May 25, 2024', duration: '0:20', rotate: 0 },
  { src: '/videos/video (2).mp4', title: 'Our Special Day',        date: 'May 20, 2024', duration: '0:30', rotate: 0 },
  { src: '/videos/video (3).mp4', title: 'A Little Surprise',     date: 'May 18, 2024', duration: '0:18', rotate: 90 },
  { src: '/videos/video (4).mp4', title: 'For You, Always',       date: 'May 12, 2024', duration: '0:22', rotate: 90 },
  { src: '/videos/video (5).mp4', title: 'Precious Memories',     date: 'May 05, 2024', duration: '0:25', rotate: 0 },
];

function buildVideoPanel() {
  const grid = document.getElementById('videoList');
  if (!grid) return;
  grid.innerHTML = '';

  VIDEO_ITEMS.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'vid-card-item';

    const rotateClass = item.rotate === 90 ? 'is-rotated-90' : '';

    card.innerHTML = `
      <div class="vid-thumb-wrapper">
        <video src="${item.src}#t=0.5" preload="metadata" muted playsinline class="${rotateClass}"></video>
        <div class="vid-play-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#2c4e70">
            <polygon points="6,4 20,12 6,20"></polygon>
          </svg>
        </div>
        <span class="vid-duration-badge">${item.duration}</span>
      </div>
      <div class="vid-card-info">
        <div class="vid-card-text">
          <h4 class="vid-card-title">${item.title}</h4>
        </div>
        <button class="vid-heart-btn" type="button" aria-label="Favorite">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6c8eb5" stroke-width="2" class="heart-svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
          </svg>
        </button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      const heartBtn = e.target.closest('.vid-heart-btn');
      if (heartBtn) {
        heartBtn.classList.toggle('liked');
        const path = heartBtn.querySelector('path');
        if (heartBtn.classList.contains('liked')) {
          path.setAttribute('fill', '#ff4d79');
          path.setAttribute('stroke', '#ff4d79');
        } else {
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', '#6c8eb5');
        }
        return;
      }

      // Open video lightbox with rotated class & controls toggle
      const lb = document.getElementById('vidLightbox');
      const player = document.getElementById('vidLbPlayer');
      if (lb && player) {
        player.src = item.src;
        if (item.rotate === 90) {
          lb.classList.add('is-rotated-90');
          player.controls = false; // Hide native timer controls bar for rotated videos
        } else {
          lb.classList.remove('is-rotated-90');
          player.controls = true;  // Keep native timer controls for vertical videos
        }
        lb.classList.add('open');
        player.play().catch(() => {});
      }
    });

    grid.appendChild(card);
  });
}

/* ── Letter text ────────────────────────────────────────────── */
const LETTER_TEXT = `One year ago today, my world changed forever.

365 days of stolen glances, warm hugs, and a million little moments
that I will carry in my heart for the rest of my life.

Thank you for being my safe place, my greatest adventure,
and my favourite person all at once.

Here's to forever — one beautiful day at a time. 💕`;

/* ── Orbit pause / resume ─────────────────────────────────── */
function pauseOrbit() {
  if (orbitSystem) orbitSystem.style.animationPlayState = 'paused';
  orbitCards.forEach(c => c.style.animationPlayState = 'paused');
}

function resumeOrbit() {
  fired = false;
  if (orbitSystem) orbitSystem.style.animationPlayState = 'running';
  orbitCards.forEach(c => c.style.animationPlayState = 'running');
}

/* ── Panel helpers ────────────────────────────────────────── */
function showPanel(type) {
  allPanels.forEach(p => p.classList.remove('is-active'));
  const panel = document.getElementById('panel-' + type);
  if (panel) panel.classList.add('is-active');
}

function hideAllPanels() {
  allPanels.forEach(p => p.classList.remove('is-active'));
}

/* ── Burst Particle ───────────────────────────────────────── */
function spawnBurst(cx, cy) {
  const el = document.createElement('div');
  el.className = 'burst-effect';
  el.style.left = cx + 'px';
  el.style.top  = cy + 'px';
  el.style.marginLeft = '-15px';
  el.style.marginTop  = '-15px';
  document.body.appendChild(el);
  gsap.to(el, {
    scale: 8, opacity: 0, duration: 0.55,
    ease: 'power2.out',
    onComplete: () => el.remove(),
  });
}

/* ── Progress & Unlock Surprise ───────────────────────────── */
function updateGameProgress(type) {
  if (type && trackerHearts[type] && !discoveredTypes.has(type)) {
    discoveredTypes.add(type);
    const heart = trackerHearts[type];
    heart.textContent = '💖';
    heart.classList.add('active');
  }

  if (discoveredTypes.size >= TOTAL_CORRECT) {
    if (!unlockedSurpriseBtn.classList.contains('show')) {
      unlockedSurpriseBtn.classList.add('show');
      surpriseToast.classList.add('show');
      setTimeout(() => surpriseToast.classList.remove('show'), 4500);
    }
  }
}

/* ── Floating Hearts Canvas ───────────────────────────────── */
let heartsAnimId = null;

function startFloatingHearts() {
  heartsCanvas.width  = window.innerWidth;
  heartsCanvas.height = window.innerHeight;
  const ctx = heartsCanvas.getContext('2d');
  const symbols = ['💖','💗','💕','💓','✨','💛','🌸'];
  const hearts = Array.from({ length: 30 }, () => ({
    x:  Math.random() * heartsCanvas.width,
    y:  heartsCanvas.height + 60,
    size: Math.random() * 22 + 14,
    vy: -(Math.random() * 1.8 + 0.8),
    vx: (Math.random() - 0.5) * 1.2,
    alpha: Math.random() * 0.5 + 0.5,
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    delay: Math.random() * 120,
  }));
  function draw() {
    ctx.clearRect(0, 0, heartsCanvas.width, heartsCanvas.height);
    hearts.forEach(h => {
      if (h.delay > 0) { h.delay--; return; }
      h.y += h.vy; h.x += h.vx; h.alpha -= 0.003;
      if (h.y < -80 || h.alpha <= 0) {
        h.y = heartsCanvas.height + 60;
        h.x = Math.random() * heartsCanvas.width;
        h.alpha = Math.random() * 0.5 + 0.5;
        h.delay = Math.random() * 60;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, h.alpha);
      ctx.font = `${h.size}px serif`;
      ctx.fillText(h.symbol, h.x, h.y);
      ctx.restore();
    });
    heartsAnimId = requestAnimationFrame(draw);
  }
  draw();
}

function stopFloatingHearts() {
  if (heartsAnimId) { cancelAnimationFrame(heartsAnimId); heartsAnimId = null; }
}

/* ── Surprise Card Click → Fly, Flip, Wait 5s, Play Video ─── */
if (unlockedSurpriseBtn) {
  unlockedSurpriseBtn.addEventListener('click', () => {
    if (unlockedSurpriseBtn.dataset.played === 'true') return;
    unlockedSurpriseBtn.dataset.played = 'true';
    pauseOrbit();

    /* Step 1 — position clone exactly over the button */
    const btnRect = unlockedSurpriseBtn.getBoundingClientRect();
    gsap.set(surpriseCardClone, {
      left: btnRect.left,
      top:  btnRect.top,
      width:  btnRect.width,
      height: btnRect.height,
      opacity: 1,
    });
    gsap.set(unlockedSurpriseBtn, { opacity: 0 });

    /* Fade in dark romantic backdrop */
    surpriseBackdrop.classList.add('active');
    gsap.to(surpriseBackdrop, {
      opacity: 1, duration: 0.7, ease: 'power2.out',
      onUpdate() {
        const p = this.progress();
        surpriseBackdrop.style.backdropFilter = `blur(${p * 14}px)`;
        surpriseBackdrop.style.background =
          `radial-gradient(ellipse at 50% 50%, rgba(14,4,30,${0.88 * p}) 0%, rgba(5,2,18,${0.96 * p}) 100%)`;
      },
    });

    /* Start floating hearts */
    gsap.to(heartsCanvas, { opacity: 1, duration: 0.6, delay: 0.3 });
    startFloatingHearts();

    /* Step 2 — fly clone to screen centre */
    const cloneW = 190, cloneH = 266;
    const centerX = window.innerWidth  / 2 - cloneW / 2;
    const centerY = window.innerHeight / 2 - cloneH / 2;

    gsap.to(surpriseCardClone, {
      left: centerX, top: centerY,
      width: cloneW, height: cloneH,
      duration: 0.9, ease: 'power3.inOut',
      onComplete() {
        /* Step 3 — 3D flip (back → front) */
        gsap.to(surpriseCardCloneInner, {
          rotationY: 180,
          duration: 0.95,
          ease: 'power2.inOut',
          onComplete() {
            /* Step 4 — glow pop */
            gsap.to(surpriseCardClone, {
              scale: 1.12, duration: 0.4, ease: 'back.out(1.5)',
            });

            /* Step 5 — wait 3 seconds, then play the wish video fullscreen */
            setTimeout(() => {
              /* Fade out backdrop overlay, hearts, clone card */
              gsap.to([surpriseBackdrop, heartsCanvas, surpriseCardClone], {
                opacity: 0, duration: 0.55, ease: 'power2.in',
                onComplete() {
                  stopFloatingHearts();
                  surpriseBackdrop.classList.remove('active');

                  /* Show fullscreen video overlay */
                  surpriseVideoOverlay.classList.add('active');
                  surpriseVideo.currentTime = 0;
                  surpriseVideo.play().catch(() => {});
                },
              });
            }, 3000);
          },
        });
      },
    });
  });
}

/* Close wish video */
if (surpriseVideoClose) {
  surpriseVideoClose.addEventListener('click', () => {
    surpriseVideo.pause();
    surpriseVideo.currentTime = 0;
    surpriseVideoOverlay.classList.remove('active');
  });
}

/* ── Select Card ─────────────────────────────────────────────── */
function selectCard(card) {
  if (fired) return;

  const type      = card.dataset.type;
  const isCorrect = card.dataset.correct === 'true';

  fired = true;
  pauseOrbit();

  const rect    = card.getBoundingClientRect();
  const centerX = rect.left + rect.width  / 2;
  const centerY = rect.top  + rect.height / 2;

  const tl = gsap.timeline();

  /* 1. Burst + flip card face-up + scale up */
  tl.call(() => {
    spawnBurst(centerX, centerY);
    card.classList.add('flipped');
    if (isCorrect) card.classList.add('completed');
  });

  tl.to(card, { scale: 1.6, zIndex: 1000, duration: 0.45, ease: 'back.out(1.5)' }, 0);

  /* 2. Flash transition */
  tl.to(flash, { opacity: 1, duration: 0.35, ease: 'power2.in' }, '+=0.5');

  /* 3. Show appropriate panel */
  tl.call(() => {
    /* Update progress only once per correct type */
    if (isCorrect) updateGameProgress(type);

    sceneOrbit.classList.add('hidden');

    if (type === 'wrong') {
      showPanel('wrong');
      revealWrong();
    } else {
      showPanel(type);
      revealPanel(type);
    }
  });

  tl.to(flash, { opacity: 0, duration: 0.4, ease: 'power2.out' });
}

/* ── Card Click Listeners ─────────────────────────────────── */
orbitCards.forEach(card => {
  card.addEventListener('click', () => selectCard(card));
});

/* ── Reveal per card type ─────────────────────────────────── */
function revealPanel(type) {
  switch (type) {
    case 'image':    revealImage();    break;
    case 'video':    revealVideo();    break;
    case 'envelope': revealEnvelope(); break;
    case 'wrong':    revealWrong();    break;
  }
}

/* IMAGE — load all 23 photos from /public/gallery */
async function revealImage() {
  const grid = document.getElementById('photoGrid');
  if (!grid) return;
  grid.innerHTML = '';

  /* Fetch manifest (image paths) and memories.json (captions) in parallel */
  let photos = [];
  let captions = {};
  try {
    const [mRes, cRes] = await Promise.all([
      fetch('/gallery/manifest.json'),
      fetch('/gallery/memories.json'),
    ]);
    const manifest = await mRes.json();
    captions = await cRes.json();
    photos = manifest.images || [];
  } catch (e) {
    console.warn('Gallery load error:', e);
  }

  if (photos.length === 0) {
    grid.innerHTML = '<p style="color:#4a7aac;text-align:center;grid-column:1/-1;padding:40px">Photos loading… 💕</p>';
    return;
  }

  const sampleDates = [
    'May 25, 2024', 'May 20, 2024', 'May 18, 2024', 'May 12, 2024',
    'Apr 28, 2024', 'Apr 14, 2024', 'Mar 30, 2024', 'Mar 15, 2024',
    'Feb 14, 2024', 'Jan 26, 2024', 'Jan 10, 2024', 'Dec 25, 2023'
  ];

  photos.forEach((src, idx) => {
    /* Caption from memories.json keyed by filename */
    const filename = src.split('/').pop();
    const caption  = captions[filename] || 'Special Memory 💕';
    const dateStr  = sampleDates[idx % sampleDates.length];

    const card = document.createElement('div');
    card.className = 'mem-photo-card-item';

    card.innerHTML = `
      <div class="mem-thumb-wrapper">
        <img src="${src}" alt="${caption}" loading="lazy" />
      </div>
      <div class="mem-card-info">
        <div class="mem-card-text">
          <h4 class="mem-card-title">${caption}</h4>
        </div>
        <button class="mem-heart-btn" type="button" aria-label="Favorite">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6c8eb5" stroke-width="2" class="heart-svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
          </svg>
        </button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      const heartBtn = e.target.closest('.mem-heart-btn');
      if (heartBtn) {
        heartBtn.classList.toggle('liked');
        const path = heartBtn.querySelector('path');
        if (heartBtn.classList.contains('liked')) {
          path.setAttribute('fill', '#ff4d79');
          path.setAttribute('stroke', '#ff4d79');
        } else {
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', '#6c8eb5');
        }
        return;
      }

      const lb  = document.getElementById('memLightbox');
      const lbI = document.getElementById('memLbImg');
      if (lb && lbI) { lbI.src = src; lb.classList.add('open'); }
    });

    grid.appendChild(card);
  });

  /* Stagger entrance animation */
  gsap.from('.mem-photo-card-item', {
    opacity: 0, scale: 0.8, y: 30,
    stagger: 0.05, duration: 0.5,
    ease: 'back.out(1.4)', delay: 0.15,
  });
}

/* VIDEO — list built dynamically from /public/videos */
function revealVideo() {
  buildVideoPanel();
  gsap.from('.vid-card-item', {
    opacity: 0, y: 35, scale: 0.82,
    stagger: 0.1, duration: 0.6, ease: 'back.out(1.4)', delay: 0.25,
  });
}

/* ENVELOPE */
function revealEnvelope() {
  const container = document.getElementById('pinkEnvelopeContainer');
  const modal = document.getElementById('letterModal');
  
  if (modal) modal.classList.remove('open');

  if (container) {
    gsap.fromTo(container, 
      { opacity: 0, y: 50, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: 'back.out(1.4)', delay: 0.2 }
    );
  }
}

function openLetterCard() {
  const modal = document.getElementById('letterModal');
  if (modal) modal.classList.add('open');
}

function closeLetterCard() {
  const modal = document.getElementById('letterModal');
  if (modal) modal.classList.remove('open');
}

/* Event Listeners for Letter Panel */
document.addEventListener('click', e => {
  const container = e.target.closest('#pinkEnvelopeContainer');
  const modal = document.getElementById('letterModal');
  const closeBtn = e.target.closest('#letterCloseBtn');
  const letHeart = e.target.closest('#letHeartBtn');

  if (letHeart) {
    letHeart.classList.toggle('liked');
    const path = letHeart.querySelector('path');
    if (letHeart.classList.contains('liked')) {
      path.setAttribute('fill', '#e85b81');
    } else {
      path.setAttribute('fill', 'none');
    }
    return;
  }

  if (closeBtn || e.target === modal) {
    closeLetterCard();
    return;
  }

  if (container) {
    openLetterCard();
  }
});


/* WRONG */
function revealWrong() {
  wrongBox.classList.remove('revealed');
  setTimeout(() => wrongBox.classList.add('revealed'), 300);
}

/* ── Back Buttons & Return to Orbit ─────────────────────────── */
function returnToOrbit(type) {
  /* Pause all videos when leaving video panel */
  if (type === 'video') {
    const player = document.getElementById('vidLbPlayer');
    if (player) { player.pause(); player.currentTime = 0; }
    const lb = document.getElementById('vidLightbox');
    if (lb) lb.classList.remove('open');
  }
  if (type === 'envelope') {
    const modal = document.getElementById('letterModal');
    if (modal) modal.classList.remove('open');
  }
  if (type === 'wrong') {
    if (wrongBox) wrongBox.classList.remove('revealed');
  }

  const flashEl = document.getElementById('flash');
  if (flashEl) {
    gsap.to(flashEl, {
      opacity: 1, duration: 0.28, ease: 'power2.in',
      onComplete() {
        hideAllPanels();
        if (sceneOrbit) sceneOrbit.classList.remove('hidden');
        resumeOrbit();
        gsap.to(flashEl, { opacity: 0, duration: 0.4 });
      },
    });
  } else {
    hideAllPanels();
    if (sceneOrbit) sceneOrbit.classList.remove('hidden');
    resumeOrbit();
  }
}

/* Global Event Delegation for Back Buttons & Panel Actions */
document.addEventListener('click', e => {
  const backBtn = e.target.closest('.back-btn');
  if (backBtn) {
    const panelType = backBtn.dataset.panel;
    returnToOrbit(panelType);
    return;
  }
});

if (tryAgainBtn) {
  tryAgainBtn.addEventListener('click', () => returnToOrbit('wrong'));
}

/* ── Memories & Video Lightboxes (in-panel) ────────────────────── */
document.addEventListener('click', e => {
  const memLb = document.getElementById('memLightbox');
  if (memLb && (e.target.id === 'memLbClose' || e.target === memLb)) {
    memLb.classList.remove('open');
  }

  const vidLb = document.getElementById('vidLightbox');
  const vidPlayer = document.getElementById('vidLbPlayer');
  if (vidLb) {
    if (e.target.id === 'vidLbClose' || e.target === vidLb) {
      vidLb.classList.remove('open');
      if (vidPlayer) {
        vidPlayer.pause();
        vidPlayer.currentTime = 0;
      }
    } else if (e.target === vidPlayer) {
      if (vidPlayer.paused) {
        vidPlayer.play();
      } else {
        vidPlayer.pause();
      }
    }
  }
});
