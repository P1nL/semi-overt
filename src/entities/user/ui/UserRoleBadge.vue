<!-- src/entities/user/ui/UserRoleBadge.vue -->
<script setup lang="ts">
import { Badge } from '@/shared/components'
import type { UserRoleVm } from '../model/user.types'

defineProps<{
  role: UserRoleVm
}>()
</script>

<template>
  <Badge :variant="role.variant" size="sm">
    {{ role.label }}
  </Badge>
</template>