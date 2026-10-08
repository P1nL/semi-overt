/** Original pointer-hold camera update, shared by real input and view switching.
 * Keep its frame-time-scaled damping rather than wrapping it in another easing. */
export function stepPressCamera(current: number, base: number, pressed: boolean, velocity: number, deltaTime: number, frameDuration: number) {
  const timeScale = deltaTime / frameDuration + .0001
  const target = base + (pressed ? velocity * 80 + 2.5 : 0)
  return current + (target - current) / ((pressed ? 7 : 5) / timeScale)
}
