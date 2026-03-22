<script setup lang="ts">
import { ref } from 'vue'

import type { UserProfileVm } from '@/entities/user/model/user.types'
import { Button } from '@/shared/components/base'
import ProfileEditDialog from './ProfileEditDialog.vue'

const props = withDefaults(
    defineProps<{
      profile?: UserProfileVm | null
      disabled?: boolean
      text?: string
    }>(),
    {
      profile: null,
      disabled: false,
      text: '编辑资料',
    },
)

const emit = defineEmits<{
  updated: [UserProfileVm]
}>()

const open = ref(false)
</script>

<template>
  <div class="inline-flex">
    <Button type="button" variant="secondary" :disabled="disabled" @click="open = true">
      {{ text }}
    </Button>

    <ProfileEditDialog
        v-model="open"
        :profile="props.profile"
        @updated="emit('updated', $event)"
    />
  </div>
</template>

