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
  [28, { easyMinSecKm: 521, easyMaxSecKm: 571, tempoSecKm: 457, intervalSecKm: 420, marathonSecKm: 497 }],
  [30, { easyMinSecKm: 494, easyMaxSecKm: 542, tempoSecKm: 427, intervalSecKm: 393, marathonSecKm: 467 }],
  [33, { easyMinSecKm: 456, easyMaxSecKm: 502, tempoSecKm: 391, intervalSecKm: 358, marathonSecKm: 429 }],
  [35, { easyMinSecKm: 435, easyMaxSecKm: 478, tempoSecKm: 371, intervalSecKm: 341, marathonSecKm: 408 }],
  [40, { easyMinSecKm: 397, easyMaxSecKm: 436, tempoSecKm: 337, intervalSecKm: 308, marathonSecKm: 372 }],
  [45, { easyMinSecKm: 368, easyMaxSecKm: 404, tempoSecKm: 310, intervalSecKm: 284, marathonSecKm: 344 }],
  [50, { easyMinSecKm: 344, easyMaxSecKm: 378, tempoSecKm: 290, intervalSecKm: 265, marathonSecKm: 323 }],
  [55, { easyMinSecKm: 324, easyMaxSecKm: 357, tempoSecKm: 274, intervalSecKm: 250, marathonSecKm: 305 }],
  [60, { easyMinSecKm: 308, easyMaxSecKm: 339, tempoSecKm: 261, intervalSecKm: 238, marathonSecKm: 290 }],
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
