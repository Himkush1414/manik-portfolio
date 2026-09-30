// Transient UI state (never persisted): open modal, hovered ship, CTA hover
// (drives the 3D engine flare), toasts.
import { create } from 'zustand';

export type ModalId = 'upgrades' | 'settings' | null;
export type Toast = { id: number; text: string; tone: 'info' | 'ok' | 'danger' };

type UiState = {
  modal: ModalId;
  ctaHover: boolean;
  audioLocked: boolean;
  toasts: Toast[];
  openModal(m: ModalId): void;
  setCtaHover(v: boolean): void;
  setAudioLocked(v: boolean): void;
  toast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
};

let toastSeq = 0;

export const useUi = create<UiState>()(set => ({
  modal: null,
  ctaHover: false,
  audioLocked: false,
  toasts: [],
  openModal: modal => set({ modal }),
  setCtaHover: ctaHover => set({ ctaHover }),
  setAudioLocked: audioLocked => set({ audioLocked }),
  toast: (text, tone = 'info') => set(s => ({ toasts: [...s.toasts.slice(-2), { id: ++toastSeq, text, tone }] })),
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
