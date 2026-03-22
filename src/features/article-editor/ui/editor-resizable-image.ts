import Image from '@tiptap/extension-image'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import { extractEditorImageWidthPercentFromElement } from '@/features/article-editor/model/editor-image'

import ResizableImageNodeView from './ResizableImageNodeView.vue'

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthPercent: {
        default: null,
        parseHTML: (element: HTMLElement) => extractEditorImageWidthPercentFromElement(element),
        renderHTML: (attributes: Record<string, unknown>) => {
          const widthPercent =
            typeof attributes.widthPercent === 'number' ? attributes.widthPercent : null

          if (widthPercent === null) {
            return {}
          }

          return {
            'data-width': String(widthPercent),
            style: `width: ${widthPercent}%; height: auto;`,
          }
        },
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ResizableImageNodeView)
  },
})
