import { describe, expect, it } from 'vitest';
import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { envRotationFor } from '../render/world/envProbe';

describe('world env probe rotation (Phase 2R §6)', () => {
  it('envMapRotation (three negates the Euler) equals B, local -> world, for any path frame', () => {
    for (const [ax, ang] of [[new Vector3(0, 1, 0), 0.7], [new Vector3(1, 2, 0.5).normalize(), -1.9], [new Vector3(0.3, -1, 0.2).normalize(), 2.6]] as const) {
      const B = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromAxisAngle(ax, ang));
      const e = B.elements; // column-major: B^T rows = B columns
      const r = [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]];
      const rot = envRotationFor(r, new Euler());
      // WebGLRenderer refreshUniformsCommon (PMREM / render-target env): negate the angles, same order
      const e1 = rot.clone();
      e1.x *= -1; e1.y *= -1; e1.z *= -1;
      const got = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(e1));
      const want = new Matrix3().setFromMatrix4(B);
      for (let i = 0; i < 9; i++) expect(got.elements[i]).toBeCloseTo(want.elements[i], 6);
    }
  });
});
