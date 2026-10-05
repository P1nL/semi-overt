/// <reference lib="es2022.intl" />

/** Draw every grapheme once per shuffled cycle, including across hover sessions. */
export function createScrambleSampler(chars: string, random: () => number = Math.random) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const symbols = [...new Set(Array.from(segmenter.segment(chars), part => part.segment))]
    .filter(symbol => symbol.trim())
  let bag: string[] = []
  let last: string | undefined
  return () => {
    if (!symbols.length) return ''
    if (!bag.length) {
      bag = [...symbols]
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
      }
      // pop() draws from the end; avoid repeating at a cycle boundary.
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        ;[bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!]
      }
    }
    last = bag.pop()!
    return last
  }
}

// All characters using the same pool share a cycle instead of restarting it.
const samplers = new Map<string, ReturnType<typeof createScrambleSampler>>()
export function nextScrambleSymbol(chars: string) {
  let sample = samplers.get(chars)
  if (!sample) {
    sample = createScrambleSampler(chars)
    samplers.set(chars, sample)
  }
  return sample()
}
