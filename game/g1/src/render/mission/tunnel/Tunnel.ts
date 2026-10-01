// The wormhole (brief §6): shell (tier variant), optional veil shell (HIGH+),
// far core disc, and hidden warm-up holders for every tier variant so ALL of
// them compile during prepare (a quality change swaps materials, never
// compiles). Rail phases are computed here in double precision and passed
// fract-ed / mod-ed, so 10 km+ levels lose nothing in float32.
import { CircleGeometry, CylinderGeometry, Group, Mesh, PlaneGeometry, type ShaderMaterial } from 'three';
import { TUNNEL, TUNNEL_TIERS, MOODS, type TunnelMoodDef } from '../../../data/tunnel';
import type { Preset } from '../../quality';
import type { TunnelMood } from '../../../levels/types';
import { bakeTunnelNoise } from './tunnelNoise';
import { createTunnelUniforms, createTunnelMaterial, createVeilMaterial, createCoreMaterial, type TunnelUniforms } from './tunnelMaterial';

const TAU = Math.PI * 2;

export class Tunnel {
  readonly group = new Group();
  readonly uniforms: TunnelUniforms;
  readonly tiers: Record<Preset, ShaderMaterial>;
  readonly shell: Mesh;
  readonly veil: Mesh;
  readonly core: Mesh;
  private tier: Preset = 'high';
  private mood: TunnelMoodDef = { ...MOODS.l1 };
  private dispose_: (() => void)[] = [];

  constructor(uniforms: TunnelUniforms, tiers: Record<Preset, ShaderMaterial>, shellGeo: CylinderGeometry, veilGeo: CylinderGeometry, coreGeo: CircleGeometry, veilMat: ShaderMaterial, coreMat: ShaderMaterial) {
    this.uniforms = uniforms;
    this.tiers = tiers;
    this.group.name = 'tunnel';
    this.shell = new Mesh(shellGeo, tiers.high);
    this.veil = new Mesh(veilGeo, veilMat);
    this.core = new Mesh(coreGeo, coreMat);
    for (const m of [this.shell, this.veil, this.core]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.shell.renderOrder = -10;
    this.core.renderOrder = -11;
    this.veil.renderOrder = 5;
    // warm-up holders: one hidden mesh per tier material (compiled, never drawn)
    const tiny = new PlaneGeometry(0.01, 0.01);
    for (const p of Object.keys(tiers) as Preset[]) {
      const h = new Mesh(tiny, tiers[p]);
      h.visible = false;
      h.name = `tunnel-warm-${p}`;
      this.group.add(h);
    }
    this.dispose_.push(() => {
      tiny.dispose();
      shellGeo.dispose();
      veilGeo.dispose();
      coreGeo.dispose();
      Object.values(tiers).forEach(m => m.dispose());
      veilMat.dispose();
      coreMat.dispose();
      (uniforms.tNoise.value as { dispose(): void }).dispose();
    });
  }

  /** quality tier: swap the pre-compiled shell variant, veil on HIGH+ */
  setTier(p: Preset): void {
    this.tier = p;
    this.shell.material = this.tiers[p];
    this.veil.visible = TUNNEL_TIERS[p].veil;
  }

  get currentTier(): Preset {
    return this.tier;
  }

  setMood(m: TunnelMood | TunnelMoodDef): void {
    const def: TunnelMoodDef = 'preset' in m ? { ...MOODS[m.preset], ...(m.overrides ?? {}) } : m;
    this.mood = def;
    const u = this.uniforms;
    u.uNear.value.set(def.near);
    u.uMid.value.set(def.mid);
    u.uFar.value.set(def.far);
    u.uCore.value.set(def.core);
    u.uFil.value.set(def.filament);
    u.uVein.value.set(def.vein);
    u.uPulse.value = def.pulse;
    u.uTwist.value = def.twist;
    u.uFlow.value = def.flow;
    u.uRingDensity.value = def.ringDensity;
    u.uInfest.value = def.infestation;
    u.uGlow.value = def.glow;
  }

  get moodDef(): TunnelMoodDef {
    return this.mood;
  }

  /** path curvature (render only; brief §5: amplitude <= 0.3 R) */
  setPath(amp: number, freq: number): void {
    const a = Math.min(amp, TUNNEL.radius * 0.3);
    this.uniforms.uPathA.value.set(a, a * 0.7, freq, freq * 1.55);
  }

  /** per frame: rail position (double), speed 0..~1.5, presentation time, storm 0..1 */
  update(playerS: number, speed01: number, time: number, storm: number): void {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uScrollV.value = fract(playerS / TUNNEL.metresPerV);
    const ringPeriod = TUNNEL.ringSpacing / Math.max(0.05, u.uRingDensity.value);
    u.uRingScroll.value = playerS % ringPeriod;
    const A = u.uPathA.value;
    u.uPathPh.value.set((playerS * A.z) % TAU, (playerS * A.w) % TAU, (playerS * A.w * 0.83 + 1.3) % TAU, (playerS * A.z * 1.21 + 2.1) % TAU);
    u.uSpeed.value = speed01;
    u.uStorm.value = storm;
  }

  dispose(): void {
    this.dispose_.forEach(f => f());
    this.dispose_ = [];
  }
}

function fract(v: number): number {
  return v - Math.floor(v);
}

/** Build in small steps (noise bake is sliced; geometry + materials after). */
export function* buildTunnelSteps(seed: number): Generator<void, Tunnel, void> {
  const noise = yield* bakeTunnelNoise(TUNNEL.noiseSize, seed);
  const u = createTunnelUniforms(noise);
  yield;
  const len = TUNNEL.zNear - TUNNEL.zFar;
  const shellGeo = new CylinderGeometry(TUNNEL.radius, TUNNEL.radius, len, TUNNEL.radial, TUNNEL.lengthSegs, true);
  // cylinder axis = +y: turn it onto -z (uv.x runs around the tube, seamless repeats)
  shellGeo.rotateX(-Math.PI / 2).translate(0, 0, (TUNNEL.zNear + TUNNEL.zFar) / 2);
  yield;
  const veilGeo = new CylinderGeometry(TUNNEL.veilRadius, TUNNEL.veilRadius, len * 0.75, 64, 48, true);
  veilGeo.rotateX(-Math.PI / 2).translate(0, 0, TUNNEL.zNear - (len * 0.75) / 2);
  const coreGeo = new CircleGeometry(TUNNEL.radius * 1.6, 72);
  coreGeo.translate(0, 0, TUNNEL.zFar + 1);
  yield;
  const tiers = {} as Record<Preset, ShaderMaterial>;
  for (const p of ['low', 'medium', 'high', 'ultra'] as Preset[]) tiers[p] = createTunnelMaterial(u, TUNNEL_TIERS[p].layers, TUNNEL_TIERS[p].arcs);
  const tunnel = new Tunnel(u, tiers, shellGeo, veilGeo, coreGeo, createVeilMaterial(u), createCoreMaterial(u, TUNNEL.rays));
  tunnel.setMood(MOODS.l1);
  return tunnel;
}
