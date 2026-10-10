// arena.js
// Builds the level. There are five arenas and the game moves to the next one every 10 waves:
//   waves  1-10  THE SLAG YARD          scrapyard foundry at dusk
//   waves 11-20  THE MOLTEN FOUNDRY     glowing lava cracks in the floor burn you
//   waves 21-30  FROZEN SCRAP TUNDRA    ice patches: you slide around on them
//   waves 31-40  NEON RUST CATHEDRAL    a ruined cathedral at night, lit by neon
//   waves 41-50  THE STORM ROOFTOP      lightning strikes the red circles: get out!
// After wave 50 they loop round again with a red "harder" tint and stronger hazards.
// Also handles simple collision (keeping characters out of obstacles and inside the walls).
import * as THREE from 'three';

export const ARENA_HALF = 18; // the playable area goes from -18 to +18 on X and Z
const WAVES_PER_ARENA = 10;

// Which arena (and which loop) a wave is in
export function arenaForWave(n) {
  const step = Math.floor((Math.max(1, n) - 1) / WAVES_PER_ARENA);
  return { index: step % THEMES.length, loop: Math.floor(step / THEMES.length) };
}

// ---------------------------------------------------------------------------------------
// The five arenas. Obstacles are kept away from the middle (where you start) and spread
// out so there's always room to dodge.
const THEMES = [
  {
    id: 'slag', place: 'the Slag Yard', name: 'THE SLAG YARD', sub: 'Where the Grindchoir gathers',
    bg: 0x14191d, fog: [45, 95], hemi: [0xbfd8e0, 0x4a3426, 1.2], sun: [0xffd2a0, 2.5],
    floor: paintSlag, wall: 0x6b3a22, wallH: 1.8, post: 0x2b2826, lamp: 0xffb050,
    centre: 'hazardRing',
    obstacles: [
      ['stack', -8, -7], ['stack', 8, 8], ['stack', 0, -13], ['stack', 14, 1],
      ['heap', 8, -7], ['heap', -8, 8], ['heap', -14, 0],
      ['barrel', 4, 13], ['barrel', 5, 13.6], ['barrel', -5, 13.5], ['barrel', 13, -9], ['barrel', -13, -10], ['barrel', -12.4, -10.8],
    ],
  },
  {
    id: 'foundry', place: 'the Molten Foundry', name: 'THE MOLTEN FOUNDRY', sub: 'Mind the cracks: they burn',
    bg: 0x1c0c08, fog: [40, 90], hemi: [0xffb08a, 0x3a1a10, 1.0], sun: [0xff9a50, 2.6],
    floor: paintFoundry, wall: 0x3a3533, wallH: 2.2, post: 0x1a1716, lamp: 0xff5a1a,
    centre: 'grate', particles: 'embers', hazard: 'lava',
    obstacles: [
      ['crucible', -9, -6], ['crucible', 9, 6], ['crucible', -5, 12], ['crucible', 6, -12],
      ['anvil', 12, -3], ['anvil', -12, 3], ['anvil', 13, 12], ['anvil', -13, -12],
    ],
    cracks: [ // x, z, length, angle
      [-2, -8, 7, 0.5], [3, 8.5, 7, -0.4], [-10, 9, 6, 1.9], [11, -9, 6, 2.2], [-14, -5, 5, 0.1], [15, 4, 5, 3.0],
    ],
  },
  {
    id: 'tundra', place: 'the Frozen Scrap Tundra', name: 'FROZEN SCRAP TUNDRA', sub: 'Ice is slippery: watch your footing',
    bg: 0x9db3c4, fog: [32, 85], hemi: [0xeaf4ff, 0x5c6c7c, 1.3], sun: [0xe2efff, 1.9],
    floor: paintTundra, wall: 0xc8d8e4, wallH: 1.6, post: 0x6a7a88, lamp: 0x9ae4ff,
    centre: 'frostRing', particles: 'snow', hazard: 'ice',
    obstacles: [
      ['ice', -8, -8], ['ice', 9, 9], ['ice', 11, -10],
      ['wreck', -11, 6], ['wreck', 12, 0],
      ['spire', 0, 12], ['spire', 0, -12], ['spire', -14, -3], ['spire', -5, 15],
    ],
    ice: [[5, -5, 3], [-6, 3.5, 2.8], [-3, -12, 2.6], [13, 6, 2.6], [-13, 12, 2.5], [5, 14, 2.4]],
  },
  {
    id: 'cathedral', place: 'the Neon Rust Cathedral', name: 'NEON RUST CATHEDRAL', sub: 'The Grindchoir sings at midnight',
    bg: 0x0a0816, fog: [34, 85], hemi: [0x9c8cff, 0x3a2448, 1.35], sun: [0xb8c4ff, 2.0],
    floor: paintCathedral, wall: 0x4a3e5c, wallH: 3.0, post: 0x15111c, lamp: 0xff3cac,
    centre: 'roseWindow', particles: 'motes',
    obstacles: [
      ['pillar', -7, -12], ['pillar', 7, -12], ['pillar', -7, -4], ['pillar', 7, -4],
      ['pillar', -7, 4], ['pillar', 7, 4], ['pillar', -7, 12], ['pillar', 7, 12],
      ['altar', 0, -15],
    ],
  },
  {
    id: 'rooftop', place: 'the Storm Rooftop', name: 'THE STORM ROOFTOP', sub: 'Lightning strikes the red circles',
    bg: 0x161c24, fog: [35, 85], hemi: [0x8aa0c0, 0x202830, 0.95], sun: [0xa8c0ff, 1.7],
    floor: paintRooftop, wall: 0x5a5f66, wallH: 1.0, post: 0x3a3e44, lamp: 0xff2020,
    centre: 'helipad', particles: 'rain', hazard: 'lightning',
    obstacles: [
      ['ac', -8, -6], ['ac', 9, 7], ['ac', -10, 9], ['ac', 11, -8],
      ['vent', 0, 11], ['vent', 0, -11], ['vent', 13.5, 1], ['vent', -13.5, -1],
      ['tank', 13, 13], ['tank', -13, -13],
    ],
  },
];
export const ARENA_NAMES = THEMES.map((t) => t.name);

// ---------------------------------------------------------------------------------------
export function createArena(scene, env) {
  const IS_SMALL = Math.min(window.innerWidth, window.innerHeight) < 600 || 'ontouchstart' in window;
  const obstacles = [];   // circles {x, z, r} that characters can't walk through
  let group = null;       // everything belonging to the current arena (swapped on change)
  let theme = THEMES[0];
  let loop = 0;
  let cracks = [];        // lava strips {x, z, len, ang, mat}
  let icePatches = [];    // {x, z, r}
  let particles = null;   // embers / snow / rain
  let animated = [];      // little things that spin or blink
  let hazardTick = 0;
  let strike = null;      // the next lightning strike {pos, time}
  let strikeTimer = 4;
  let flash = 0;
  const bolt = makeBolt();
  scene.add(bolt.group);

  function build(index, newLoop) {
    if (group) disposeGroup(scene, group);
    theme = THEMES[index];
    loop = newLoop;
    group = new THREE.Group();
    group.name = 'arena-' + theme.id;
    obstacles.length = 0;
    cracks = [];
    icePatches = [];
    animated = [];
    particles = null;
    strike = null;
    strikeTimer = 3.5;
    hazardTick = 0;
    bolt.group.visible = false;

    // sky, fog and lights (with a red tint on the harder loops)
    const tint = new THREE.Color(0xff5a48);
    const k = Math.min(0.45, loop * 0.28);
    const mix = (hex) => new THREE.Color(hex).lerp(tint, k);
    const bg = new THREE.Color(theme.bg).lerp(new THREE.Color(0x2a0606), k);
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, theme.fog[0], theme.fog[1]);
    env.hemi.color.copy(mix(theme.hemi[0]));
    env.hemi.groundColor.copy(mix(theme.hemi[1]));
    env.hemi.intensity = theme.hemi[2];
    env.sun.color.copy(mix(theme.sun[0]));
    env.sun.intensity = theme.sun[1];
    env.baseHemi = theme.hemi[2];

    // floor
    const tex = new THREE.CanvasTexture(makeCanvas(theme.floor));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2 + 4, ARENA_HALF * 2 + 4), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    buildCentre(theme.centre);
    buildWalls();
    const B = new Builders(group, IS_SMALL);
    for (const [kind, x, z] of theme.obstacles) {
      const r = B[kind](x, z, theme, animated);
      obstacles.push({ x, z, r });
    }
    if (theme.cracks) for (const [x, z, len, ang] of theme.cracks) cracks.push(B.crack(x, z, len, ang));
    if (theme.ice) for (const [x, z, r] of theme.ice) { B.icePatch(x, z, r); icePatches.push({ x, z, r }); }
    if (theme.particles) { particles = makeParticles(theme.particles, IS_SMALL ? 110 : 220); group.add(particles.obj); }
    scene.add(group);
  }

  function buildCentre(kind) {
    const flat = (mesh, y = 0.01) => { mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; group.add(mesh); return mesh; };
    if (kind === 'hazardRing') {
      const yel = new THREE.MeshBasicMaterial({ color: 0xd9a21b }), blk = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
      for (let i = 0; i < 24; i++) flat(new THREE.Mesh(new THREE.RingGeometry(3.3, 3.8, 3, 1, (i / 24) * Math.PI * 2, Math.PI / 12), i % 2 ? yel : blk));
      flat(new THREE.Mesh(new THREE.CircleGeometry(1.1, 6), new THREE.MeshBasicMaterial({ color: 0x0f3b38 })), 0.012);
    } else if (kind === 'grate') {
      flat(new THREE.Mesh(new THREE.RingGeometry(3.0, 3.6, 8), new THREE.MeshBasicMaterial({ color: 0x2a1a14 })));
      const glow = flat(new THREE.Mesh(new THREE.CircleGeometry(1.3, 8), new THREE.MeshBasicMaterial({ color: 0x8a2a08 })), 0.012);
      animated.push((t) => glow.material.color.setRGB(0.5 + 0.12 * Math.sin(t * 2), 0.16, 0.03));
    } else if (kind === 'frostRing') {
      flat(new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 40), new THREE.MeshBasicMaterial({ color: 0x7fb8d8, transparent: true, opacity: 0.6 })));
      flat(new THREE.Mesh(new THREE.CircleGeometry(1.0, 6), new THREE.MeshBasicMaterial({ color: 0x2f5f7a })), 0.012);
    } else if (kind === 'roseWindow') {
      const ring = new THREE.Group();
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
      const pink = new THREE.MeshBasicMaterial({ color: 0xff3cac }), cyan = new THREE.MeshBasicMaterial({ color: 0x3cf0ff });
      ring.add(new THREE.Mesh(new THREE.RingGeometry(3.6, 3.85, 48), pink));
      ring.add(new THREE.Mesh(new THREE.RingGeometry(1.4, 1.55, 32), cyan));
      for (let i = 0; i < 8; i++) {
        const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.1), i % 2 ? pink : cyan);
        const a = (i / 8) * Math.PI * 2;
        spoke.position.set(Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0);
        spoke.rotation.z = a + Math.PI / 2;
        ring.add(spoke);
      }
      group.add(ring);
      animated.push((t, dt) => { ring.rotation.z += dt * 0.15; });
    } else if (kind === 'helipad') {
      flat(new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 40), new THREE.MeshBasicMaterial({ color: 0xd8c040 })));
      const h = new THREE.MeshBasicMaterial({ color: 0xd8d8d0 });
      for (const [w, d, x] of [[0.4, 2.6, -0.8], [0.4, 2.6, 0.8], [1.6, 0.4, 0]]) {
        const m = flat(new THREE.Mesh(new THREE.PlaneGeometry(w, d), h), 0.012);
        m.position.x = x;
      }
    }
  }

  function buildWalls() {
    const wallMat = new THREE.MeshLambertMaterial({ color: theme.wall });
    const postMat = new THREE.MeshLambertMaterial({ color: theme.post });
    const lampMat = new THREE.MeshBasicMaterial({ color: theme.lamp });
    const len = ARENA_HALF * 2 + 4, H = theme.wallH;
    for (const [x, z, w, d] of [[0, -(ARENA_HALF + 1.5), len, 0.5], [0, ARENA_HALF + 1.5, len, 0.5], [-(ARENA_HALF + 1.5), 0, 0.5, len], [ARENA_HALF + 1.5, 0, 0.5, len]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      wall.position.set(x, H / 2, z);
      wall.receiveShadow = true;
      group.add(wall);
    }
    const postGeo = new THREE.BoxGeometry(0.35, H + 0.6, 0.35), lampGeo = new THREE.BoxGeometry(0.3, 0.2, 0.3);
    const lamps = [];
    for (let i = -ARENA_HALF; i <= ARENA_HALF; i += 6) {
      for (const [x, z] of [[i, -(ARENA_HALF + 1.5)], [i, ARENA_HALF + 1.5], [-(ARENA_HALF + 1.5), i], [ARENA_HALF + 1.5, i]]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, (H + 0.6) / 2, z);
        group.add(post);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(x, H + 0.65, z);
        group.add(lamp);
        lamps.push(lamp);
      }
    }
    if (theme.id === 'rooftop') animated.push((t) => { lampMat.color.setHex(Math.sin(t * 3) > 0.3 ? 0xff2020 : 0x401010); }); // aircraft lights
    if (theme.id === 'cathedral') {
      // neon strips along the top of the walls
      const strip = new THREE.MeshBasicMaterial({ color: 0x3cf0ff });
      for (const [x, z, w, d] of [[0, -(ARENA_HALF + 1.2), len, 0.08], [0, ARENA_HALF + 1.2, len, 0.08], [-(ARENA_HALF + 1.2), 0, 0.08, len], [ARENA_HALF + 1.2, 0, 0.08, len]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), strip);
        m.position.set(x, H - 0.3, z);
        group.add(m);
      }
    }
  }

  const loopMult = () => 1 + 0.25 * loop; // hazards hit harder on later loops

  function inCrack(pos, pad) {
    for (const c of cracks) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const along = dx * Math.sin(c.ang) + dz * Math.cos(c.ang);
      const side = dx * Math.cos(c.ang) - dz * Math.sin(c.ang);
      if (Math.abs(along) < c.len / 2 && Math.abs(side) < 0.45 + pad) return true;
    }
    return false;
  }

  function isClear(pos, radius) {
    const limit = ARENA_HALF - radius;
    if (Math.abs(pos.x) > limit || Math.abs(pos.z) > limit) return false;
    for (const o of obstacles) if (Math.hypot(pos.x - o.x, pos.z - o.z) < o.r + radius + 0.2) return false;
    return true;
  }

  const api = {
    obstacles,
    get current() { return { index: THEMES.indexOf(theme), loop, name: theme.name, sub: theme.sub, id: theme.id, place: theme.place }; },

    setTheme(index, newLoop = 0) { build(index, newLoop); },

    // Push a character (position + radius) out of obstacles and keep it inside the walls
    resolve(pos, radius) {
      for (const o of obstacles) {
        const dx = pos.x - o.x, dz = pos.z - o.z;
        const dist = Math.hypot(dx, dz);
        const minDist = o.r + radius;
        if (dist < minDist) {
          if (dist > 0.0001) {
            const push = (minDist - dist) / dist;
            pos.x += dx * push;
            pos.z += dz * push;
          } else pos.x += minDist; // exactly on the centre: shove sideways
        }
      }
      const limit = ARENA_HALF - radius;
      pos.x = Math.max(-limit, Math.min(limit, pos.x));
      pos.z = Math.max(-limit, Math.min(limit, pos.z));
    },

    isClear,

    // The nearest spot to `pos` where something of size `radius` fits (spirals outwards)
    findClearSpot(pos, radius) {
      const p = pos.clone().setY(0);
      const limit = ARENA_HALF - radius - 0.2;
      p.x = Math.max(-limit, Math.min(limit, p.x));
      p.z = Math.max(-limit, Math.min(limit, p.z));
      if (isClear(p, radius) && !inCrack(p, radius)) return p;
      for (let ring = 1; ring <= 12; ring++) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const c = new THREE.Vector3(p.x + Math.cos(a) * ring * 0.9, 0, p.z + Math.sin(a) * ring * 0.9);
          if (isClear(c, radius) && !inCrack(c, radius)) return c;
        }
      }
      return new THREE.Vector3();
    },

    // Pick a random spot near the arena edge that isn't too close to the player or inside anything
    randomSpawnPoint(playerPos, minDist = 9) {
      for (let tries = 0; tries < 24; tries++) {
        const along = (Math.random() * 2 - 1) * (ARENA_HALF - 2);
        const edge = ARENA_HALF - 1.5;
        const side = Math.floor(Math.random() * 4);
        const x = side < 2 ? along : side === 2 ? -edge : edge;
        const z = side === 0 ? -edge : side === 1 ? edge : along;
        const farEnough = Math.hypot(x - playerPos.x, z - playerPos.z) > minDist;
        const blocked = obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1);
        if (farEnough && !blocked) return new THREE.Vector3(x, 0, z);
      }
      return api.findClearSpot(new THREE.Vector3(-playerPos.x || 10, 0, -playerPos.z || 10), 0.8); // fallback: opposite side
    },

    // 'ice' when standing on an ice patch, otherwise 'ground'
    surfaceAt(x, z) {
      for (const p of icePatches) if (Math.hypot(x - p.x, z - p.z) < p.r) return 'ice';
      return 'ground';
    },

    // Hazards, particles and little animations. dt is already slowed down by slow-mo.
    update(dt, player, world, active = true) {
      const t = performance.now() / 1000;
      for (const fn of animated) fn(t, dt);
      if (particles) particles.update(dt, player.position);
      for (const c of cracks) c.mat.color.setRGB(1, 0.32 + 0.12 * Math.sin(t * 3 + c.x), 0.05);

      // lightning flash fades out
      if (flash > 0) {
        flash -= dt;
        world.env.hemi.intensity = world.env.baseHemi + Math.max(0, flash) * 12;
        bolt.group.visible = flash > 0.08;
        if (flash <= 0) world.env.hemi.intensity = world.env.baseHemi;
      }
      if (!active || player.dead) return;

      // lava cracks: 4 damage every half second while you stand in them
      if (theme.hazard === 'lava') {
        hazardTick -= dt;
        if (hazardTick <= 0 && inCrack(player.position, player.radius * 0.5)) {
          hazardTick = 0.5;
          player.takeDamage(4 * loopMult(), { killerName: 'the molten cracks' }, { hazard: true });
          world.effects.spawnSparks(player.position.clone().setY(0.3), 0xff8a2a, 5, 4);
          world.sfx('sizzle');
        }
      }

      // lightning: a red circle near you fills up, then the bolt lands
      if (theme.hazard === 'lightning') {
        if (!strike) {
          strikeTimer -= dt;
          if (strikeTimer <= 0) {
            const p = player.position;
            const a = Math.random() * Math.PI * 2, d = Math.random() < 0.4 ? 0 : 2 + Math.random() * 4;
            const pos = api.findClearSpot(new THREE.Vector3(p.x + Math.cos(a) * d, 0, p.z + Math.sin(a) * d), 0.5);
            strike = { pos, time: 1.4 };
            world.effects.spawnWarning(pos, 2.2, 1.4);
          }
        } else {
          strike.time -= dt;
          if (strike.time <= 0) {
            const pos = strike.pos;
            strike = null;
            strikeTimer = 4 + Math.random() * 3;
            if (player.position.distanceTo(pos) < 2.2 + player.radius) {
              player.takeDamage(16 * loopMult(), { killerName: 'a lightning strike' }, { hazard: true });
            }
            for (const e of world.enemies.list) {
              if (e.canBeHit && !e.isBoss && e.position.distanceTo(pos) < 2.2 + e.radius) e.hit(40, 0, 0, true);
            }
            bolt.strike(pos);
            flash = 0.22;
            world.effects.spawnRing(pos, 0xbfe8ff, 3, 0.4);
            world.effects.spawnSparks(pos.clone().setY(0.3), 0xdff4ff, 12, 9);
            world.shake(0.35);
            world.sfx('thunder');
          }
        }
      }
    },
  };
  build(0, 0);
  return api;
}

// ---------------------------------------------------------------------------------------
// Obstacle builders. Each one adds meshes to the arena group and returns the collision radius.
class Builders {
  constructor(group, small) {
    this.g = group;
    this.small = small;
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.mats = new Map();
  }
  mat(hex, basic = false) {
    const key = hex + (basic ? 'b' : 'l');
    if (!this.mats.has(key)) this.mats.set(key, basic ? new THREE.MeshBasicMaterial({ color: hex }) : new THREE.MeshLambertMaterial({ color: hex }));
    return this.mats.get(key);
  }
  add(mesh, x, y, z, shadow = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.g.add(mesh);
    return mesh;
  }
  cube(hex, w, h, d, x, y, z, shadow = true, basic = false) {
    const m = this.add(new THREE.Mesh(this.box, this.mat(hex, basic)), x, y, z, shadow);
    m.scale.set(w, h, d);
    return m;
  }
  cyl(hex, rt, rb, h, x, y, z, seg = 10, shadow = true, basic = false) {
    return this.add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), this.mat(hex, basic)), x, y, z, shadow);
  }

  // --- Slag Yard ---
  stack(x, z) {
    this.cyl(0x4a4440, 0.85, 1.05, 3.4, x, 1.7, z);
    for (const y of [1.0, 2.6]) this.cyl(0xa8481c, 0.92, 0.92, 0.3, x, y, z, 10, false);
    return 1.05;
  }
  heap(x, z) {
    const cols = [0x7a4a2a, 0x55524d, 0x8c6a3a, 0x3d4a46];
    for (let i = 0; i < 6; i++) {
      const s = 0.6 + ((i * 37) % 10) / 14;
      const j = this.cube(cols[i % 4], s * 1.3, s * 0.7, s, x + Math.sin(i * 2.1) * 0.5, 0.3 + (i % 3) * 0.45, z + Math.cos(i * 1.7) * 0.5);
      j.rotation.set(i * 0.4, i * 1.1, i * 0.3);
    }
    return 1.25;
  }
  barrel(x, z) { this.cyl(0xc0561e, 0.45, 0.45, 1.1, x, 0.55, z); return 0.6; }

  // --- Molten Foundry ---
  crucible(x, z, theme, animated) {
    this.cyl(0x2e2a28, 1.2, 0.95, 1.6, x, 0.8, z, 12);
    this.cyl(0x4a2a1a, 1.28, 1.28, 0.18, x, 1.6, z, 12, false);
    const melt = this.cyl(0xff6a10, 1.08, 1.08, 0.05, x, 1.72, z, 12, false, true);
    animated.push((t) => melt.material.color.setRGB(1, 0.42 + 0.1 * Math.sin(t * 4 + x), 0.06));
    for (const a of [0, Math.PI]) this.cube(0x1a1716, 0.18, 1.2, 0.18, x + Math.cos(a) * 1.3, 0.6, z + Math.sin(a) * 1.3);
    return 1.35;
  }
  anvil(x, z) {
    this.cube(0x2a2624, 0.9, 0.6, 0.7, x, 0.3, z);
    this.cube(0x3a3532, 0.5, 0.35, 0.5, x, 0.78, z);
    this.cube(0x4a4440, 1.5, 0.32, 0.8, x, 1.1, z);
    this.cube(0xff7a2a, 1.3, 0.04, 0.6, x, 1.27, z, false, true); // glowing hot workpiece
    return 0.95;
  }
  crack(x, z, len, ang) {
    // a jagged zigzag: black crust, orange glow, yellow-hot core
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a10 });
    const core = this.mat(0xffd060, true);
    const crust = this.mat(0x120a08);
    const n = 5, seg = len / n;
    const dirX = Math.sin(ang), dirZ = Math.cos(ang), sideX = Math.cos(ang), sideZ = -Math.sin(ang);
    let prev = { a: -len / 2, s: 0 };
    for (let i = 1; i <= n; i++) {
      const next = { a: -len / 2 + i * seg, s: i === n ? 0 : ((i * 7919) % 5 - 2) * 0.12 };
      const ax = x + dirX * prev.a + sideX * prev.s, az = z + dirZ * prev.a + sideZ * prev.s;
      const bx = x + dirX * next.a + sideX * next.s, bz = z + dirZ * next.a + sideZ * next.s;
      const l = Math.hypot(bx - ax, bz - az) + 0.12, r = Math.atan2(bx - ax, bz - az);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      for (const [m, w, y] of [[crust, 1.05, 0.012], [mat, 0.62, 0.02], [core, 0.22, 0.028]]) {
        const p = this.add(new THREE.Mesh(this.box, m), mx, y, mz, false);
        p.scale.set(w, 0.02, l + (m === crust ? 0.25 : 0));
        p.rotation.y = r;
      }
      prev = next;
    }
    return { x, z, len, ang, mat };
  }

  // --- Frozen Scrap Tundra ---
  ice(x, z) {
    const m = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 4; i++) {
      const s = 0.9 + (i % 2) * 0.4;
      const b = this.add(new THREE.Mesh(this.box, m), x + Math.sin(i * 2.4) * 0.5, s * 0.6, z + Math.cos(i * 2.4) * 0.5);
      b.scale.set(s, s * 1.4 + i * 0.2, s * 0.9);
      b.rotation.set(0.1 * i, i * 0.8, 0.15);
    }
    return 1.25;
  }
  wreck(x, z) {
    // a frozen, snowed-over scrap hauler
    const body = this.cube(0x5a4a3e, 2.6, 1.0, 1.4, x, 0.6, z);
    body.rotation.y = 0.4;
    const cab = this.cube(0x4a3e34, 1.0, 0.8, 1.3, x + Math.cos(0.4) * 0.9, 1.4, z - Math.sin(0.4) * 0.9);
    cab.rotation.y = 0.4;
    const snow = this.cube(0xf2f8ff, 2.7, 0.18, 1.5, x, 1.15, z, false);
    snow.rotation.y = 0.4;
    return 1.45;
  }
  spire(x, z) {
    this.cyl(0x4f5a62, 0.55, 0.75, 2.6, x, 1.3, z, 8);
    this.cyl(0xf2f8ff, 0.62, 0.62, 0.22, x, 2.7, z, 8, false);
    const icicle = this.add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 6), this.mat(0xcff0ff)), x + 0.4, 2.2, z, false);
    icicle.rotation.x = Math.PI;
    return 0.8;
  }
  icePatch(x, z, r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshPhongMaterial({ color: 0xa8dcf8, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    this.add(m, x, 0.02, z, false);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r - 0.08, r, 24), this.mat(0xffffff, true));
    rim.rotation.x = -Math.PI / 2;
    this.add(rim, x, 0.025, z, false);
  }

  // --- Neon Rust Cathedral ---
  pillar(x, z, theme, animated) {
    this.cube(0x5a5068, 1.5, 0.4, 1.5, x, 0.2, z);
    this.cyl(0x6e6480, 0.7, 0.75, 4.6, x, 2.5, z, 8);
    this.cube(0x5a5068, 1.4, 0.35, 1.4, x, 4.9, z);
    for (const y of [1.2, 3.6]) this.cyl(0x7a4a32, 0.78, 0.78, 0.18, x, y, z, 8, false); // rusted iron bands
    const col = (Math.abs(x) + z) % 2 ? 0xff3cac : 0x3cf0ff;
    const neon = this.mat(col, true);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const s = this.add(new THREE.Mesh(this.box, neon), x + Math.sin(a) * 0.74, 2.5, z + Math.cos(a) * 0.74, false);
      s.scale.set(0.07, 3.6, 0.07);
    }
    return 0.95;
  }
  altar(x, z) {
    this.cube(0x5a5068, 3.0, 1.0, 1.4, x, 0.5, z);
    this.cube(0x7a6e8c, 3.2, 0.12, 1.6, x, 1.06, z, false);
    this.cube(0xff3cac, 0.12, 1.6, 0.12, x, 1.9, z, false, true); // neon cross
    this.cube(0xff3cac, 0.9, 0.12, 0.12, x, 2.2, z, false, true);
    return 1.6;
  }

  // --- Storm Rooftop ---
  ac(x, z, theme, animated) {
    this.cube(0x8a9098, 2.0, 1.2, 1.5, x, 0.6, z);
    this.cube(0x5a6068, 2.05, 0.1, 1.55, x, 1.22, z, false);
    const fan = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 6), this.mat(0x2a2e34)), x, 1.3, z, false);
    animated.push((t, dt) => { fan.rotation.y += dt * 8; });
    return 1.2;
  }
  vent(x, z) {
    this.cyl(0x6a7078, 0.4, 0.45, 1.3, x, 0.65, z, 8);
    this.cyl(0x4a5058, 0.6, 0.4, 0.3, x, 1.45, z, 8, false);
    return 0.6;
  }
  tank(x, z) {
    for (const [dx, dz] of [[0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) this.cube(0x2a2e34, 0.18, 2.0, 0.18, x + dx, 1.0, z + dz);
    this.cyl(0x7a5a3a, 1.35, 1.35, 1.8, x, 2.9, z, 12);
    this.add(new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.6, 12), this.mat(0x5a4028)), x, 4.1, z);
    return 1.6;
  }
}

// ---------------------------------------------------------------------------------------
// Lightning bolt: a zigzag of thin glowing boxes from the sky to the ground
function makeBolt() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xe8f6ff });
  const segs = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.18), mat);
    group.add(m);
    segs.push(m);
  }
  group.visible = false;
  return {
    group,
    strike(pos) {
      let prev = new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3, 16, pos.z + (Math.random() - 0.5) * 3);
      for (let i = 0; i < segs.length; i++) {
        const k = (i + 1) / segs.length;
        const next = i === segs.length - 1 ? pos.clone() : new THREE.Vector3(
          pos.x + (prev.x - pos.x) * 0.6 + (Math.random() - 0.5) * 1.6, 16 * (1 - k), pos.z + (prev.z - pos.z) * 0.6 + (Math.random() - 0.5) * 1.6);
        const m = segs[i];
        m.position.copy(prev).add(next).multiplyScalar(0.5);
        m.scale.y = prev.distanceTo(next);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), next.clone().sub(prev).normalize());
        prev = next;
      }
      group.visible = true;
    },
  };
}

// Embers (rise), snow (drifts down), motes (float) or rain (falls fast) around the player
function makeParticles(kind, count) {
  const area = 22, top = 12;
  const pos = new Float32Array(count * (kind === 'rain' ? 6 : 3));
  const rnd = (i) => {
    const x = (Math.random() * 2 - 1) * area, y = Math.random() * top, z = (Math.random() * 2 - 1) * area;
    if (kind === 'rain') pos.set([x, y, z, x - 0.08, y - 0.7, z - 0.08], i * 6);
    else pos.set([x, y, z], i * 3);
  };
  for (let i = 0; i < count; i++) rnd(i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let obj;
  if (kind === 'rain') {
    obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9ab4d0, transparent: true, opacity: 0.45 }));
  } else {
    const color = { embers: 0xff8a2a, snow: 0xffffff, motes: 0xc890ff }[kind];
    const size = { embers: 0.14, snow: 0.16, motes: 0.1 }[kind];
    obj = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false }));
  }
  obj.frustumCulled = false;
  const vy = { embers: 1.4, snow: -1.2, motes: 0.25, rain: -22 }[kind];
  return {
    obj,
    update(dt, centre) {
      obj.position.set(Math.round(centre.x / 4) * 4, 0, Math.round(centre.z / 4) * 4);
      const stride = kind === 'rain' ? 6 : 3;
      const t = performance.now() / 1000;
      for (let i = 0; i < count; i++) {
        const o = i * stride;
        const dy = vy * dt * (kind === 'rain' ? 1 : 0.7 + (i % 5) * 0.12);
        pos[o + 1] += dy;
        if (kind !== 'rain') { pos[o] += Math.sin(t + i) * 0.3 * dt; }
        else pos[o + 4] += dy;
        if (pos[o + 1] < 0 || pos[o + 1] > top) {
          const y = vy > 0 ? 0 : top;
          pos[o + 1] = y;
          if (kind === 'rain') pos[o + 4] = y - 0.7;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function disposeGroup(scene, group) {
  scene.remove(group);
  const seen = new Set();
  group.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

// ---------------------------------------------------------------------------------------
// Floor textures: each is drawn on a little 128x128 canvas and tiled.
function makeCanvas(paint) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  paint(c.getContext('2d'));
  return c;
}
function speckle(g, n, base, spread, tint = [10, 2, -8], size = 2) {
  for (let i = 0; i < n; i++) {
    const v = base + Math.floor(Math.random() * spread);
    g.fillStyle = `rgb(${v + tint[0]},${v + tint[1]},${v + tint[2]})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, size, size);
  }
}
function paintSlag(g) {
  g.fillStyle = '#5a534b'; g.fillRect(0, 0, 128, 128);
  speckle(g, 500, 75, 28);
  g.fillStyle = 'rgba(30,25,20,0.25)';
  g.beginPath(); g.ellipse(88, 40, 18, 11, 0.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3e3832'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  g.lineWidth = 1.5; g.beginPath();
  g.moveTo(10, 70); g.lineTo(30, 64); g.lineTo(42, 80); g.lineTo(60, 76);
  g.moveTo(100, 100); g.lineTo(108, 112); g.lineTo(122, 116);
  g.stroke();
}
function paintFoundry(g) {
  g.fillStyle = '#3c3836'; g.fillRect(0, 0, 128, 128);
  speckle(g, 450, 50, 22, [6, 2, 0]);
  // iron floor plates with rivets
  g.strokeStyle = '#211d1b'; g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  g.fillStyle = '#5c544e';
  for (const x of [7, 121]) for (const y of [7, 64, 121]) g.fillRect(x - 2, y - 2, 4, 4);
  g.fillStyle = 'rgba(20,14,10,0.3)'; // soot
  g.beginPath(); g.ellipse(80, 90, 22, 12, 0.5, 0, Math.PI * 2); g.fill();
}
function paintTundra(g) {
  g.fillStyle = '#dce8f0'; g.fillRect(0, 0, 128, 128);
  speckle(g, 500, 200, 40, [0, 6, 14]);
  g.fillStyle = 'rgba(90,110,130,0.18)';
  g.beginPath(); g.ellipse(40, 90, 20, 8, 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(70,60,50,0.35)'; // bits of scrap poking through the snow
  g.fillRect(96, 30, 10, 3); g.fillRect(20, 20, 4, 4);
}
function paintCathedral(g) {
  g.fillStyle = '#3a3346'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#463e54'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); // checker flagstones
  speckle(g, 300, 52, 20, [4, 0, 12]);
  g.strokeStyle = '#1e1a26'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  g.strokeStyle = 'rgba(120,60,40,0.4)'; g.lineWidth = 1.5; // rust streaks
  g.beginPath(); g.moveTo(80, 10); g.lineTo(84, 40); g.moveTo(14, 80); g.lineTo(20, 110); g.stroke();
}
function paintRooftop(g) {
  g.fillStyle = '#2a2d31'; g.fillRect(0, 0, 128, 128);
  speckle(g, 700, 38, 26, [0, 2, 6], 1.5); // gravel
  g.fillStyle = 'rgba(120,140,160,0.18)'; // puddles
  g.beginPath(); g.ellipse(36, 44, 16, 9, 0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(100, 100, 10, 6, -0.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1c1e22'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
}
