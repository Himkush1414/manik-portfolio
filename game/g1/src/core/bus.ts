// Typed app-wide event bus. Decouples systems that must not import each other
// (e.g. stores emit 'purchase', audio and UI react). Handlers are sync.

export type BusEvents = {
  'ui:hover': { id?: string };
  'ui:confirm': { id?: string };
  'ui:deny': { reason?: string };
  'profile:purchase': { kind: 'upgrade' | 'ship'; id: string; cost: number };
  'profile:unlock': { shipId: string };
  'ship:changed': { shipId: string };
  'livery:changed': { shipId: string; livery: number };
  'doors:unlock': { id: string };
  'doors:move': { id: string; velocity: number };
  'doors:slam': { id: string };
  'flow:state': { from: string; to: string };
  'audio:unlocked': Record<string, never>;
  'hangarUi:enter': Record<string, never>;
};

type Handler<T> = (payload: T) => void;

class Bus {
  private map = new Map<keyof BusEvents, Set<Handler<unknown>>>();

  on<K extends keyof BusEvents>(type: K, fn: Handler<BusEvents[K]>): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof BusEvents>(type: K, payload: BusEvents[K]): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (err) {
        // one bad listener must never break the emitter's own flow
        console.error(`[bus] ${String(type)} handler failed`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

export const bus = new Bus();
