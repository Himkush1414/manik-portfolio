// Door feedback (brief §9): trauma shake + chromatic pulse on clunks,
// sustained 6-9 Hz rumble while moving, servo/hiss/clunk audio. Subscribed
// once; driven purely by DoorController bus events.
import { bus } from '../../core/bus';
import { postfx } from '../../render/fxController';
import { CameraShaker } from '../../render/CameraShaker';
import { sfx } from '../../audio/sfx';
import { AudioBus } from '../../audio/AudioBus';
import { servo } from '../../audio/synth/boot';

let installed = false;

export function installDoorFeedback(): void {
  if (installed) return;
  installed = true;
  let voice: ReturnType<typeof servo> | null = null;

  bus.on('doors:unlock', () => {
    postfx.pulse({ ca: 0.006, shake: 0.6, duration: 0.12 });
    sfx.play('clunk');
    sfx.play('hiss');
    if (AudioBus.running && !voice) voice = servo();
  });

  bus.on('doors:move', ({ velocity }) => {
    const v = Math.abs(velocity);
    CameraShaker.setRumble(v > 0.001 ? Math.min(0.15, 0.06 + v * 0.18) : 0, 7.5);
    voice?.set(v * 1.4);
    if (v <= 0.001 && voice) {
      voice.stop();
      voice = null;
    }
  });

  bus.on('doors:slam', () => {
    CameraShaker.setRumble(0);
    postfx.pulse({ ca: 0.006, shake: 0.4, duration: 0.25 });
    sfx.play('clunkHeavy');
    voice?.stop();
    voice = null;
  });
}
