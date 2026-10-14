// golden.js
// GOLDEN BOSSES: the boss's own materials are turned gold, and a small shader add-on gives
// them a moving glint sweep and a warm rim glow. Shared clock: GOLD_TIME (main.js ticks it).
import * as THREE from 'three';

export const GOLD_TIME = { value: 0 };
const GOLDS = { main: 0xffc23a, dark: 0x9a6a1a, mask: 0xfff0b8 };

function goldShader(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGoldTime = GOLD_TIME;
    sh.fragmentShader = 'uniform float uGoldTime;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
      float gs = sin((gl_FragCoord.x + gl_FragCoord.y) * 0.018 - uGoldTime * 5.0);
      gl_FragColor.rgb += vec3(1.0, 0.8, 0.35) * (smoothstep(0.86, 1.0, gs) * 0.6 + 0.08);`);
  };
  mat.customProgramCacheKey = () => 'coreburn-gold';
  mat.needsUpdate = true;
}

export function makeGolden(boss) {
  boss.golden = true;
  boss.points *= 3;
  for (const [k, m] of Object.entries(boss.mats || {})) {
    m.color.setHex(GOLDS[k] ?? GOLDS.main);
    goldShader(m);
  }
  boss.killerName = 'the Golden ' + boss.killerName.replace(/^the /i, '');
}

// Used on co-op clients for the puppet boss
export const GOLD_COLOR = new THREE.Color(0xffc23a);
