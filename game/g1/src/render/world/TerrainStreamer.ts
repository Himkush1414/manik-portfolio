// Terrain streaming + ribbon renderer (Phase 2R §5 STREAMING / RENDER).
// Tiles along the path: requested -> generating (worker) -> ready ->
// resident -> evicted. A pool of meshes per LOD with fixed-size geometries
// (shared index buffer per LOD) is refilled by copying worker buffers into
// the geometry attributes (one upload per frame at most, inside a time
// budget) — no geometry / texture is ever created during play. A tile that
// changes LOD keeps its old mesh until the new one is uploaded (no holes).
// Meshes sit relative to a floating origin set every frame.
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Mesh, Sphere, Vector3, type Material } from 'three';
import { TILE_LEN, tileIndices, tileLayout, allocTile, tileTransfer, type Lod, type TileBuffers } from '../../game/world/tiles';
import type { TerrainDef } from '../../data/worlds/types';
import type { PathDef } from '../../game/world/pathDef';
import type { TerrainWorkerGen, TerrainWorkerInit, TerrainWorkerResult } from './terrain.worker';

export type StreamerOptions = {
  terrain: TerrainDef;
  path: PathDef;
  seed: number;
  widthKeys?: readonly (readonly [number, number])[];
  material: Material;
  /** tile-centre distance limits for LOD 0 / LOD 1 (beyond = LOD 2) */
  lodDist: readonly [number, number];
  ahead: number;
  behind: number;
  /** pool sizes per LOD */
  pool: readonly [number, number, number];
};

type Slot = { mesh: Mesh; geo: BufferGeometry; lod: Lod; tile: number; origin: Vector3 };
type Pending = { tile: number; lod: Lod };

export class TerrainStreamer {
  readonly group = new Group();
  private readonly slots: Slot[] = [];
  private readonly free: Slot[][] = [[], [], []];
  /** resident slot per tile (the one drawn) */
  private readonly resident = new Map<number, Slot>();
  private readonly pending = new Map<number, Pending>();
  private readonly ready: TerrainWorkerResult[] = [];
  /** a tile whose first half was uploaded last frame (second half + show this frame) */
  private staged: { slot: Slot; res: TerrainWorkerResult } | null = null;
  private readonly spare: TileBuffers[][] = [[], [], []];
  private worker: Worker | null = null;
  private nextId = 1;
  private readyResolve: (() => void) | null = null;
  pathLength = 0;
  /** stats (QA): late tiles = needed within `lateDist` of the viewer but not resident at the wanted LOD or any */
  readonly stats = { resident: 0, pending: 0, uploads: 0, lateTiles: 0, genMsMax: 0, genMsAvg: 0, uploadMsMax: 0, gens: 0 };
  private genMsSum = 0;

  constructor(readonly opts: StreamerOptions) {
    this.group.name = 'terrain';
    for (const lod of [0, 1, 2] as Lod[]) {
      const L = tileLayout(lod);
      const index = new BufferAttribute(tileIndices(lod), 1);
      for (let k = 0; k < opts.pool[lod]; k++) {
        const geo = new BufferGeometry();
        geo.setIndex(index);
        const pos = new BufferAttribute(new Float32Array(L.vertices * 3), 3).setUsage(DynamicDrawUsage);
        const nor = new BufferAttribute(new Float32Array(L.vertices * 3), 3).setUsage(DynamicDrawUsage);
        const att = new BufferAttribute(new Uint8Array(L.vertices * 4), 4, true).setUsage(DynamicDrawUsage);
        geo.setAttribute('position', pos);
        geo.setAttribute('normal', nor);
        geo.setAttribute('terrainAttrib', att);
        geo.setAttribute('terrainMorph', new BufferAttribute(new Float32Array(L.vertices * 4), 4).setUsage(DynamicDrawUsage));
        geo.setAttribute('terrainMorphAttrib', new BufferAttribute(new Uint8Array(L.vertices * 4), 4, true).setUsage(DynamicDrawUsage));
        geo.boundingSphere = new Sphere(new Vector3(), 1);
        const mesh = new Mesh(geo, opts.material);
        mesh.name = `terrain-lod${lod}-${k}`;
        mesh.visible = false;
        mesh.matrixAutoUpdate = true;
        this.group.add(mesh);
        const slot: Slot = { mesh, geo, lod, tile: -1, origin: new Vector3() };
        this.slots.push(slot);
        this.free[lod].push(slot);
      }
    }
  }

  /** start the worker and build its terrain; resolves when it is ready */
  init(): Promise<void> {
    this.worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module', name: 'g1-terrain' });
    this.worker.onmessage = (e: MessageEvent<TerrainWorkerResult | { type: 'ready'; length: number }>) => {
      const m = e.data;
      if (m.type === 'ready') {
        this.pathLength = m.length;
        this.readyResolve?.();
        return;
      }
      this.ready.push(m);
      this.stats.gens++;
      this.genMsSum += m.ms;
      this.stats.genMsAvg = this.genMsSum / this.stats.gens;
      this.stats.genMsMax = Math.max(this.stats.genMsMax, m.ms);
    };
    const o = this.opts;
    const init: TerrainWorkerInit = { type: 'init', terrain: o.terrain, path: o.path, seed: o.seed, widthKeys: o.widthKeys };
    this.worker.postMessage(init);
    return new Promise(r => (this.readyResolve = r));
  }

  private lodFor(dist: number): Lod {
    return dist <= this.opts.lodDist[0] ? 0 : dist <= this.opts.lodDist[1] ? 1 : 2;
  }

  private request(tile: number, lod: Lod): void {
    if (!this.worker) return;
    const buffers = this.spare[lod].pop() ?? allocTile(lod);
    const msg: TerrainWorkerGen = { type: 'gen', id: this.nextId++, tile, s0: tile * TILE_LEN, lod, buffers };
    this.pending.set(tile, { tile, lod });
    this.worker.postMessage(msg, tileTransfer(buffers));
  }

  /** wanted tiles + LODs around the viewer */
  private *wanted(viewS: number): Generator<[number, Lod]> {
    const t0 = Math.max(0, Math.floor((viewS - this.opts.behind) / TILE_LEN));
    const t1 = Math.min(Math.floor((this.pathLength - 1) / TILE_LEN), Math.floor((viewS + this.opts.ahead) / TILE_LEN));
    // nearest first (priority by distance)
    const list: [number, Lod, number][] = [];
    for (let t = t0; t <= t1; t++) {
      const centre = t * TILE_LEN + TILE_LEN / 2;
      const d = Math.abs(centre - viewS);
      list.push([t, this.lodFor(d), d]);
    }
    list.sort((a, b) => a[2] - b[2]);
    for (const [t, l] of list) yield [t, l];
  }

  /**
   * Per frame: schedule requests (nearest first), evict far tiles, upload at most one ready tile
   * inside `budgetMs`, and place every resident mesh with `place(mesh, tileOriginWorld)` (the
   * mission puts it in the path frame around the player: floating origin + rotation).
   */
  update(viewS: number, place: (m: Mesh, x: number, y: number, z: number) => void, budgetMs = 0.6, lateDist = 640): void {
    this.lastView = viewS;
    if (!this.worker || this.pathLength <= 0) return;
    const need = new Map<number, Lod>();
    for (const [t, l] of this.wanted(viewS)) need.set(t, l);
    // schedule: one request in flight per tile; keep at most 3 in flight (the worker is sequential)
    for (const [t, l] of need) {
      if (this.pending.size >= 3) break;
      if (this.pending.has(t) || this.staged?.res.tile === t) continue;
      const r = this.resident.get(t);
      if (r && r.lod === l) continue;
      if (this.free[l].length === 0 && !this.evictOne(need, l)) continue;
      this.request(t, l);
    }
    // evict tiles no longer wanted
    for (const [t, slot] of this.resident) if (!need.has(t)) this.release(t, slot);
    // upload: a tile lands over TWO frames (main attributes, then the geomorph targets) so no
    // frame copies more than ~half a tile; it is shown once both halves are in
    const start = performance.now();
    if (this.staged) {
      const { slot, res } = this.staged;
      this.staged = null;
      const g = slot.geo;
      (g.getAttribute('terrainMorph') as BufferAttribute).copyArray(res.buffers.morph).needsUpdate = true;
      (g.getAttribute('terrainMorphAttrib') as BufferAttribute).copyArray(res.buffers.morphAttrib).needsUpdate = true;
      if (need.get(res.tile) === res.lod) {
        const old = this.resident.get(res.tile);
        if (old) this.releaseSlot(old);
        this.resident.set(res.tile, slot);
        slot.mesh.visible = true;
        this.stats.uploads++;
      } else this.releaseSlot(slot); // no longer wanted at this LOD
      this.spare[res.lod].push(res.buffers);
      this.stats.uploadMsMax = Math.max(this.stats.uploadMsMax, performance.now() - start);
    } else {
      while (this.ready.length && performance.now() - start < budgetMs) {
        const res = this.ready.shift()!;
        this.pending.delete(res.tile);
        const wantLod = need.get(res.tile);
        if (wantLod === undefined || wantLod !== res.lod || this.free[res.lod].length === 0) {
          this.spare[res.lod].push(res.buffers);
          continue;
        }
        const slot = this.free[res.lod].pop()!;
        const g = slot.geo;
        (g.getAttribute('position') as BufferAttribute).copyArray(res.buffers.position).needsUpdate = true;
        (g.getAttribute('normal') as BufferAttribute).copyArray(res.buffers.normal).needsUpdate = true;
        (g.getAttribute('terrainAttrib') as BufferAttribute).copyArray(res.buffers.attrib).needsUpdate = true;
        g.boundingSphere!.center.set(res.sphere[0], res.sphere[1], res.sphere[2]);
        g.boundingSphere!.radius = res.sphere[3];
        slot.origin.set(res.origin.x, res.origin.y, res.origin.z);
        slot.tile = res.tile;
        // held (invisible, out of the free list) until its second half lands next frame
        this.staged = { slot, res };
        this.stats.uploadMsMax = Math.max(this.stats.uploadMsMax, performance.now() - start);
        break; // <= 1 half-tile upload per frame
      }
    }
    for (const slot of this.resident.values()) place(slot.mesh, slot.origin.x, slot.origin.y, slot.origin.z);
    // late tiles: wanted near the viewer but nothing resident
    let late = 0;
    for (const [t] of need) {
      const centre = t * TILE_LEN + TILE_LEN / 2;
      if (Math.abs(centre - viewS) < lateDist && !this.resident.has(t)) late++;
    }
    this.stats.lateTiles = late;
    this.stats.resident = this.resident.size;
    this.stats.pending = this.pending.size;
  }

  private lastView = 0;

  /** every wanted tile around the last viewer position is resident at its wanted LOD, nothing pending */
  settled(): boolean {
    if (this.pathLength <= 0 || this.pending.size > 0 || this.ready.length > 0 || this.staged) return false;
    for (const [t, l] of this.wanted(this.lastView)) {
      const r = this.resident.get(t);
      if (!r || r.lod !== l) return false;
    }
    return true;
  }

  /** free a resident slot of `lod` whose tile is not wanted at that LOD (farthest first) */
  private evictOne(need: Map<number, Lod>, lod: Lod): boolean {
    for (const [t, slot] of this.resident) {
      if (slot.lod === lod && need.get(t) !== lod && need.has(t) === false) {
        this.release(t, slot);
        return true;
      }
    }
    return false;
  }

  private release(tile: number, slot: Slot): void {
    this.resident.delete(tile);
    this.releaseSlot(slot);
  }

  private releaseSlot(slot: Slot): void {
    slot.mesh.visible = false;
    slot.tile = -1;
    this.free[slot.lod].push(slot);
  }

  /** every pooled mesh (prepare: compile + upload all of them once) */
  get meshes(): Mesh[] {
    return this.slots.map(s => s.mesh);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const s of this.slots) s.geo.dispose();
    this.opts.material.dispose();
  }
}
