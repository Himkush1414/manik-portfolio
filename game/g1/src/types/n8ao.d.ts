// Minimal typings for n8ao 2.x (package ships none). Only the API we use.
declare module 'n8ao' {
  import type { Scene, Camera } from 'three';
  import type { Pass } from 'postprocessing';

  export type N8AOConfiguration = {
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    halfRes: boolean;
    gammaCorrection: boolean;
    depthAwareUpsampling: boolean;
    screenSpaceRadius: boolean;
    aoSamples: number;
    denoiseSamples: number;
    denoiseRadius: number;
    [key: string]: unknown;
  };

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: N8AOConfiguration;
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
  }
}
