import type { ArticleMenuTextureItem } from './article-card-texture'

export interface InfiniteGridMenuOptions {
  centerLabel?: string
}

export class InfiniteGridMenu {
  constructor(
    canvas: HTMLCanvasElement,
    items: ArticleMenuTextureItem[],
    onActiveItemChange: (index: number) => void,
    onMovementChange: (moving: boolean) => void,
    onInit?: ((instance: InfiniteGridMenu) => void) | null,
    scale?: number,
    options?: InfiniteGridMenuOptions,
  )

  resize(): void
  setPresentationPress(value: number | null, initializeHidden?: boolean): void
  pause(): void
  resume(): void
  run(time?: number): void
  dispose(): void
}
