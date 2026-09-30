// Friendly labels for KeyboardEvent.code / mouse tokens. Uses the Keyboard
// Map API (layout-aware) when available, falling back to a static table.

const STATIC: Record<string, string> = {
  Space: 'SPACE',
  Escape: 'ESC',
  Enter: 'ENTER',
  Tab: 'TAB',
  Backspace: 'BKSP',
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  CapsLock: 'CAPS',
  Mouse0: 'MOUSE 1',
  Mouse1: 'MOUSE 3',
  Mouse2: 'MOUSE 2',
  Mouse3: 'MOUSE 4',
  Mouse4: 'MOUSE 5',
};

let layout: Map<string, string> | null = null;

type KeyboardWithLayout = { getLayoutMap(): Promise<Map<string, string>> };

export async function loadKeyboardLayout(): Promise<void> {
  const kb = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    layout = await kb.getLayoutMap();
  } catch {
    layout = null;
  }
}

export function keyLabel(code: string | null): string {
  if (!code) return '—';
  if (STATIC[code]) return STATIC[code];
  const mapped = layout?.get(code);
  if (mapped && mapped.trim()) return mapped.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}
