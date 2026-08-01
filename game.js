import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const hud = $('#hud');
const startScreen = $('#start');
const gameOverScreen = $('#gameover');
const startBtn = $('#startBtn');
const restartBtn = $('#restartBtn');
const scoreEl = $('#score');
const waveEl = $('#wave');
const comboEl = $('#combo');
const hpFill = $('#hpFill');
const shineFill = $('#shineFill');
const hpText = $('#hpText');
const shineText = $('#shineText');
const announcement = $('#announcement');
const flash = $('#flash');
const finalScore = $('#finalScore');
const epitaph = $('#epitaph');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

let scene, camera, renderer, clock, player, head, aura, arenaRing, raycaster, groundPlane;
let enemies = [], beams = [], particles = [], enemyShots = [];
let running = false, paused = false, spawnTimer = 0, lastFire = 0, messageTimer = 0, shake = 0;
let audioCtx = null;

const input = {
  keys: {},
  pointer: new THREE.Vector2(),
  aim: new THREE.Vector3(0, 0, -10),
  mouseDown: false,
  touchMove: new THREE.Vector2(),
  touchFiring: false
};

const state = {
  score: 0,
  hp: 100,
  shine: 0,
  wave: 1,
  combo: 1,
  comboTimer: 0,
  elapsed: 0,
  dashCd: 0,
  invuln: 0,
  bossSpawned: false
};

const skinMat = new THREE.MeshStandardMaterial({ color: 0xffb17b, roughness: 0.22, metalness: 0.32 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x190726, roughness: 0.55, metalness: 0.25 });
const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff4fb3, emissive: 0x7d0b50, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.45 });
const cyanMat = new THREE.MeshStandardMaterial({ color: 0x5cf4ff, emissive: 0x176b80, emissiveIntensity: 1.3, roughness: 0.2, metalness: 0.5 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x8a4f08, emissiveIntensity: 0.7, roughness: 0.28, metalness: 0.8 });

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090211);
  scene.fog = new THREE.FogExp2(0x13031e, 0.024);

  camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(0, 18, 23);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  app.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  scene.add(new THREE.HemisphereLight(0x9ceaff, 0x280326, 1.9));
  const sun = new THREE.DirectionalLight(0xffd6a1, 3.1);
  sun.position.set(-8, 18, 10);
  sun.castShadow = true;
  scene.add(sun);
  const rim = new THREE.PointLight(0xff30a8, 42, 38, 2);
  rim.position.set(12, 8, -12);
  scene.add(rim);

  buildWorld();
  createPlayer();
  bindEvents();
  updateHUD();
  animate();
  window.__GAME_READY__ = true;
}

function buildWorld() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(21, 72),
    new THREE.MeshStandardMaterial({ color: 0x16051e, roughness: 0.7, metalness: 0.25 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (let r = 4; r <= 20; r += 4) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.035, 5, 96),
      new THREE.MeshBasicMaterial({ color: r % 8 === 0 ? 0xff4fb3 : 0x5cf4ff, transparent: true, opacity: 0.32 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    scene.add(ring);
  }

  arenaRing = new THREE.Mesh(
    new THREE.TorusGeometry(20.5, 0.2, 8, 128),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff4f00, emissiveIntensity: 1.4, metalness: 0.85 })
  );
  arenaRing.rotation.x = Math.PI / 2;
  arenaRing.position.y = 0.16;
  scene.add(arenaRing);

  for (const [x, z, s] of [[-14, -7, 1.5], [14, 7, 1.2], [0, -19, 1.8]]) buildTorii(x, z, s);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfff0b8 }));
  moon.position.set(-25, 24, -55);
  scene.add(moon);

  for (let i = 0; i < 48; i++) {
    const a = rand(0, TAU), r = rand(27, 50), w = rand(2, 5), h = rand(4, 18);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: [0x240632, 0x0b1734, 0x23103d][i % 3], roughness: 0.8 })
    );
    b.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    b.rotation.y = rand(0, Math.PI);
    scene.add(b);
  }

  const petalGeo = new THREE.BufferGeometry();
  const arr = new Float32Array(420 * 3);
  for (let i = 0; i < 420; i++) {
    arr[i * 3] = rand(-45, 45);
    arr[i * 3 + 1] = rand(1, 30);
    arr[i * 3 + 2] = rand(-50, 25);
  }
  petalGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  scene.add(new THREE.Points(petalGeo, new THREE.PointsMaterial({ color: 0xff83c9, size: 0.18, transparent: true, opacity: 0.7 })));
}

function buildTorii(x, z, s) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xd6193f, emissive: 0x41000e, emissiveIntensity: 0.4 });
  for (const px of [-2, 2]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6, 0.7), red);
    p.position.set(px, 3, 0);
    p.castShadow = true;
    g.add(p);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 0.9), red);
  top.position.y = 6;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 1.1), darkMat);
  roof.position.y = 6.65;
  g.add(top, roof);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  scene.add(g);
}

function createPlayer() {
  player = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.05, 2.15, 12), darkMat);
  robe.position.y = 1.05;
  robe.castShadow = true;
  player.add(robe);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.12, 8, 24), goldMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.55;
  player.add(belt);

  head = new THREE.Mesh(new THREE.SphereGeometry(1.18, 30, 22), skinMat);
  head.scale.y = 1.08;
  head.position.y = 3.3;
  head.castShadow = true;
  player.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18050d });
  for (const x of [-0.39, 0.39]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), eyeMat);
    eye.position.set(x, 3.43, 1.06);
    eye.scale.y = 0.65;
    player.add(eye);
  }
  for (const x of [-0.16, 0.16]) {
    const moustache = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), eyeMat);
    moustache.rotation.z = x < 0 ? 1.25 : -1.25;
    moustache.position.set(x, 2.95, 1.05);
    player.add(moustache);
  }

  aura = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.06, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x5cf4ff, transparent: true, opacity: 0.55 })
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.y = 0.08;
  player.add(aura);

  const glow = new THREE.PointLight(0xffdf9a, 9, 8, 2);
  glow.position.set(0, 4.1, 0.3);
  player.add(glow);

  player.position.set(0, 0, 4);
  scene.add(player);
}

function makeWig() {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 9, 0, TAU, 0, Math.PI * 0.58), darkMat);
  cap.position.y = 1.1;
  cap.castShadow = true;
  g.add(cap);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    const strand = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.05, 6), i % 2 ? pinkMat : darkMat);
    strand.position.set(Math.cos(a) * 0.65, 0.62, Math.sin(a) * 0.65);
    strand.rotation.z = Math.cos(a) * 0.25;
    strand.rotation.x = Math.sin(a) * 0.25;
    g.add(strand);
  }
  return g;
}

function makeClipper() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.25, 0.65), new THREE.MeshStandardMaterial({ color: 0x555b7a, metalness: 0.95, roughness: 0.15 }));
  body.position.y = 0.9;
  g.add(body);
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.65, 0.35), cyanMat);
    tooth.position.set(i * 0.2, 1.75, 0.12);
    g.add(tooth);
  }
  return g;
}

function makeBoss() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 18), pinkMat);
  body.position.y = 3.4;
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    for (let j = 0; j < 5; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.38 - j * 0.04, 8, 6), pinkMat);
      s.position.set(Math.cos(a) * j * 0.5, 1.7 - j * 0.25, Math.sin(a) * j * 0.5);
      g.add(s);
    }
  }
  return g;
}

function spawnEnemy(type = null) {
  if (!type) type = state.wave >= 3 && Math.random() > 0.68 ? 'clipper' : 'wig';
  const a = rand(0, TAU), r = rand(18.5, 20);
  const mesh = type === 'clipper' ? makeClipper() : makeWig();
  const hp = type === 'clipper' ? 42 + state.wave * 4 : 20 + state.wave * 2;
  mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  scene.add(mesh);
  enemies.push({ mesh, type, hp, speed: type === 'clipper' ? 2.2 : 1.55, damage: type === 'clipper' ? 15 : 9, radius: 0.9, score: type === 'clipper' ? 260 : 140, hitCd: 0, phase: rand(0, 10) });
}

function spawnBoss() {
  const mesh = makeBoss();
  mesh.position.set(0, 0, -17);
  scene.add(mesh);
  enemies.push({ mesh, type: 'boss', hp: 650, speed: 0.55, damage: 22, radius: 2.5, score: 5000, hitCd: 0, phase: 0, shootCd: 1, boss: true });
  announce('TAKO-KATSU\nLE POULPE COIFFEUR', 2400);
}

function bindEvents() {
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    if (e.code === 'KeyE') triggerSuper();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) dash();
    if (e.code === 'Escape') paused = !paused;
  });
  addEventListener('keyup', (e) => input.keys[e.code] = false);

  renderer.domElement.addEventListener('pointermove', (e) => {
    input.pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(input.pointer, camera);
    raycaster.ray.intersectPlane(groundPlane, input.aim);
  });
  renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 0) input.mouseDown = true; });
  addEventListener('pointerup', () => { input.mouseDown = false; input.touchFiring = false; });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  setupJoystick();
  $('#fireBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); input.touchFiring = true; });
  $('#superBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); triggerSuper(); });
  $('#dashBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); dash(); });
}

function setupJoystick() {
  const joy = $('#joy'), nub = $('#nub');
  let active = false, pointerId = null;
  const move = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width * 0.35, len = Math.hypot(dx, dy) || 1, scale = Math.min(max, len) / len;
    dx *= scale; dy *= scale;
    nub.style.transform = `translate(${dx}px,${dy}px)`;
    input.touchMove.set(dx / max, -dy / max);
  };
  joy.addEventListener('pointerdown', (e) => { active = true; pointerId = e.pointerId; joy.setPointerCapture(pointerId); move(e); });
  joy.addEventListener('pointermove', (e) => { if (active && e.pointerId === pointerId) move(e); });
  const end = () => { active = false; input.touchMove.set(0, 0); nub.style.transform = 'translate(0,0)'; };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
}

function startGame() {
  for (const list of [enemies, beams, particles, enemyShots]) for (const o of list) scene.remove(o.mesh || o);
  enemies = []; beams = []; particles = []; enemyShots = [];
  Object.assign(state, { score: 0, hp: 100, shine: 0, wave: 1, combo: 1, comboTimer: 0, elapsed: 0, dashCd: 0, invuln: 0, bossSpawned: false });
  player.position.set(0, 0, 4);
  player.visible = true;
  running = true;
  paused = false;
  spawnTimer = 0;
  startScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  hud.style.display = 'block';
  ensureAudio();
  announce('LE CRÂNE S’ÉVEILLE', 1500);
  for (let i = 0; i < 5; i++) spawnEnemy('wig');
}

function nearestEnemy() {
  let best = null, d = Infinity;
  for (const e of enemies) {
    const dd = e.mesh.position.distanceToSquared(player.position);
    if (dd < d) { best = e; d = dd; }
  }
  return best;
}

function fire() {
  if (state.elapsed - lastFire < 0.12) return;
  lastFire = state.elapsed;
  const origin = player.position.clone().add(new THREE.Vector3(0, 3.75, 0));
  let target = input.aim.clone();
  if (input.touchFiring || input.keys.Space || !Number.isFinite(target.x)) {
    const n = nearestEnemy();
    target = n ? n.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)) : player.position.clone().add(new THREE.Vector3(0, 0, -10));
  }
  const dir = target.sub(origin).normalize();
  const len = 25;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.12, len, 8), new THREE.MeshBasicMaterial({ color: state.shine > 80 ? 0xffffff : 0x5cf4ff, transparent: true, opacity: 0.9 }));
  beam.position.copy(origin).addScaledVector(dir, len / 2);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(beam);
  beams.push({ mesh: beam, life: 0.09 });

  let hit = null, hitT = Infinity;
  for (const e of enemies) {
    const to = e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin);
    const t = to.dot(dir);
    if (t < 0 || t > len) continue;
    const dist = to.clone().addScaledVector(dir, -t).length();
    if (dist < e.radius + 0.45 && t < hitT) { hit = e; hitT = t; }
  }
  if (hit) hitEnemy(hit, 11 + state.combo * 0.5, dir);
  tone(520, 0.045, 'square', 0.025);
}

function hitEnemy(e, damage, dir) {
  e.hp -= damage;
  e.mesh.position.addScaledVector(dir, 0.15);
  state.shine = clamp(state.shine + 2, 0, 100);
  burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x5cf4ff, 5);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const i = enemies.indexOf(e);
  if (i < 0) return;
  enemies.splice(i, 1);
  scene.remove(e.mesh);
  burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), e.boss ? 0xffd166 : 0xff4fb3, e.boss ? 55 : 16);
  state.combo = clamp(state.combo + 1, 1, 12);
  state.comboTimer = 3.2;
  state.score += Math.round(e.score * state.combo);
  state.shine = clamp(state.shine + (e.boss ? 100 : 8), 0, 100);
  if (e.boss) announce('LE POUVOIR DU FRONT\nEST ABSOLU', 2800);
}

function damagePlayer(n) {
  if (state.invuln > 0) return;
  state.hp = clamp(state.hp - n, 0, 100);
  state.invuln = 0.4;
  state.combo = 1;
  shake = 0.7;
  flash.style.background = '#ff174d';
  flash.style.opacity = '0.45';
  setTimeout(() => flash.style.opacity = '0', 90);
  if (state.hp <= 0) gameOver();
}

function gameOver() {
  running = false;
  player.visible = false;
  hud.style.display = 'none';
  finalScore.textContent = `${Math.floor(state.score).toLocaleString('fr-FR')} points`;
  epitaph.textContent = 'La repousse n’a pas gagné. Elle a seulement obtenu un délai administratif.';
  gameOverScreen.style.display = 'grid';
}

function dash() {
  if (!running || state.dashCd > 0) return;
  state.dashCd = 2;
  state.invuln = 0.38;
  let v = getMoveVector();
  if (v.lengthSq() < 0.1) v.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
  player.position.addScaledVector(v.normalize(), 4.2);
  clampPlayer();
  burst(player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x5cf4ff, 20);
}

function triggerSuper() {
  if (!running || state.shine < 100) return;
  state.shine = 0;
  announce('MIROIR DU NÉANT', 1400);
  flash.style.background = 'white';
  flash.style.opacity = '0.85';
  setTimeout(() => flash.style.opacity = '0', 120);
  for (const e of [...enemies]) if (e.mesh.position.distanceTo(player.position) < 18) hitEnemy(e, e.boss ? 180 : 999, e.mesh.position.clone().sub(player.position).normalize());
}

function getMoveVector() {
  let x = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.KeyQ || input.keys.ArrowLeft ? 1 : 0);
  let z = (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) - (input.keys.KeyW || input.keys.KeyZ || input.keys.ArrowUp ? 1 : 0);
  x += input.touchMove.x;
  z -= input.touchMove.y;
  const v = new THREE.Vector3(x, 0, z);
  if (v.lengthSq() > 1) v.normalize();
  return v;
}

function clampPlayer() {
  const r = Math.hypot(player.position.x, player.position.z);
  if (r > 18.2) { player.position.x *= 18.2 / r; player.position.z *= 18.2 / r; }
}

function update(dt) {
  state.elapsed += dt;
  state.dashCd = Math.max(0, state.dashCd - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) state.combo = 1;

  const nextWave = 1 + Math.floor(state.elapsed / 22);
  if (nextWave !== state.wave) { state.wave = nextWave; announce(`VAGUE ${state.wave} — BRILLANCE CRITIQUE`, 1700); }
  if (state.wave >= 4 && !state.bossSpawned) { state.bossSpawned = true; spawnBoss(); }

  player.position.addScaledVector(getMoveVector(), 5.8 * dt);
  clampPlayer();

  let aim = input.aim.clone().sub(player.position); aim.y = 0;
  if ((input.touchFiring || input.keys.Space) && nearestEnemy()) aim = nearestEnemy().mesh.position.clone().sub(player.position).setY(0);
  if (aim.lengthSq() > 0.1) player.rotation.y = Math.atan2(aim.x, aim.z);
  if (input.mouseDown || input.keys.Space || input.touchFiring) fire();

  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.filter(e => !e.boss).length < 7 + state.wave * 2) {
    spawnEnemy();
    spawnTimer = Math.max(0.35, 1.3 - state.wave * 0.08);
  }

  for (const e of [...enemies]) {
    e.phase += dt; e.hitCd -= dt;
    const to = player.position.clone().sub(e.mesh.position); to.y = 0;
    const d = to.length(); to.normalize();
    e.mesh.position.addScaledVector(to, e.speed * dt);
    e.mesh.rotation.y = Math.atan2(to.x, to.z);
    e.mesh.position.y = e.boss ? Math.sin(e.phase * 1.4) * 0.25 : Math.sin(e.phase * 4) * 0.12;
    if (e.boss) {
      e.shootCd -= dt;
      if (e.shootCd <= 0) { shootBoss(e); e.shootCd = 1.25; }
    }
    if (d < e.radius + 1 && e.hitCd <= 0) { damagePlayer(e.damage); e.hitCd = 0.8; }
  }

  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const b = enemyShots[i];
    b.life -= dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    if (b.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1, 0))) < 0.8) { damagePlayer(12); b.life = 0; }
    if (b.life <= 0) { scene.remove(b.mesh); enemyShots.splice(i, 1); }
  }

  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].life -= dt;
    beams[i].mesh.material.opacity = Math.max(0, beams[i].life / 0.09);
    if (beams[i].life <= 0) { scene.remove(beams[i].mesh); beams.splice(i, 1); }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt); p.vel.y -= 6 * dt; p.mesh.material.opacity = clamp(p.life * 2, 0, 1);
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }

  aura.rotation.z += dt * 2.5;
  aura.material.opacity = 0.35 + Math.sin(state.elapsed * 6) * 0.12 + state.shine / 280;
  head.material.roughness = 0.27 - state.shine * 0.0017;
  arenaRing.rotation.z += dt * 0.08;
  updateHUD();
}

function shootBoss(e) {
  const start = e.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0));
  for (let k = -2; k <= 2; k++) {
    const dir = player.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(start).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.16);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4fb3 }));
    mesh.position.copy(start); scene.add(mesh);
    enemyShots.push({ mesh, vel: dir.multiplyScalar(7), life: 5 });
  }
}

function burst(pos, color, count = 15) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.06, 0.18)), new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.copy(pos); scene.add(mesh);
    particles.push({ mesh, life: rand(0.35, 0.8), vel: new THREE.Vector3(rand(-1, 1), rand(0.2, 1.3), rand(-1, 1)).normalize().multiplyScalar(rand(2, 7)) });
  }
}

function updateHUD() {
  scoreEl.textContent = Math.floor(state.score).toLocaleString('fr-FR');
  waveEl.textContent = state.wave;
  comboEl.textContent = `×${state.combo}`;
  hpFill.style.width = `${state.hp}%`;
  shineFill.style.width = `${state.shine}%`;
  hpText.textContent = Math.ceil(state.hp);
  shineText.textContent = Math.floor(state.shine);
  $('#superBtn').style.filter = state.shine >= 100 ? 'brightness(1.8) drop-shadow(0 0 12px #ffd166)' : 'none';
}

function announce(text, duration = 1200) {
  announcement.innerHTML = text.replace('\n', '<br>');
  announcement.classList.add('show');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => announcement.classList.remove('show'), duration);
}

function ensureAudio() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}

function tone(freq, dur = 0.1, type = 'sine', vol = 0.03) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination); o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.stop(audioCtx.currentTime + dur + 0.02);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.035);
  if (running && !paused) update(dt);
  const target = new THREE.Vector3(0, 18, 23);
  if (shake > 0) { shake = Math.max(0, shake - dt * 2); target.x += rand(-1, 1) * shake; target.y += rand(-1, 1) * shake * 0.5; }
  camera.position.lerp(target, 1 - Math.exp(-8 * dt));
  camera.lookAt(player && player.visible ? player.position.clone().multiplyScalar(0.13).add(new THREE.Vector3(0, 1.2, 0)) : new THREE.Vector3(0, 1, 0));
  renderer.render(scene, camera);
}

try {
  init();
} catch (error) {
  console.error(error);
  startBtn.textContent = 'Erreur WebGL — recharger';
  startBtn.disabled = true;
}
