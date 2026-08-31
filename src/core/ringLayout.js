//Geometry helper for laying out the habitation ring

//Returns the width a single wall needs to be so that segmentCount segments fully tile a circle of 'radius' with a small overlap to avoid visible seams
export function segmentWidth(segmentCount, radius, overlap = 0.1) {
  return (2 * Math.PI * radius) / segmentCount + overlap;
}

export function ringSegmentTransform(index, segmentCount, radius) {
  const angle = (index / segmentCount) * Math.PI * 2;
  return {
    angle,
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    rotationY: -angle + Math.PI / 2,
  };
}

// Midpoint transform for a straight spoke corridor running from
// `startRadius` to `endRadius` at a fixed `angle` (radians).

export function spokeTransform(startRadius, endRadius, angle) {
  const length = Math.abs(startRadius - endRadius);
  const midRadius = (startRadius + endRadius) / 2;

  return {
    length,
    x: Math.cos(angle) * midRadius,
    z: Math.sin(angle) * midRadius,
    rotationY: -angle + Math.PI / 2,
  };
}
