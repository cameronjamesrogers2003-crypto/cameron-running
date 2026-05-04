export interface VdotPaces {
  easyMinSecKm: number;
  easyMaxSecKm: number;
  tempoSecKm: number;
  intervalSecKm: number;
  marathonSecKm: number;
}

// Anchor points from Jack Daniels' Running Formula VDOT table
// All values in sec/km
const ANCHORS: Array<[number, VdotPaces]> = [
  [28, { easyMinSecKm: 430, easyMaxSecKm: 484, tempoSecKm: 362, intervalSecKm: 330, marathonSecKm: 401 }],
  [30, { easyMinSecKm: 413, easyMaxSecKm: 464, tempoSecKm: 346, intervalSecKm: 314, marathonSecKm: 381 }],
  [33, { easyMinSecKm: 390, easyMaxSecKm: 435, tempoSecKm: 322, intervalSecKm: 292, marathonSecKm: 357 }],
  [35, { easyMinSecKm: 375, easyMaxSecKm: 420, tempoSecKm: 308, intervalSecKm: 279, marathonSecKm: 342 }],
  [40, { easyMinSecKm: 348, easyMaxSecKm: 387, tempoSecKm: 280, intervalSecKm: 252, marathonSecKm: 309 }],
  [45, { easyMinSecKm: 321, easyMaxSecKm: 357, tempoSecKm: 257, intervalSecKm: 230, marathonSecKm: 283 }],
  [50, { easyMinSecKm: 295, easyMaxSecKm: 328, tempoSecKm: 238, intervalSecKm: 213, marathonSecKm: 262 }],
  [55, { easyMinSecKm: 276, easyMaxSecKm: 307, tempoSecKm: 221, intervalSecKm: 199, marathonSecKm: 245 }],
  [60, { easyMinSecKm: 254, easyMaxSecKm: 283, tempoSecKm: 208, intervalSecKm: 187, marathonSecKm: 226 }],
];

export function getVdotPaces(vdot: number): VdotPaces {
  const clamped = Math.max(28, Math.min(60, vdot));

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [v0, p0] = ANCHORS[i];
    const [v1, p1] = ANCHORS[i + 1];
    if (clamped >= v0 && clamped <= v1) {
      const t = (clamped - v0) / (v1 - v0);
      return {
        easyMinSecKm:  Math.round(p0.easyMinSecKm  + t * (p1.easyMinSecKm  - p0.easyMinSecKm)),
        easyMaxSecKm:  Math.round(p0.easyMaxSecKm  + t * (p1.easyMaxSecKm  - p0.easyMaxSecKm)),
        tempoSecKm:    Math.round(p0.tempoSecKm    + t * (p1.tempoSecKm    - p0.tempoSecKm)),
        intervalSecKm: Math.round(p0.intervalSecKm + t * (p1.intervalSecKm - p0.intervalSecKm)),
        marathonSecKm: Math.round(p0.marathonSecKm + t * (p1.marathonSecKm - p0.marathonSecKm)),
      };
    }
  }

  return ANCHORS[ANCHORS.length - 1][1];
}
