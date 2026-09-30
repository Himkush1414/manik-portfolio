// Slot for a live pilot bust (brief §13). The 3D busts land in the next
// checkpoint; until then the slot shows a dim framed placeholder.
export function PilotViewport({ id, selected }: { id: 'onyx' | 'ember'; selected: boolean }) {
  return <span data-pilot-slot={id} data-selected={selected} style={{ position: 'absolute', inset: 0 }} aria-hidden />;
}
