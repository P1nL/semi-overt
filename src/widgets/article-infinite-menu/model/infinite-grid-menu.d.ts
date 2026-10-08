import type { ResultMenuSnapshot, ResultMenuTexture } from '@/shared/utils/resultMenuBridge'

export interface InfiniteGridMenuOptions {
  centerLabel?: string
  opaqueMain?: boolean
}

export class InfiniteGridMenu {
  constructor(
    canvas: HTMLCanvasElement,
    items: ResultMenuTexture[],
    onActiveItemChange: (index: number) => void,
    onMovementChange: (moving: boolean) => void,
    onInit?: ((instance: InfiniteGridMenu) => void) | null,
    scale?: number,
    options?: InfiniteGridMenuOptions,
  )

  paintCurrentFrame(): void
  captureResultState(): ResultMenuSnapshot
  replaceResultsFrom(previous: ResultMenuSnapshot, direction: number): void
  finishResultReplacement(): void
  resize(): void
  handleWheel(event: WheelEvent): void
  setPresentationPress(value: number | null, initializeHidden?: boolean): void
  pause(): void
  resume(): void
  run(time?: number): void
  dispose(): void
}
