export type PupilTarget = { x: number; y: number; duration: number; pause: number }

/** A bounded ellipse leaves clearance for the pupil inside the O's counter. */
export function createPupilTarget(random: () => number = Math.random): PupilTarget {
  const angle = random() * Math.PI * 2
  // Occasionally look straight ahead; otherwise explore the interior, not just its edge.
  const radius = random() < 0.22 ? 0 : Math.sqrt(random()) * 0.95
  return {
    x: Math.cos(angle) * radius * 0.085,
    y: Math.sin(angle) * radius * 0.14,
    duration: Math.round(130 + random() * 90),
    pause: Math.round(900 + random() * 1500),
  }
}
