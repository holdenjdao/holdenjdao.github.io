const GITHUB_USER = "holdenjdao";

/* ============ Interactive grid background ============
   A full-page grid of squares that subtly lights up around the
   cursor and fades back out. Occasional ambient flickers keep it
   alive on touch devices. */
(function gridBackground() {
  const canvas = document.getElementById("grid-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CELL = 44;          // grid cell size in px
  const RADIUS = 3.6;       // cursor glow radius, in cells
  const DECAY = 0.93;       // per-frame brightness decay
  const MAX_FILL = 0.035;   // peak fill alpha (kept faint on purpose)
  const MAX_STROKE = 0.085; // peak outline alpha
  const LINE_ALPHA = 0.03;  // resting grid line alpha

  // Grid ink follows the active theme: white on dark, near-black on light.
  let ink = "255, 255, 255";
  function readInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim();
    if (v) ink = v;
  }
  readInk();
  addEventListener("themechange", () => { readInk(); drawStatic(); start(); });

  let cols = 0, rows = 0, cells = [];
  let mouseX = -1e4, mouseY = -1e4;
  let running = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(innerWidth / CELL) + 1;
    rows = Math.ceil(innerHeight / CELL) + 1;
    cells = new Float32Array(cols * rows);
    drawStatic();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.strokeStyle = `rgba(${ink}, ${LINE_ALPHA})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, innerHeight); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(innerWidth, y * CELL + 0.5); }
    ctx.stroke();
  }

  function light(cx, cy, strength) {
    const gx = cx / CELL, gy = cy / CELL;
    const r = Math.ceil(RADIUS);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.floor(gx) + dx, y = Math.floor(gy) + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const dist = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
        if (dist > RADIUS) continue;
        const falloff = Math.pow(1 - dist / RADIUS, 2);
        const i = y * cols + x;
        cells[i] = Math.min(1, cells[i] + strength * falloff);
      }
    }
    start();
  }

  function frame() {
    drawStatic();
    let alive = false;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let b = cells[i];
        if (b < 0.005) { cells[i] = 0; continue; }
        alive = true;
        cells[i] = b * DECAY;
        ctx.fillStyle = `rgba(${ink}, ${(b * MAX_FILL).toFixed(4)})`;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 1, CELL - 1);
        ctx.strokeStyle = `rgba(${ink}, ${(b * MAX_STROKE).toFixed(4)})`;
        ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL, CELL);
      }
    }
    if (alive) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  addEventListener("mousemove", (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    light(mouseX, mouseY, 0.3);
  }, { passive: true });

  // gentle ambient flickers (visible on touch devices too)
  setInterval(() => {
    light(Math.random() * innerWidth, Math.random() * innerHeight, 0.22);
  }, 1400);

  addEventListener("resize", resize);
  resize();
})();

/* ============ Live GitHub stats ============ */
function setStat(key, value) {
  document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => (el.textContent = value));
}

(async function githubStats() {
  try {
    const u = await fetch(`https://api.github.com/users/${GITHUB_USER}`).then((r) => r.json());
    if (u.public_repos !== undefined) setStat("repos", u.public_repos);
    if (u.followers !== undefined) setStat("followers", u.followers);
    const repos = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`).then((r) => r.json());
    if (Array.isArray(repos)) {
      setStat("stars", repos.reduce((s, r) => s + (r.stargazers_count || 0), 0));
    }
  } catch { /* keep dashes offline / rate-limited */ }
})();

/* ============ Contribution graph ============ */
(async function contribGraph() {
  const graph = document.getElementById("contrib-graph");
  if (!graph) return;

  function render(days) {
    graph.innerHTML = "";
    days.forEach((d) => {
      const cell = document.createElement("span");
      cell.className = "cell" + (d.level ? " l" + d.level : "");
      cell.title = `${d.count} contributions on ${d.date}`;
      graph.appendChild(cell);
    });
  }

  try {
    const data = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`).then((r) => r.json());
    if (!Array.isArray(data.contributions)) throw new Error("bad payload");
    render(data.contributions);
    const total = data.total && data.total.lastYear;
    if (total !== undefined) {
      setStat("contributions", total.toLocaleString());
      setStat("contributions2", total.toLocaleString());
    }
  } catch {
    // fallback: render an empty grid so the section keeps its shape
    render(Array.from({ length: 53 * 7 }, () => ({ level: 0, count: 0, date: "" })));
  }
})();

/* ============ Contact form -> Web3Forms ============ */
const WEB3FORMS_KEY = "bb55b909-c6c1-4dd8-9168-90d5603950c9"; // public by design
const form = document.getElementById("contact-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("cf-name").value.trim();
    const email = document.getElementById("cf-email").value.trim();
    const msg = document.getElementById("message").value.trim();
    const status = document.getElementById("form-status");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sending...";
    status.textContent = "";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Portfolio message from ${name}`,
          name,
          email,
          message: msg,
          botcheck: document.getElementById("cf-botcheck").checked,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "send failed");
      status.textContent = "Message sent ✓";
      form.reset();
      const counter = document.getElementById("char-count");
      if (counter) counter.textContent = "0";
    } catch {
      status.textContent = "Something went wrong — please email me directly at holden.dao@utah.edu";
    } finally {
      btn.disabled = false;
      btn.textContent = "Send";
    }
  });
}

/* ============ Contact form character counter ============ */
const message = document.getElementById("message");
const charCount = document.getElementById("char-count");
if (message && charCount) {
  message.addEventListener("input", () => {
    charCount.textContent = message.value.length;
  });
}

/* ============ Active nav link on scroll ============ */
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-links a[href^='#']");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      let id = entry.target.id;
      if (id === "activity") id = "home";
      if (id === "education") id = "experience";
      if (id === "tech") id = "projects";
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === "#" + id);
      });
    });
  },
  { rootMargin: "-40% 0px -55% 0px" }
);
sections.forEach((s) => observer.observe(s));

/* ============ Theme toggle ============ */
(function themeToggle() {
  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const apply = (theme) => {
    root.setAttribute("data-theme", theme);
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  };

  apply(root.getAttribute("data-theme") || "dark");

  btn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    apply(next);
    try { localStorage.setItem("theme", next); } catch { /* private mode */ }
  });

  // Follow the OS only while the visitor has not picked a theme themselves.
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    try { if (localStorage.getItem("theme")) return; } catch { /* private mode */ }
    apply(e.matches ? "light" : "dark");
  });
})();

/* ============ Hero project showcase ============
   Cross-fades through project screenshots. Pauses while hovered or
   focused, when the tab is hidden, and never auto-advances for
   visitors who prefer reduced motion. */
(function projectShowcase() {
  const root = document.querySelector(".showcase");
  if (!root) return;

  const slides = [...root.querySelectorAll(".showcase-slide")];
  const dotsEl = root.querySelector(".showcase-dots");
  const projectEl = root.querySelector(".showcase-project");
  const pageEl = root.querySelector(".showcase-page");
  const INTERVAL = 4500;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let index = 0, timer = null, paused = false;

  const dots = slides.map((slide, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "showcase-dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `${slide.dataset.project}: ${slide.dataset.page}`);
    dot.addEventListener("click", () => { show(i); restart(); });
    dotsEl.appendChild(dot);
    return dot;
  });

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, j) => {
      const active = j === index;
      s.classList.toggle("is-active", active);
      s.tabIndex = active ? 0 : -1;
      s.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((d, j) => d.setAttribute("aria-selected", String(j === index)));
    projectEl.textContent = slides[index].dataset.project;
    pageEl.textContent = slides[index].dataset.page;
  }

  function restart() {
    clearInterval(timer);
    if (reduceMotion || paused || document.hidden) return;
    timer = setInterval(() => show(index + 1), INTERVAL);
  }

  root.querySelectorAll(".showcase-btn").forEach((btn) =>
    btn.addEventListener("click", () => { show(index + Number(btn.dataset.dir)); restart(); })
  );

  const pause = (p) => () => { paused = p; restart(); };
  root.addEventListener("mouseenter", pause(true));
  root.addEventListener("mouseleave", pause(false));
  root.addEventListener("focusin", pause(true));
  root.addEventListener("focusout", pause(false));
  document.addEventListener("visibilitychange", restart);

  show(0);
  restart();
})();


/* ============ Möbius strip watermark ============
   The same wireframe strip as Hyperspace, drawn faintly in the top-right corner. It turns on its
   own and leans toward the cursor; it never takes pointer events. */
(function mobiusStrip() {
  const canvas = document.getElementById("strip-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RUNGS = 96;
  const BAND = 0.34;
  const LINES = 5;
  let W = 0, H = 0, cx = 0, cy = 0, scale = 1;
  const rot = { x: 0.9, y: 0.4, z: 0 };
  const lean = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let ink = "255, 255, 255";

  function readInk() {
    ink = document.documentElement.getAttribute("data-theme") === "light" ? "29, 29, 31" : "255, 255, 255";
  }
  readInk();
  addEventListener("themechange", readInk);

  function mobius(u, v) {
    const r = 1 + v * Math.cos(u / 2);
    return [r * Math.cos(u), r * Math.sin(u), v * Math.sin(u / 2)];
  }
  function project(p) {
    let [px, py, pz] = p;
    const ax = rot.x + lean.x, ay = rot.y + lean.y;
    [py, pz] = [py * Math.cos(ax) - pz * Math.sin(ax), py * Math.sin(ax) + pz * Math.cos(ax)];
    [px, pz] = [px * Math.cos(ay) + pz * Math.sin(ay), -px * Math.sin(ay) + pz * Math.cos(ay)];
    [px, py] = [px * Math.cos(rot.z) - py * Math.sin(rot.z), px * Math.sin(rot.z) + py * Math.cos(rot.z)];
    const depth = 1 / (1 + pz * 0.22);
    return { x: cx + px * scale * depth, y: cy + py * scale * depth, z: pz };
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.6; cy = H * 0.45;
    scale = Math.min(W * 0.26, H * 0.34);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    const segs = [];
    for (let i = 0; i < RUNGS; i++) {
      const u = (i / RUNGS) * Math.PI * 2;
      const a = project(mobius(u, -BAND)), b = project(mobius(u, BAND));
      segs.push({ a, b, z: (a.z + b.z) / 2, w: 1 });
    }
    for (let l = 0; l < LINES; l++) {
      const v = -BAND + (2 * BAND * l) / (LINES - 1);
      const edge = l === 0 || l === LINES - 1;
      let prev = project(mobius(0, v));
      for (let i = 1; i <= RUNGS * 2; i++) {
        const p = project(mobius((i / RUNGS) * Math.PI * 2, v));
        segs.push({ a: prev, b: p, z: (prev.z + p.z) / 2, w: edge ? 2 : 0.8 });
        prev = p;
      }
    }
    segs.sort((s, t) => s.z - t.z);
    for (const s of segs) {
      const shade = 0.35 + ((s.z + 1.4) / 2.8) * 0.65;
      ctx.strokeStyle = `rgba(${ink}, ${Math.min(1, shade) * (s.w >= 2 ? 0.95 : 0.55)})`;
      ctx.lineWidth = s.w * (0.7 + shade * 0.6);
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
    }
  }
  function frame() {
    rot.y += 0.004;
    lean.x += (target.x - lean.x) * 0.06;
    lean.y += (target.y - lean.y) * 0.06;
    draw();
    if (!reduced) requestAnimationFrame(frame);
  }
  addEventListener("pointermove", (e) => {
    target.y = ((e.clientX - innerWidth * 0.75) / innerWidth) * 0.5;
    target.x = ((e.clientY - innerHeight * 0.3) / innerHeight) * 0.5;
  });
  addEventListener("resize", resize);
  resize();
  frame();
})();
