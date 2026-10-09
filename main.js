import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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

// ================= materials & light helpers =================

function metal(color, rough = 0.25) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: rough });
}
function glass(color, opacity = 0.35) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.2, transparent: true, opacity });
}
function edges(geo, color, opacity = 0.8) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
}
const rnd = (i) => {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const ease = (k) => k * k * (3 - 2 * k);

// ================= the world =================

const world = new THREE.Scene();
world.fog = new THREE.FogExp2(BG, 0.028);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 1.4, 10);

// ================= data-stream floor (follows the camera) =================

const COLS = 110;
const ROWS = 160;
const GAPX = 0.5;
const GAPZ = 0.85;
const COUNT = COLS * ROWS;

const positions = new Float32Array(COUNT * 3);
const colors = new Float32Array(COUNT * 3);
const tealC = new THREE.Color("#0d7a6f");
const navyC = new THREE.Color("#33424c");
const coralC = new THREE.Color("#e4572e");

{
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - COLS / 2) * GAPX;
      const z = (r - ROWS / 2) * GAPZ;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z;

      const t = THREE.MathUtils.clamp((x + 14) / 28, 0, 1);
      const col = navyC.clone().lerp(tealC, t);
      if (Math.abs(x) < 2.2) {
        col.lerp(coralC, 0.5 * (1 - Math.abs(x) / 2.2));
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
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    sizeAttenuation: true,
  })
);
field.position.y = -1.6;
world.add(field);

// pointer ripple + click splash on the floor
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.6);
const hit = new THREE.Vector3();
const ripple = { cx: 0, cz: 0, tx: 0, tz: 0, s: 0, ts: 0 };

if (finePointer) {
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

window.addEventListener("pointerdown", (e) => {
  if (e.target.closest("a, button, .card, .site-header, input, textarea")) return;
  mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  ndc.set(mouse.tx, -mouse.ty);
  ripple.ts = 1;
  ripple.s = Math.min(ripple.s + 1.8, 3);
});

// ================= hero vignette near the start of the journey =================

const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.62, 0.2, 120, 20), metal(CORAL, 0.18));
knot.position.set(-3.6, 0.9, -2);
world.add(knot);

const icoWire = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.7, 1),
  new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.16 })
);
icoWire.position.set(3.1, 1.6, -1);
world.add(icoWire);

const icoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), metal(TEAL, 0.28));
icoCore.position.copy(icoWire.position);
world.add(icoCore);

// ================= career chapters =================

const chapters = [];
function chapter(z, build) {
  const g = new THREE.Group();
  g.position.z = z;
  world.add(g);
  const update = build(g);
  chapters.push({ g, z, update });
}

// Chapter 1 — Roots: SMK Negeri 4 Bandung, first apps, first internship
function buildRoots(g) {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 40),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  // the sapling — a career that grew from school
  const sapling = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.1, 10), metal(INK, 0.4));
  trunk.position.y = 0.55;
  const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), glass(TEAL, 0.6));
  leaf1.position.y = 1.5;
  const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 18), glass(CORAL, 0.6));
  leaf2.position.set(0.32, 1.12, 0.1);
  const leaf3 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 18), glass(TEAL, 0.6));
  leaf3.position.set(-0.34, 1.2, -0.05);
  sapling.add(trunk, leaf1, leaf2, leaf3);
  sapling.position.set(-1.7, 0, 0);
  g.add(sapling);

  // first builds: the Foodink tablet and a terminal
  const tablet = new THREE.Group();
  tablet.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.05), glass(INK, 0.45)));
  const tabScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.38),
    new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.85 })
  );
  tabScreen.position.z = 0.031;
  tablet.add(tabScreen);
  tablet.position.set(1.4, 1.6, 0.4);
  g.add(tablet);

  const terminal = new THREE.Group();
  terminal.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.08), glass(INK, 0.45)));
  const termScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.4),
    new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.85 })
  );
  termScreen.position.z = 0.051;
  terminal.add(termScreen);
  terminal.position.set(2.7, 1.2, -0.6);
  g.add(terminal);

  const sparks = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), metal(i % 2 ? CORAL : TEAL, 0.3));
    g.add(s);
    sparks.push(s);
  }

  return (t, act) => {
    sapling.scale.setScalar(0.25 + act * 0.75);
    sapling.rotation.z = Math.sin(t * 0.8) * 0.05;
    tablet.position.y = 1.6 + Math.sin(t * 1.1) * 0.12;
    tablet.rotation.y = t * 0.4;
    terminal.position.y = 1.2 + Math.sin(t * 0.9 + 1) * 0.1;
    terminal.rotation.y = -t * 0.3 + Math.PI;
    sparks.forEach((s, i) => {
      const a = t * 0.7 + (i / sparks.length) * Math.PI * 2;
      s.position.set(-1.7 + Math.cos(a) * 1.0, 0.9 + Math.sin(t + i) * 0.2, Math.sin(a) * 1.0);
    });
  };
}

// Chapter 2 — The Builder: WGS years, Drupal & Laravel sites taking shape
function buildBuilder(g) {
  const panels = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const geo = new THREE.BoxGeometry(1.2, 0.8, 0.04);
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(geo, glass(idx % 4 === 0 ? CORAL : TEAL, 0.5)), edges(geo, idx % 4 === 0 ? CORAL : TEAL, 0.6));
      const target = new THREE.Vector3((c - 1) * 1.5, 1 + (1 - r) * 1.0, 0);
      const start = new THREE.Vector3((rnd(idx) - 0.5) * 7, 2.5 + rnd(idx + 9) * 2, -6 + rnd(idx + 4) * 12);
      const startRot = new THREE.Euler(rnd(idx + 2) * 2, rnd(idx + 7) * 2, rnd(idx + 5) * 2);
      holder.position.copy(start);
      holder.rotation.copy(startRot);
      g.add(holder);
      panels.push({ holder, start, startRot, target, idx });
    }
  }

  const towers = [];
  for (let tI = 0; tI < 2; tI++) {
    const stack = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const block = new THREE.Group();
      block.add(new THREE.Mesh(geo, glass(tI ? CORAL : TEAL, 0.35)), edges(geo, tI ? CORAL : TEAL));
      block.position.y = b * 0.52;
      stack.add(block);
    }
    stack.position.set(tI ? 2.4 : -2.4, 1.05, 0.8);
    g.add(stack);
    towers.push(stack);
  }

  return (t, act) => {
    panels.forEach((p) => {
      const k = ease(THREE.MathUtils.clamp(act * 1.8 - p.idx * 0.09, 0, 1));
      p.holder.position.lerpVectors(p.start, p.target, k);
      p.holder.rotation.set(
        p.startRot.x * (1 - k) + Math.sin(t * 0.6 + p.idx) * 0.02,
        p.startRot.y * (1 - k),
        p.startRot.z * (1 - k)
      );
    });
    towers.forEach((stack, tI) => {
      stack.rotation.y = t * 0.25 * (tI ? -1 : 1) + act * 0.5;
      stack.scale.setScalar(0.3 + act * 0.7);
    });
  };
}

// Chapter 3 — Leading Teams: Smoets, coordinating people and timelines
function buildLeader(g) {
  const net = new THREE.Group();
  net.position.y = 1.9;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), metal(CORAL, 0.2));
  net.add(hub);

  const rings = [];
  [[0.95, 4, TEAL, 0.6], [1.4, 5, TEAL, -0.4]].forEach(([r, n, color, speed], ri) => {
    const pivot = new THREE.Group();
    if (ri === 1) pivot.rotation.x = 0.5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const sat = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), metal(color, 0.3));
      sat.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        sat.position.clone(),
      ]);
      pivot.add(sat, new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.4 })));
    }
    net.add(pivot);
    rings.push({ pivot, speed });
  });
  g.add(net);

  // project timeline — the PM years, bars extending in sequence
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.03, 0.03), metal(INK, 0.4));
  base.position.set(0, 0.3, 1);
  g.add(base);
  const bars = [];
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.BoxGeometry(0.72, 0.16, 0.16);
    const bar = new THREE.Mesh(geo, metal(i % 2 ? CORAL : TEAL, 0.3));
    bar.geometry.translate(0.36, 0, 0);
    bar.position.set(-2.1 + (i % 3) * 0.25 + i * 0.05, 0.3 + (i % 2) * (0.3 - 0.15), 1);
    bar.scale.x = 0.001;
    g.add(bar);
    bars.push(bar);
  }
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), metal(CORAL, 0.25));
  marker.rotation.z = -Math.PI / 2;
  marker.position.set(-2.1, 0.62, 1);
  g.add(marker);

  return (t, act) => {
    rings.forEach((r) => {
      r.pivot.rotation.y = t * r.speed;
    });
    hub.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    bars.forEach((bar, i) => {
      bar.scale.x = Math.max(THREE.MathUtils.clamp(act * 6 - i * 0.9, 0, 1), 0.001);
    });
    marker.position.x = -2.1 + act * 3.4;
  };
}

// Chapter 4 — Property at scale: the Rumah123 city, growth charts, search beams
function buildCity(g) {
  const buildings = [];
  for (let i = 0; i < 12; i++) {
    const h = 0.8 + rnd(i) * 2.6;
    const geo = new THREE.BoxGeometry(1.1, h, 1.1);
    const color = i % 5 === 0 ? CORAL : i % 2 ? TEAL : INK;
    const b = new THREE.Mesh(geo, glass(color, 0.4));
    const frame = edges(geo, color, 0.7);
    b.add(frame);
    b.position.set(((i % 4) - 1.5) * 1.75, 0, (Math.floor(i / 4) - 1) * 2.0);
    b.scale.y = 0.001;
    g.add(b);
    buildings.push({ b, h, i });
  }

  // lead-generation growth chart
  const chart = new THREE.Group();
  chart.position.set(3.1, 0, -1.2);
  const chartBars = [];
  const heights = [0.7, 1.25, 1.9];
  heights.forEach((h, i) => {
    const geo = new THREE.BoxGeometry(0.42, h, 0.42);
    const bar = new THREE.Mesh(geo, metal(i === 2 ? CORAL : TEAL, 0.3));
    bar.geometry.translate(0, h / 2, 0);
    bar.position.x = i * 0.62;
    bar.scale.y = 0.001;
    chart.add(bar);
    chartBars.push(bar);
  });
  const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), metal(CORAL, 0.25));
  arrowShaft.rotation.z = -0.9;
  arrowShaft.position.set(0.55, 1.5, 0);
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 10), metal(CORAL, 0.25));
  arrowHead.rotation.z = -0.9 - Math.PI / 2;
  arrowHead.position.set(1.18, 2.05, 0);
  chart.add(arrowShaft, arrowHead);
  g.add(chart);

  // search beam sweeping the city
  const beamPivot = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3.4, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 1.7;
  beam.rotation.x = Math.PI;
  beamPivot.add(beam);
  beamPivot.position.set(0, 2.6, 0);
  g.add(beamPivot);

  return (t, act) => {
    buildings.forEach(({ b, h, i }) => {
      const s = THREE.MathUtils.clamp(act * 4 - i * 0.22, 0.001, 1);
      b.scale.y = s;
      b.position.y = (h * s) / 2;
    });
    chartBars.forEach((bar, i) => {
      bar.scale.y = Math.max(THREE.MathUtils.clamp(act * 3.4 - i * 0.5, 0.001, 1), 0.001);
    });
    arrowShaft.scale.y = Math.max(act, 0.001);
    arrowHead.scale.setScalar(Math.max(act, 0.001));
    beamPivot.rotation.y = t * 0.55;
    beam.material.opacity = 0.04 + act * 0.07;
  };
}

// Chapter 5 — Knowledge orbit: always studying, always learning
function buildOrbit(g) {
  const group = new THREE.Group();
  group.position.y = 1.8;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), metal(CORAL, 0.2));
  group.add(core);
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 14, 10),
    new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.2 })
  );
  group.add(globe);
  const rings = [];
  [[1.15, TEAL, 2], [1.6, INK, 3], [2.05, TEAL, 4]].forEach(([r, color, n], idx) => {
    const pivot = new THREE.Group();
    pivot.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.018, 10, 80),
        new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.3, transparent: true, opacity: 0.6 })
      )
    );
    for (let k = 0; k < n; k++) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 14), metal(idx === 1 ? CORAL : TEAL, 0.3));
      const a = (k / n) * Math.PI * 2;
      moon.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      pivot.add(moon);
    }
    pivot.rotation.x = 0.5 + idx * 0.9;
    pivot.rotation.y = idx * 0.7;
    group.add(pivot);
    rings.push({ pivot, speed: 0.35 + idx * 0.18, axis: idx % 2 ? "z" : "x" });
  });
  g.add(group);
  return (t, act) => {
    group.scale.setScalar(0.5 + act * 0.5);
    core.rotation.y = t * 0.5;
    core.rotation.x = t * 0.3;
    globe.rotation.y = -t * 0.2;
    rings.forEach((r) => {
      r.pivot.rotation[r.axis] = t * r.speed;
    });
    group.rotation.y = mouse.x * 0.2;
  };
}

// Epilogue — the portal: your move
function buildPortal(g) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.07, 16, 90), metal(CORAL, 0.18));
  ring.position.y = 2.2;
  g.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 48),
    new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  disc.position.y = 2.2;
  g.add(disc);

  const ripples = [];
  for (let i = 0; i < 3; i++) {
    const rp = new THREE.Mesh(
      new THREE.TorusGeometry(2, 0.015, 8, 80),
      new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.5 })
    );
    rp.position.y = 2.2;
    g.add(rp);
    ripples.push(rp);
  }

  const stream = [];
  for (let i = 0; i < 46; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), metal(i % 3 ? TEAL : CORAL, 0.3));
    g.add(s);
    stream.push({ s, off: i / 46, phase: rnd(i) * Math.PI * 2, speed: 0.55 + rnd(i + 30) * 0.4 });
  }

  return (t, act) => {
    ring.rotation.z = t * 0.2;
    disc.rotation.z = -t * 0.12;
    disc.material.opacity = 0.08 + act * 0.08;
    ripples.forEach((rp, i) => {
      const p = (t * 0.4 + i / 3) % 1;
      rp.scale.setScalar(1 + p * 0.5);
      rp.material.opacity = (1 - p) * 0.5 * act;
    });
    stream.forEach(({ s, off, phase, speed }) => {
      const r = (t * speed + off) % 1;
      const radius = 2.7 * (1 - r) + 0.15;
      const a = phase + t * 0.6 + r * 2.2;
      s.position.set(Math.cos(a) * radius, 2.2 + Math.sin(a) * radius * 0.55, Math.sin(a) * radius);
      s.scale.setScalar(0.5 + r);
    });
  };
}

chapter(-60, buildRoots);
chapter(-120, buildBuilder);
chapter(-180, buildLeader);
chapter(-240, buildCity);
chapter(-300, buildOrbit);
chapter(-360, buildPortal);

// ================= camera journey keyframes =================

const STOPS = [
  [0.0, 10, 1.4],
  [0.13, -46, 1.6],
  [0.29, -106, 1.5],
  [0.47, -166, 1.9],
  [0.63, -226, 2.3],
  [0.79, -286, 1.7],
  [1.0, -348, 1.5],
];

function camAt(p) {
  for (let i = 1; i < STOPS.length; i++) {
    if (p <= STOPS[i][0]) {
      const [p0, z0, y0] = STOPS[i - 1];
      const [p1, z1, y1] = STOPS[i];
      const k = (p - p0) / (p1 - p0);
      const e = ease(k);
      return [z0 + (z1 - z0) * e, y0 + (y1 - y0) * e];
    }
  }
  return [STOPS[STOPS.length - 1][1], STOPS[STOPS.length - 1][2]];
}

// ================= single renderer =================

if (renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  world.environment = envTex;

  world.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xfff4e0, 1.2);
  key.position.set(3, 4, 5);
  world.add(key);
  const rim = new THREE.DirectionalLight(0x9be8dc, 0.5);
  rim.position.set(-4, -2, -3);
  world.add(rim);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  resize();
  window.addEventListener("resize", resize);

  function scrollProgress() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    return max > 0 ? h.scrollTop / max : 0;
  }

  function updateField(elapsed) {
    if (ripple.ts > 0) {
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(planeY, hit)) {
        const local = field.worldToLocal(hit);
        ripple.tx = local.x;
        ripple.tz = local.z;
      }
    }
    ripple.cx += (ripple.tx - ripple.cx) * 0.12;
    ripple.cz += (ripple.tz - ripple.cz) * 0.12;
    ripple.s += (ripple.ts - ripple.s) * 0.05;

    const bump = ripple.s * 1.25;
    const pos = fieldGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      const dx = x - ripple.cx;
      const dz = z - ripple.cz;
      const d2 = dx * dx + dz * dz;
      pos[i + 1] =
        Math.sin(x * 0.5 + elapsed * 0.9) * 0.18 +
        Math.sin(z * 0.35 + elapsed * 0.5) * 0.16 +
        Math.sin((x + z) * 0.16 + elapsed * 0.3) * 0.22 +
        bump * Math.exp(-d2 / 2.0);
    }
    fieldGeo.attributes.position.needsUpdate = true;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
  }

  function frame(t) {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear(true, true, true);

    const p = reduceMotion ? window.scrollY * 0.0004 : scrollProgress();
    const [cz, cy] = camAt(p);

    camera.position.set(mouse.x * 0.9, cy - mouse.y * 0.35, cz);
    camera.lookAt(mouse.x * 0.35, cy - 0.15, cz - 12);

    field.position.z = cz - 45;
    updateField(t);

    for (const ch of chapters) {
      ch.g.visible = cz > ch.z - 6 && cz < ch.z + 48;
      const act = THREE.MathUtils.clamp(1 - Math.abs(cz - (ch.z + 14)) / 26, 0, 1);
      if (ch.g.visible) ch.update(t, act);
    }

    icoCore.rotation.x = t * 0.1;
    icoCore.rotation.y = t * 0.16;
    icoWire.rotation.x = t * 0.12;
    icoWire.rotation.y = t * 0.18;
    knot.rotation.x = -t * 0.1;
    knot.rotation.y = t * 0.14;

    renderer.render(world, camera);
  }

  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduceMotion) clock.getDelta();
  });

  if (reduceMotion) {
    const staticRender = () => frame(0);
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

// ================= UI: progress bar + chapter HUD =================

const progress = document.querySelector(".progress");
const chIdxEl = document.getElementById("ch-idx");
const chNameEl = document.getElementById("ch-name");

const CHAPTER_MARKS = [
  { p: 0.0, idx: "Prologue", name: "PadrinPanji — Hello" },
  { p: 0.13, idx: "Chapter 1", name: "Roots · SMK Negeri 4 & first code (2009–2013)" },
  { p: 0.29, idx: "Chapter 2", name: "The Builder · Walden Global Services (2013–2016)" },
  { p: 0.47, idx: "Chapter 3", name: "Leading Teams · Smoets (2016–2021)" },
  { p: 0.63, idx: "Chapter 4", name: "Property at Scale · 99 Group / Rumah123 (2021–now)" },
  { p: 0.79, idx: "Chapter 5", name: "Knowledge Orbit · always learning" },
  { p: 0.93, idx: "Epilogue", name: "Your move — let's talk" },
];

let shownChapter = -1;
function paintProgress() {
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  const p = max > 0 ? h.scrollTop / max : 0;
  if (progress) progress.style.transform = `scaleX(${p})`;

  if (chIdxEl && chNameEl) {
    let cur = 0;
    for (let i = 0; i < CHAPTER_MARKS.length; i++) {
      if (p >= CHAPTER_MARKS[i].p) cur = i;
    }
    if (cur !== shownChapter) {
      shownChapter = cur;
      chIdxEl.textContent = CHAPTER_MARKS[cur].idx;
      chNameEl.textContent = CHAPTER_MARKS[cur].name;
    }
  }
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
