/**
 * guus-3d.js — Lancia Delta clay model, scroll- en muisgestuurd.
 *
 * Gebruik (zie webflow-snippet.html):
 *   import { initCar } from '.../guus-3d.js';
 *   initCar({ model: '.../lancia-delta.glb' });
 *
 * Levert een fixed canvas achter je content. Zet je Webflow-secties op
 * position:relative + z-index:1, anders valt de auto erachter.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE    = matchMedia('(hover: hover) and (pointer: fine)').matches;

const DEFAULTS = {
  model:     null,        // verplicht: URL naar de .glb
  mount:     null,        // element of selector; leeg = fixed laag op <body>
  color:     0xb2b2ae,
  roughness: 0.60,
  crease:    34,          // graden — hieronder glad, erboven harde rand
  reveal:    true,        // true, false, of { scatter, spread, scale, fade, duration }
  drag:      true,
  zIndex:    0,
  // scrollchoreografie. p = 0 bovenaan, 1 onderaan de pagina.
  // panX verschuift de auto zijwaarts zodat je tekst er niet overheen valt.
  // Let op: staan er [data-car-slot] elementen op de pagina, dan bepalen die
  // de positie en wordt panX genegeerd. rot/dist/camY/lookY blijven wel gelden.
  keys: [
    { p: 0.00, rot: 0.62, dist: 7.00, camY: 1.05, lookY: 0.95, panX:  0.00 },
    { p: 0.25, rot: 1.62, dist: 7.60, camY: 0.78, lookY: 0.62, panX: -0.80 },
    { p: 0.50, rot: 2.55, dist: 6.90, camY: 1.35, lookY: 0.72, panX:  0.80 },
    { p: 0.75, rot: 3.80, dist: 6.50, camY: 0.72, lookY: 0.58, panX: -0.75 },
    { p: 1.00, rot: 4.55, dist: 7.40, camY: 1.45, lookY: 1.35, panX:  0.00 }
  ]
};

/* reveal-defaults. scatter = hoe ver een vlak langs zijn normaal naar buiten
   start (meters), spread = hoe ver de wolk vanuit het midden uitzet,
   scale = beginformaat van elk vlak, fade = over welk deel van zijn eigen
   animatie het vlak van alpha 0 naar 1 gaat. */
const REVEAL_DEFAULTS = { scatter: 0.16, spread: 1.03, scale: 0.62, fade: 0.40, duration: 1750 };

/* exponentiële damping: zelfde gevoel op 60Hz en 144Hz, anders dan een per-frame lerp */
const damp = (cur, tgt, lambda, dt) => tgt + (cur - tgt) * Math.exp(-lambda * dt);
const ease = t => t * t * (3 - 2 * t);

/* ---------------------------------------------------------------- geometrie */
/**
 * Normaliseert wat de GLTFLoader ook teruggeeft — gekwantiseerd, meshopt of
 * kaal — naar één non-indexed float-geometry met crease-normalen, plus de
 * per-driehoek attributen die de reveal-shader nodig heeft.
 */
function prepare(srcMesh, creaseDeg) {
  srcMesh.updateWorldMatrix(true, false);
  const g = srcMesh.geometry;
  const srcPos = g.attributes.position;

  // node-transform inbakken zodat we in echte meters werken
  const P0 = new Float32Array(srcPos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < srcPos.count; i++) {
    v.fromBufferAttribute(srcPos, i).applyMatrix4(srcMesh.matrixWorld);
    v.toArray(P0, i * 3);
  }

  const idx = g.index ? g.index.array
                      : Uint32Array.from({ length: srcPos.count }, (_, i) => i);
  const nt = idx.length / 3;

  // centreren op x/z, banden op y = 0
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mnz = Infinity, mxz = -Infinity;
  for (let i = 0; i < P0.length; i += 3) {
    if (P0[i]   < mnx) mnx = P0[i];    if (P0[i]   > mxx) mxx = P0[i];
    if (P0[i+1] < mny) mny = P0[i+1];
    if (P0[i+2] < mnz) mnz = P0[i+2];  if (P0[i+2] > mxz) mxz = P0[i+2];
  }
  const ox = (mnx + mxx) / 2, oy = mny, oz = (mnz + mxz) / 2;
  for (let i = 0; i < P0.length; i += 3) { P0[i] -= ox; P0[i+1] -= oy; P0[i+2] -= oz; }

  // vlaknormalen (oppervlakte-gewogen) opsommen per punt
  const acc = new Float32Array(srcPos.count * 3), fn = new Float32Array(nt * 3);
  for (let i = 0; i < nt; i++) {
    const a = idx[i*3]*3, b = idx[i*3+1]*3, c = idx[i*3+2]*3;
    const e1x = P0[b]-P0[a], e1y = P0[b+1]-P0[a+1], e1z = P0[b+2]-P0[a+2];
    const e2x = P0[c]-P0[a], e2y = P0[c+1]-P0[a+1], e2z = P0[c+2]-P0[a+2];
    const nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
    fn[i*3] = nx; fn[i*3+1] = ny; fn[i*3+2] = nz;
    acc[a]+=nx; acc[a+1]+=ny; acc[a+2]+=nz;
    acc[b]+=nx; acc[b+1]+=ny; acc[b+2]+=nz;
    acc[c]+=nx; acc[c+1]+=ny; acc[c+2]+=nz;
  }
  for (let i = 0; i < srcPos.count; i++) {
    const l = Math.hypot(acc[i*3], acc[i*3+1], acc[i*3+2]) || 1;
    acc[i*3] /= l; acc[i*3+1] /= l; acc[i*3+2] /= l;
  }

  // uitpakken naar non-indexed; per hoek glad óf hard, afhankelijk van de hoek
  const cosT = Math.cos(creaseDeg * Math.PI / 180);
  const P = new Float32Array(nt*9), N = new Float32Array(nt*9),
        C = new Float32Array(nt*9), D = new Float32Array(nt*3);
  const zLo = mnz - oz, zSpan = (mxz - mnz) || 1;

  for (let i = 0; i < nt; i++) {
    const o = i*9;
    const fl = Math.hypot(fn[i*3], fn[i*3+1], fn[i*3+2]) || 1;
    const fx = fn[i*3]/fl, fy = fn[i*3+1]/fl, fz = fn[i*3+2]/fl;
    for (let k = 0; k < 3; k++) {
      const s = idx[i*3+k]*3, t = o + k*3;
      P[t] = P0[s]; P[t+1] = P0[s+1]; P[t+2] = P0[s+2];
      const sx = acc[s], sy = acc[s+1], sz = acc[s+2];
      const smooth = fx*sx + fy*sy + fz*sz > cosT;
      N[t]   = smooth ? sx : fx;
      N[t+1] = smooth ? sy : fy;
      N[t+2] = smooth ? sz : fz;
    }
    // zwaartepunt + vertraging (achter → neus) voor de opbouw
    const gx = (P[o]+P[o+3]+P[o+6])/3,
          gy = (P[o+1]+P[o+4]+P[o+7])/3,
          gz = (P[o+2]+P[o+5]+P[o+8])/3;
    let d = (gz - zLo) / zSpan;
    d = Math.min(1, Math.max(0, d*0.80 + Math.random()*0.20));
    for (let k = 0; k < 3; k++) {
      C[o+k*3] = gx; C[o+k*3+1] = gy; C[o+k*3+2] = gz;
      D[i*3+k] = d;
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position',  new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal',    new THREE.BufferAttribute(N, 3));
  out.setAttribute('aCentroid', new THREE.BufferAttribute(C, 3));
  out.setAttribute('aDelay',    new THREE.BufferAttribute(D, 1));
  out.computeBoundingSphere();
  out.boundingSphere.radius *= 1.15;   // ruim, want tijdens de reveal steken vlakken uit
  return out;
}

/* ------------------------------------------------------------------ publiek */
export function initCar(userOpts = {}) {
  const opt = { ...DEFAULTS, ...userOpts };
  if (!opt.model) throw new Error('initCar: geen "model" URL opgegeven');

  const rev = opt.reveal
    ? { ...REVEAL_DEFAULTS, ...(opt.reveal === true ? {} : opt.reveal) }
    : null;

  let mount = opt.mount;
  if (typeof mount === 'string') mount = document.querySelector(mount);
  const owns = !mount;
  if (owns) {
    mount = document.createElement('div');
    // Handvat voor de site-JS: de nav schuift deze laag mee naar links als
    // het menu opent, anders blijft de auto over het menu heen staan.
    mount.setAttribute('data-car-layer', '');
    Object.assign(mount.style, {
      position: 'fixed', inset: '0', zIndex: String(opt.zIndex), pointerEvents: 'none'
    });
    document.body.appendChild(mount);
  }

  let W = mount.clientWidth || innerWidth, H = mount.clientHeight || innerHeight;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('guus-3d: geen WebGL, model overgeslagen', e);
    return { destroy() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.style.display = 'block';
  mount.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b8b2, 0.62));
  const key   = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(-4.5, 6, 5.5);
  const fill  = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(5.5, 1.6, 3.5);
  const rim   = new THREE.DirectionalLight(0xffffff, 0.85); rim.position.set(1.5, 3.2, -6.5);
  const under = new THREE.DirectionalLight(0xffffff, 0.22); under.position.set(0, -4, 1.5);
  scene.add(key, fill, rim, under);

  const cursorLight = new THREE.PointLight(0xffffff, 0.30, 16, 2);
  cursorLight.position.set(0, 2, 5);
  scene.add(cursorLight);

  const CLAY = new THREE.Color(opt.color), CLAY_HI = new THREE.Color(opt.color).offsetHSL(0, 0, 0.035);
  const mat = new THREE.MeshStandardMaterial({
    color: opt.color, roughness: opt.roughness, metalness: 0,
    emissive: 0xffffff, emissiveIntensity: 0
  });

  /* Elk vlak fadet in én groeit vanuit een licht naar buiten geduwde positie
     terug op z'n plek, van achterbumper naar neus.

     De fade gebeurt met een geditherde discard, niet met transparent:true.
     Reden: een transparant materiaal gaat naar de transparante queue en three
     sorteert daar per object, niet per driehoek — je kijkt dan dwars door de
     carrosserie heen. Met discard blijft het materiaal opaque, blijft de
     dieptetest kloppen, en dithert de alpha weg in screen space. Het patroon
     is interleaved gradient noise: fijner en minder klonterig dan een
     sin-hash, en stabiel per pixel dus het kruipt niet. */
  if (rev) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uReveal  = { value: REDUCED ? 1 : 0 };
      sh.uniforms.uSpan    = { value: 0.42 };
      sh.uniforms.uScale   = { value: rev.scale };
      sh.uniforms.uSpread  = { value: rev.spread };
      sh.uniforms.uScatter = { value: rev.scatter };
      sh.uniforms.uFade    = { value: rev.fade };
      sh.vertexShader =
        'attribute vec3 aCentroid;\nattribute float aDelay;\n' +
        'uniform float uReveal;\nuniform float uSpan;\nuniform float uScale;\n' +
        'uniform float uSpread;\nuniform float uScatter;\nvarying float vRev;\n' + sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
        'float rt = clamp((uReveal - aDelay*(1.0-uSpan))/uSpan, 0.0, 1.0);\n' +
        'float re = 1.0 - pow(1.0 - rt, 3.0);\n' +
        'vRev = re;\n' +
        'float rs = mix(uScale, 1.0, re);\n' +
        'vec3 rHome = mix(aCentroid*uSpread + normal*uScatter, aCentroid, re);\n' +
        'vec3 transformed = rHome + (position - aCentroid) * rs;');
      sh.fragmentShader = 'uniform float uFade;\nvarying float vRev;\n' + sh.fragmentShader;
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n' +
        'float rA = smoothstep(0.0, uFade, vRev);\n' +
        'if (rA < 0.999) {\n' +
        '  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\n' +
        '  if (rA < ign) discard;\n' +
        '}');
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n' +
        'float rEdge = smoothstep(0.10,0.55,vRev) * (1.0 - smoothstep(0.62,1.0,vRev));\n' +
        'gl_FragColor.rgb += rEdge*0.22;');
      mat.userData.sh = sh;
    };
  }

  /* ------------------------------------------------------------------ state */
  let car = null, raf = 0, dead = false;
  let mx = 0, my = 0, px = 0, py = 0;
  let scrollP = 0, scrollS = 0;
  let hoverT = 0, hover = 0;
  let dragging = false, dragVel = 0, dragSpin = 0, lastX = 0;
  let t0 = 0, lastT = performance.now();
  const intro = { rot: 0, dist: 0, camY: 0 };
  const INTRO  = REDUCED || !rev ? 0 : 2200;
  const REVEAL = REDUCED || !rev ? 0 : rev.duration;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), sphere = new THREE.Sphere();

  function sample(p) {
    const K = opt.keys;
    let i = 0;
    while (i < K.length - 2 && p > K[i+1].p) i++;
    const a = K[i], b = K[i+1];
    const t = ease(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
    return {
      rot:   a.rot   + (b.rot   - a.rot  ) * t,
      dist:  a.dist  + (b.dist  - a.dist ) * t,
      camY:  a.camY  + (b.camY  - a.camY ) * t,
      lookY: a.lookY + (b.lookY - a.lookY) * t,
      panX:  a.panX  + (b.panX  - a.panX ) * t
    };
  }

  /* ------------------------------------------------------------------ input */
  let cursor = '';
  const setCursor = v => { if (v !== cursor) { cursor = v; document.body.style.cursor = v; } };

  const onMove = e => {
    mx = (e.clientX / innerWidth)  * 2 - 1;
    my = (e.clientY / innerHeight) * 2 - 1;
    if (dragging) { dragVel += (e.clientX - lastX) * 0.0042; lastX = e.clientX; }
  };
  const onDown = e => {
    if (!car || !opt.drag || !FINE) return;
    ndc.set((e.clientX/innerWidth)*2-1, -((e.clientY/innerHeight)*2-1));
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(car, false).length) {
      dragging = true; lastX = e.clientX; dragVel = 0; setCursor('grabbing');
    }
  };
  const onUp = () => { dragging = false; setCursor(hoverT ? 'grab' : ''); };
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollP = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };

  /* ------------------------------------------------------------------ slots */
  /* Elk [data-car-slot] element is een doelvak. Staan er slots op de pagina,
     dan gaat de auto in het dichtstbijzijnde vak staan en scrollt hij ermee
     mee — hij blijft dus in die sectie achter in plaats van mee te reizen.
     Geen slots = de oude panX-choreografie over de hele pagina.

     Posities cachen: getBoundingClientRect per frame forceert een layout. */
  let slots = [];
  const measureSlots = () => {
    slots = [...document.querySelectorAll('[data-car-slot]')].map(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, left: r.left + scrollX, w: r.width, h: r.height };
    });
  };

  /* Actief slot = dat met zijn midden het dichtst bij het midden van het
     beeld. Liggen twee slots ver uit elkaar, dan wisselt de keuze terwijl
     de auto toch al buiten beeld is en zie je het omschakelen niet. */
  const activeSlot = () => {
    let best = null, bestD = Infinity;
    for (const s of slots) {
      const d = Math.abs(s.top + s.h / 2 - scrollY - H / 2);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  };

  const onResize = () => {
    W = mount.clientWidth || innerWidth; H = mount.clientHeight || innerHeight;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    measureSlots();
  };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown);
  addEventListener('pointerup',   onUp);
  addEventListener('scroll',      onScroll, { passive: true });
  addEventListener('resize',      onResize);
  addEventListener('load',        measureSlots);
  // ScrollTrigger-pins voegen spacers toe en verschuiven dus alles eronder.
  // Optioneel: draait de site zonder GSAP, dan slaan we dit over.
  window.ScrollTrigger?.addEventListener('refresh', measureSlots);
  onScroll();
  measureSlots();

  /* ------------------------------------------------------------------- loop */
  function tick() {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;

    if (t0) {
      const el = now - t0;
      const it = INTRO ? Math.min(1, el / INTRO) : 1;
      const ie = 1 - Math.pow(1 - it, 4);
      intro.rot  = (1 - ie) * -0.55;
      intro.dist = (1 - ie) *  2.30;
      intro.camY = (1 - ie) *  0.85;
      if (mat.userData.sh)
        mat.userData.sh.uniforms.uReveal.value =
          REVEAL ? Math.min(1, Math.max(0, (el - 140) / REVEAL)) : 1;
      if (it < 1) { camera.fov = 30 + (1 - ie) * 4.5; camera.updateProjectionMatrix(); }
      else if (camera.fov !== 30) { camera.fov = 30; camera.updateProjectionMatrix(); t0 = 0; }
    }

    // één hittest per frame, en alleen als de goedkope bolcheck slaagt
    if (FINE && car && !dragging) {
      ndc.set(mx, -my);
      ray.setFromCamera(ndc, camera);
      let hit = 0;
      if (ray.ray.intersectsSphere(sphere.copy(car.geometry.boundingSphere).applyMatrix4(car.matrixWorld)))
        hit = ray.intersectObject(car, false).length ? 1 : 0;
      if (hit !== hoverT) { hoverT = hit; setCursor(hit ? 'grab' : ''); }
    }

    scrollS = REDUCED ? scrollP : damp(scrollS, scrollP, 4.7, dt);
    px = REDUCED ? mx : damp(px, mx, 5.0, dt);
    py = REDUCED ? my : damp(py, my, 5.0, dt);
    hover = damp(hover, hoverT, 7.7, dt);

    const f = dt * 60;
    dragSpin += dragVel * f;
    dragVel  *= Math.exp((dragging ? -36 : -3.7) * dt);
    if (!dragging) dragSpin *= Math.exp(-0.9 * dt);

    const s = sample(scrollS);

    if (car) {
      const wobble = REDUCED ? 0 : Math.sin(now * 0.00035) * 0.018;
      car.rotation.y = s.rot + dragSpin + intro.rot + (REDUCED ? 0 : px * 0.22);
      car.rotation.x = (REDUCED ? 0 : py * 0.055) + wobble;
      car.rotation.z = REDUCED ? 0 : -px * 0.018;
      car.scale.setScalar(1 + hover * 0.012);
      car.position.y = -0.72 + hover * 0.02;
    }

    // smalle schermen: verder weg en niet pannen, anders valt hij uit beeld
    const narrow = Math.min(1, Math.max(0, (900 - W) / 420));
    const dist = s.dist * (1 + narrow * 0.30);

    // Waar de auto op het scherm hoort, in wereldunits. Een slot wint van
    // panX. We verplaatsen de camera de andere kant op: dat schuift de auto
    // naar het vak toe zonder het kijkhoekje te veranderen.
    let offX = s.panX * (1 - narrow), offY = 0;
    const slot = slots.length ? activeSlot() : null;
    if (slot) {
      const vExtent = (dist + intro.dist) * Math.tan(camera.fov * Math.PI / 360);
      const cx = ((slot.left - scrollX + slot.w / 2) / W) * 2 - 1;  // +1 = rechts
      const cy = -(((slot.top - scrollY + slot.h / 2) / H) * 2 - 1); // +1 = boven
      offX = -cx * vExtent * camera.aspect * (1 - narrow);
      offY = -cy * vExtent;
    }

    // Met een slot mikken we op het midden van de auto zélf in plaats van op
    // lookY uit de keys. Anders landt hij structureel onder het vak, want het
    // model hangt op y = -0.72. Het hoogteverschil camera/doel blijft gelijk,
    // dus de kijkhoek uit de keys verandert niet.
    let aimY = s.lookY;
    if (slot && car) {
      const bs = car.geometry.boundingSphere;
      aimY = car.position.y + (bs ? bs.center.y : 0);
    }

    camera.position.set(offX + (REDUCED ? 0 : px * 0.30),
                        aimY + (s.camY - s.lookY) + offY - (REDUCED ? 0 : py * 0.16) + intro.camY,
                        dist + intro.dist);
    camera.lookAt(offX, aimY + offY, 0);

    cursorLight.position.set(px * 7, -py * 4.5 + 2.2, 5.2);
    cursorLight.intensity = 0.30 + hover * 1.5;
    mat.emissiveIntensity = hover * 0.045;
    mat.color.copy(CLAY).lerp(CLAY_HI, hover);

    renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------------ laden */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ready = new Promise((resolve, reject) => {
    loader.load(opt.model, gltf => {
      let src = null;
      gltf.scene.traverse(o => { if (!src && o.isMesh) src = o; });
      if (!src) return reject(new Error('guus-3d: geen mesh in de glb'));

      car = new THREE.Mesh(prepare(src, opt.crease), mat);
      car.frustumCulled = false;
      sphere.copy(car.geometry.boundingSphere);
      scene.add(car);

      renderer.compile(scene, camera);
      requestAnimationFrame(() => {
        t0 = performance.now();
        lastT = t0;
        tick();
        resolve(car);
      });
    }, undefined, reject);
  });

  return {
    ready,
    get mesh() { return car; },
    setKeys(keys) { opt.keys = keys; },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      if (car) car.geometry.dispose();
      mat.dispose();
      renderer.dispose();
      if (owns) mount.remove(); else renderer.domElement.remove();
      setCursor('');
    }
  };
}