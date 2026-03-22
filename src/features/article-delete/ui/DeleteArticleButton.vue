<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button } from '@/shared/components/base'
import {
    canDeleteArticleStatus,
    type ArticleDeleteResult,
} from '@/features/article-delete/model'
import DeleteArticleDialog from './DeleteArticleDialog.vue'

const props = withDefaults(
    defineProps<{
      articleId: number | string
      status?: string | null
      disabled?: boolean
      text?: string
    }>(),
    {
      status: null,
      disabled: false,
      text: '删除文章',
    },
)

const emit = defineEmits<{
  deleted: [ArticleDeleteResult]
}>()

const open = ref(false)

const buttonDisabled = computed(
    () => props.disabled || !canDeleteArticleStatus(props.status),
)
</script>

<template>
  <div class="inline-flex">
    <Button
        type="button"
        variant="danger"
        :disabled="buttonDisabled"
        @click="open = true"
    >
      {{ text }}
    </Button>

    <DeleteArticleDialog
        v-model="open"
        :article-id="articleId"
        :status="status"
        @deleted="emit('deleted', $event)"
    />
  </div>
</template>

