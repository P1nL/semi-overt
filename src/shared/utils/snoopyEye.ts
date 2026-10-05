/** Gentle lid separation, followed by a soft stop at the fully open pose. */
export function eyeOpeningEase(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  return p * p * (3 - 2 * p)
}

export function eyeOpeningPath(openness: number) {
  const p = Math.min(1, Math.max(0, openness))
  return `M 7.5 50 Q 50 ${50 - 50 * p} 92.5 50 Q 50 ${50 + 50 * p} 7.5 50 Z`
}

/** Random saccade followed by a fixation; bounded to the original eye's range. */
export function createSnoopyEyeTarget(random: () => number = Math.random) {
  const angle = random() * Math.PI * 2
  const radius = random() < 0.22 ? 0 : Math.sqrt(random()) * 0.95
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  return {
    iris: { xPercent: x * 2.5, yPercent: y * 2.5 },
    pupil: { xPercent: x * 77.5, yPercent: y * 77.5 },
    duration: (130 + random() * 90) / 1000,
    pause: Math.round(900 + random() * 1500),
  }
}
