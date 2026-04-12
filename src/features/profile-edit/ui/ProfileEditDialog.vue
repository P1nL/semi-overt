<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import { mapUserProfileDtoToVm, type UserProfileVm } from '@/entities/user'
import {
  applyProfileUpdate,
  createProfileEditFormValues,
  mapProfileEditFormToPayload,
  validateProfileEditForm,
  type ProfileEditFieldErrors,
  type ProfileEditFormValues,
} from '@/features/profile-edit/model'
import { queryKeys } from '@/shared/api/queryKeys'
import { queryClient } from '@/shared/lib/queryClient'
import { userApi } from '@/shared/api/modules/user'
import { Button, Icon, IconButton } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { useToast } from '@/shared/composables/useToast'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import ProfileEditForm from './ProfileEditForm.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    profile?: UserProfileVm | null
  }>(),
  {
    profile: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: [UserProfileVm]
}>()

const authStore = useAuthStore()
const toast = useToast()

const submitting = ref(false)
const errorMessage = ref('')
const form = ref<ProfileEditFormValues>(createProfileEditFormValues(props.profile))
const errors = reactive<ProfileEditFieldErrors>({})

function resetFormState() {
  form.value = createProfileEditFormValues(props.profile)
  errors.nickname = ''
  errors.signature = ''
  errorMessage.value = ''
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  errorMessage.value = ''

  const validation = validateProfileEditForm(form.value)
  errors.nickname = validation.errors.nickname || ''
  errors.signature = validation.errors.signature || ''

  if (!validation.valid) return

  submitting.value = true

  try {
    const response = await userApi.updateMyProfile(mapProfileEditFormToPayload(form.value))
    const profile = mapUserProfileDtoToVm(response)

    applyProfileUpdate(response, authStore)
    await queryClient.invalidateQueries({
      queryKey: [queryKeys.userProfile('', '', 0, 0)[0]],
    })

    toast.success('资料更新成功')
    emit('updated', profile)
    closeDialog()
  } catch (error) {
    const message = getErrorMessage(error, '资料更新失败，请稍后重试')
    errorMessage.value = message
    toast.error(message)
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetFormState()
    }
  },
)

watch(
  () => props.profile,
  () => {
    if (props.modelValue) {
      resetFormState()
    }
  },
  { deep: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="modelValue"
        type="button"
        class="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--color-text)_18%,transparent)] backdrop-blur-sm"
        aria-label="关闭编辑资料抽屉"
        @click="closeDialog"
      />
    </Transition>

    <Transition
      enter-active-class="transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      enter-from-class="translate-y-10 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-6 opacity-0"
    >
      <section
        v-if="modelValue"
        class="surface-1 fixed bottom-0 left-1/2 z-[61] flex h-[min(88vh,52rem)] w-[min(42rem,calc(100vw-1rem))] -translate-x-1/2 flex-col overflow-hidden rounded-t-[var(--radius-xl)] shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-modal="true"
        aria-label="编辑资料"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 pb-4 pt-5 md:px-6">
          <div class="min-w-0 flex-1">
            <div class="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
              PROFILE
            </div>
            <h2 class="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
              编辑资料
            </h2>
            <p class="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
              更新个人头像、封面和基础信息。
            </p>
          </div>

          <IconButton
            ariaLabel="关闭编辑资料"
            variant="ghost"
            size="sm"
            class="mt-1 !border-transparent !bg-transparent !shadow-none hover:!border-transparent hover:!bg-transparent"
            @click="closeDialog"
          >
            <Icon name="close" :size="16" />
          </IconButton>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <div class="space-y-4">
            <InlineMessage v-if="errorMessage" tone="error" :message="errorMessage" />

            <ProfileEditForm
              v-model="form"
              :errors="errors"
              :disabled="submitting"
              @submit="handleSubmit"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4 md:px-6">
          <Button type="button" variant="ghost" :disabled="submitting" @click="closeDialog">
            取消
          </Button>
          <Button type="button" :loading="submitting" :disabled="submitting" @click="handleSubmit">
            <span class="bg-[linear-gradient(135deg,#ff7b72_0%,#ffb86b_22%,#ffe08a_42%,#79d7ff_68%,#8b8dff_100%)] bg-clip-text text-transparent">
              保存资料
            </span>
          </Button>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>
