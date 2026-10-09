import * as THREE from "three";

const canvas = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

const BG = 0xf7f4ee;
const TEAL = 0x0d7a6f;
const CORAL = 0xe4572e;
const INK = 0x33424c;

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch {
  canvas.remove();
}

// ================= field scene (hero background) =================

const fieldScene = new THREE.Scene();
fieldScene.fog = new THREE.FogExp2(BG, 0.045);

const fieldCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
fieldCamera.position.set(0, 1.2, 7.5);

const fieldWorld = new THREE.Group();
fieldScene.add(fieldWorld);

const COLS = 150;
const ROWS = 70;
const GAP = 0.34;
const COUNT = COLS * ROWS;

const positions = new Float32Array(COUNT * 3);
const colors = new Float32Array(COUNT * 3);
const teal = new THREE.Color("#0d7a6f");
const navy = new THREE.Color("#33424c");
const coral = new THREE.Color("#e4572e");

{
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - COLS / 2) * GAP;
      const z = (r - ROWS / 2) * GAP - 4;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z;

      const t = THREE.MathUtils.clamp((x + 25) / 50, 0, 1);
      const col = navy.clone().lerp(teal, t);
      if (Math.abs(x) < 3.2) {
        col.lerp(coral, 0.55 * (1 - Math.abs(x) / 3.2));
      }
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      i++;
    }
  }
}

const fieldGeo = new THREE.BufferGeometry();
fieldGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
fieldGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const field = new THREE.Points(
  fieldGeo,
  new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
  })
);
field.position.y = -1.6;
fieldWorld.add(field);

const ico = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.7, 1),
  new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.18 })
);
ico.position.set(3.1, 1.5, 0.4);
fieldWorld.add(ico);

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.62, 0.2, 90, 12),
  new THREE.MeshBasicMaterial({ color: CORAL, wireframe: true, transparent: true, opacity: 0.3 })
);
knot.position.set(-3.6, 0.6, -1.5);
fieldWorld.add(knot);

// pointer ripple on the field
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.6);
const hit = new THREE.Vector3();
const ripple = { cx: 0, cz: 0, tx: 0, tz: 0, s: 0, ts: 0 };

if (!reduceMotion && finePointer) {
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    ndc.set(mouse.tx, -mouse.ty);
    ripple.ts = 1;
  });
  document.documentElement.addEventListener("pointerleave", () => {
    ripple.ts = 0;
  });
}

function updateField(elapsed) {
  if (ripple.ts > 0) {
    raycaster.setFromCamera(ndc, fieldCamera);
    if (raycaster.ray.intersectPlane(planeY, hit)) {
      const local = field.worldToLocal(hit);
      ripple.tx = local.x;
      ripple.tz = local.z;
    }
  }
  ripple.cx += (ripple.tx - ripple.cx) * 0.12;
  ripple.cz += (ripple.tz - ripple.cz) * 0.12;
  ripple.s += (ripple.ts - ripple.s) * 0.06;

  const bump = ripple.s * 1.25;
  const pos = fieldGeo.attributes.position.array;
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p];
    const z = pos[p + 2];
    const dx = x - ripple.cx;
    const dz = z - ripple.cz;
    const d2 = dx * dx + dz * dz;
    pos[p + 1] =
      Math.sin(x * 0.28 + elapsed * 0.8) * 0.34 +
      Math.sin(z * 0.5 + elapsed * 0.55) * 0.22 +
      Math.sin((x + z) * 0.14 + elapsed * 0.32) * 0.4 +
      bump * Math.exp(-d2 / 2.4);
  }
  fieldGeo.attributes.position.needsUpdate = true;

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;

  fieldWorld.rotation.y = mouse.x * 0.05 + progress * 0.4;
  fieldCamera.position.x = mouse.x * 0.7;
  fieldCamera.position.y = 1.2 - mouse.y * 0.35 + progress * 0.8;
  fieldCamera.lookAt(0, 0.4, -2);

  ico.rotation.x = elapsed * 0.12;
  ico.rotation.y = elapsed * 0.18;
  knot.rotation.x = -elapsed * 0.1;
  knot.rotation.y = elapsed * 0.14;
}

// ================= per-section emblem scenes =================

const views = [];

function registerView(el, build) {
  if (!el) return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 6);
  const update = build(scene, camera);
  views.push({ el, scene, camera, update });
}

function edges(geo, color, opacity = 0.9) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
}

// 01 About — network graph: a career of connected people and systems
function buildNetwork(scene) {
  const group = new THREE.Group();
  const nodeGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4;
    const p = new THREE.Vector3(
      Math.sin(a) * 1.7 * (0.4 + (i % 4) * 0.2),
      Math.cos(a * 1.3) * 1.0,
      Math.sin(a * 0.7) * 1.7 * (0.3 + (i % 3) * 0.25)
    );
    pts.push(p);
    const node = new THREE.Mesh(
      nodeGeo,
      new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? CORAL : TEAL })
    );
    node.position.copy(p);
    group.add(node);
  }
  const linePos = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[i].distanceTo(pts[j]) < 1.5) {
        linePos.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
  group.add(
    new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.35 }))
  );
  scene.add(group);
  return (t) => {
    group.rotation.y = t * 0.25 + mouse.x * 0.3;
    group.rotation.x = Math.sin(t * 0.4) * 0.12 - mouse.y * 0.15;
    group.position.y = Math.sin(t * 0.8) * 0.1;
  };
}

// 02 Experience — career stack that assembles as you scroll through the section
function buildTower(scene) {
  const group = new THREE.Group();
  const layers = [];
  const layerColors = [TEAL, INK, CORAL, TEAL, INK];
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.BoxGeometry(1.7 - i * 0.08, 0.26, 1.7 - i * 0.08);
    const holder = new THREE.Group();
    holder.add(
      new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: layerColors[i], transparent: true, opacity: 0.14 })),
      edges(geo, layerColors[i])
    );
    holder.position.y = -1.2 + i * 0.6;
    holder.visible = false;
    group.add(holder);
    layers.push(holder);
  }
  scene.add(group);
  return (t, rect) => {
    const p = THREE.MathUtils.clamp((window.innerHeight - rect.top) / (window.innerHeight * 0.8), 0, 1);
    group.rotation.y = p * Math.PI * 1.6 + t * 0.15;
    layers.forEach((l, i) => {
      const s = THREE.MathUtils.clamp(p * 6 - i, 0, 1);
      l.visible = s > 0.01;
      l.scale.setScalar(Math.max(s, 0.001));
    });
  };
}

// 03 Projects — a ring of floating builds
function buildCubes(scene) {
  const group = new THREE.Group();
  const cubes = [];
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const color = i % 3 === 0 ? CORAL : TEAL;
    const holder = new THREE.Group();
    holder.add(
      new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14 })),
      edges(geo, color, 0.85)
    );
    const a = (i / 8) * Math.PI * 2;
    holder.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
    group.add(holder);
    cubes.push(holder);
  }
  scene.add(group);
  return (t) => {
    group.rotation.y = t * 0.3;
    cubes.forEach((c, i) => {
      c.position.y = Math.sin(t * 1.2 + i * 0.8) * 0.18;
      c.rotation.x = t * 0.5 + i;
      c.rotation.y = t * 0.4 + i;
    });
  };
}

// 04 Education — globe with an orbiting laurel
function buildGlobe(scene) {
  const group = new THREE.Group();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 14, 10),
    new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.28 })
  );
  const pivot = new THREE.Group();
  pivot.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.02, 8, 64),
      new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.7 })
    )
  );
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), new THREE.MeshBasicMaterial({ color: CORAL }));
  dot.position.set(1.35, 0, 0);
  pivot.add(dot);
  group.add(globe, pivot);
  group.rotation.x = 0.45;
  scene.add(group);
  return (t) => {
    globe.rotation.y = t * 0.35;
    pivot.rotation.z = t * 0.8;
    group.rotation.y = t * 0.15;
  };
}

// 05 Skills — everything in orbit around the craft
function buildOrbit(scene) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color: CORAL, wireframe: true }));
  group.add(core);
  const rings = [];
  [[0.85, TEAL, 1], [1.2, INK, 2], [1.55, TEAL, 3]].forEach(([r, color, n], idx) => {
    const pivot = new THREE.Group();
    pivot.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.015, 6, 72),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 })
      )
    );
    for (let k = 0; k < n; k++) {
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color: idx === 1 ? CORAL : TEAL })
      );
      const a = (k / n) * Math.PI * 2;
      moon.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      pivot.add(moon);
    }
    pivot.rotation.x = 0.5 + idx * 0.9;
    pivot.rotation.y = idx * 0.7;
    group.add(pivot);
    rings.push({ pivot, speed: 0.35 + idx * 0.2, axis: idx % 2 ? "z" : "x" });
  });
  scene.add(group);
  return (t) => {
    core.rotation.y = t * 0.5;
    core.rotation.x = t * 0.3;
    rings.forEach((r) => {
      r.pivot.rotation[r.axis] = t * r.speed;
    });
    group.rotation.y = mouse.x * 0.25;
  };
}

// 06 Contact — a beacon sending ripples
function buildBeacon(scene) {
  const group = new THREE.Group();
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.02, 8, 64),
      new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.7 })
    );
    group.add(ring);
    rings.push(ring);
  }
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    new THREE.MeshBasicMaterial({ color: TEAL })
  );
  group.add(core);
  group.rotation.x = 0.55;
  scene.add(group);
  return (t) => {
    rings.forEach((ring, i) => {
      const p = (t * 0.45 + i / 3) % 1;
      ring.scale.setScalar(0.7 + p * 2.0);
      ring.material.opacity = (1 - p) * 0.65;
    });
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
    group.rotation.y = Math.sin(t * 0.5) * 0.2;
  };
}

registerView(document.querySelector('[data-scene="about"]'), buildNetwork);
registerView(document.querySelector('[data-scene="experience"]'), buildTower);
registerView(document.querySelector('[data-scene="projects"]'), buildCubes);
registerView(document.querySelector('[data-scene="education"]'), buildGlobe);
registerView(document.querySelector('[data-scene="skills"]'), buildOrbit);
registerView(document.querySelector('[data-scene="contact"]'), buildBeacon);

// ================= single renderer, many scenes =================

if (renderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  function resize() {
    fieldCamera.aspect = window.innerWidth / window.innerHeight;
    fieldCamera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  resize();
  window.addEventListener("resize", resize);

  function frame(t) {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear(true, true, true);

    updateField(t);
    renderer.render(fieldScene, fieldCamera);

    renderer.setScissorTest(true);
    for (const v of views) {
      const rect = v.el.getBoundingClientRect();
      if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
      const left = rect.left;
      const bottom = window.innerHeight - rect.bottom;
      renderer.setViewport(left, bottom, rect.width, rect.height);
      renderer.setScissor(left, bottom, rect.width, rect.height);
      renderer.clearDepth();
      if (v.update) v.update(t, rect);
      renderer.render(v.scene, v.camera);
    }
  }

  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduceMotion) clock.getDelta();
  });

  if (reduceMotion) {
    const staticRender = () => frame(window.scrollY * 0.0005);
    staticRender();
    window.addEventListener("scroll", staticRender, { passive: true });
  } else {
    renderer.setAnimationLoop(() => {
      if (!running) return;
      frame(clock.getElapsedTime());
    });
  }
}

// ================= UI: entrance animations =================

const revealEls = document.querySelectorAll(".reveal, .reveal-l, .reveal-r");

document.querySelectorAll("[data-stagger]").forEach((group) => {
  [...group.children].forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i * 90, 540)}ms`;
  });
});

if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add("in");
          io.unobserve(el);
          setTimeout(() => {
            el.style.transitionDelay = "";
          }, 1200);
        }
      }
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => {
    el.classList.add("in");
    el.style.transitionDelay = "";
  });
}

// ================= UI: scroll progress bar =================

const progress = document.querySelector(".progress");
function paintProgress() {
  if (!progress) return;
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  const p = max > 0 ? h.scrollTop / max : 0;
  progress.style.transform = `scaleX(${p})`;
}
window.addEventListener("scroll", paintProgress, { passive: true });
paintProgress();

// ================= UI: animated counters =================

function animateNum(el) {
  const target = Number(el.dataset.target);
  const suffix = el.dataset.suffix || "";
  const start = performance.now();
  const duration = 1300;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const statNums = document.querySelectorAll(".stat-num");
if (reduceMotion || !("IntersectionObserver" in window)) {
  statNums.forEach((el) => {
    el.textContent = el.dataset.target + (el.dataset.suffix || "");
  });
} else {
  const statIo = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animateNum(entry.target);
          statIo.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.5 }
  );
  statNums.forEach((el) => statIo.observe(el));
}

// ================= UI: project filters =================

const filterBtns = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll(".projects-grid .card");
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const filter = btn.dataset.filter;
    filterBtns.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    projectCards.forEach((card) => {
      card.classList.toggle("hide", filter !== "all" && card.dataset.cat !== filter);
    });
  });
});

// ================= UI: 3D tilt on project cards =================

if (finePointer && !reduceMotion) {
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -7;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 7;
      card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

// ================= UI: copy email =================

const copyBtn = document.getElementById("copy-email");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const email = copyBtn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const tmp = document.createElement("textarea");
      tmp.value = email;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      tmp.remove();
    }
    copyBtn.classList.add("copied");
    copyBtn.textContent = "Copied to clipboard!";
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.textContent = email;
    }, 2000);
  });
}

// ================= UI: footer year =================

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
