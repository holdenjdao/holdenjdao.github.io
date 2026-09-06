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
  const RADIUS = 3.2;       // cursor glow radius, in cells
  const DECAY = 0.945;      // per-frame brightness decay
  const MAX_FILL = 0.085;   // peak fill alpha (keep it subtle)
  const MAX_STROKE = 0.22;  // peak outline alpha

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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.032)";
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
        ctx.fillStyle = `rgba(255, 255, 255, ${(b * MAX_FILL).toFixed(4)})`;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 1, CELL - 1);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(b * MAX_STROKE).toFixed(4)})`;
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
    light(mouseX, mouseY, 0.55);
  }, { passive: true });

  // gentle ambient flickers (visible on touch devices too)
  setInterval(() => {
    light(Math.random() * innerWidth, Math.random() * innerHeight, 0.35);
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
      if (id === "about" || id === "activity") id = "home";
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
