<template>
  <div
    :class="[
      'flex w-full max-w-xs items-center justify-center',
      className,
      { 'pointer-events-none opacity-50': disabled },
    ]"
  >
    <div
      class="flex w-full touch-none select-none items-center justify-center gap-3"
      :style="{
        scale: scale,
        opacity: sliderOpacity
      }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <div
        ref="leftIconRef"
        :style="{
          transform: `translateX(${leftIconTranslateX}px) scale(${leftIconScale})`
        }"
        class="text-sm font-medium text-[var(--color-text-faint)] transition-transform duration-200 ease-out"
      >
        <slot name="left-icon">
          <component :is="leftIcon" v-if="leftIcon && typeof leftIcon === 'object'" />

          <span v-else-if="leftIcon">{{ leftIcon }}</span>

          <span v-else>-</span>
        </slot>
      </div>

      <div
        ref="sliderRef"
        class="relative flex w-full max-w-xs flex-grow cursor-grab touch-none select-none items-center py-4 outline-none focus-visible:[&_.elastic-slider-track]:shadow-[0_0_0_3px_var(--color-primary-soft)]"
        role="slider"
        :tabindex="disabled ? -1 : 0"
        :aria-label="ariaLabel"
        :aria-valuemin="startingValue"
        :aria-valuemax="maxValue"
        :aria-valuenow="Number(value.toFixed(2))"
        :aria-disabled="disabled"
        @pointermove="handlePointerMove"
        @pointerdown="handlePointerDown"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
        @keydown="handleKeydown"
      >
        <div
          :style="{
            transform: `scaleX(${sliderScaleX}) scaleY(${sliderScaleY})`,
            transformOrigin: transformOrigin,
            height: `${sliderHeight}px`,
            marginTop: `${sliderMarginTop}px`,
            marginBottom: `${sliderMarginBottom}px`
          }"
          class="flex flex-grow"
        >
          <div class="elastic-slider-track relative h-full flex-grow overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--color-border-strong)_72%,transparent)] bg-[color-mix(in_srgb,var(--color-border)_74%,var(--color-surface-elevated))] shadow-[inset_0_1px_2px_rgb(15_23_42_/_0.08)]">
            <div class="absolute inset-y-0 left-0 rounded-full bg-[var(--color-primary)]" :style="{ width: `${rangePercentage}%` }" />
          </div>
        </div>
      </div>

      <div
        ref="rightIconRef"
        :style="{
          transform: `translateX(${rightIconTranslateX}px) scale(${rightIconScale})`
        }"
        class="text-sm font-medium text-[var(--color-text-faint)] transition-transform duration-200 ease-out"
      >
        <slot name="right-icon">
          <component :is="rightIcon" v-if="rightIcon && typeof rightIcon === 'object'" />

          <span v-else-if="rightIcon">{{ rightIcon }}</span>

          <span v-else>+</span>
        </slot>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type Component, useTemplateRef } from 'vue';

const MAX_OVERFLOW = 50;

interface Props {
  defaultValue?: number;
  startingValue?: number;
  maxValue?: number;
  className?: string;
  isStepped?: boolean;
  stepSize?: number;
  leftIcon?: Component | string;
  rightIcon?: Component | string;
  disabled?: boolean;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultValue: 50,
  startingValue: 0,
  maxValue: 100,
  className: '',
  isStepped: false,
  stepSize: 1,
  leftIcon: '-',
  rightIcon: '+',
  disabled: false,
  ariaLabel: '滑块'
});

const emit = defineEmits<{
  'update:modelValue': [number]
}>();

const sliderRef = useTemplateRef<HTMLDivElement>('sliderRef');
const leftIconRef = useTemplateRef<HTMLDivElement>('leftIconRef');
const rightIconRef = useTemplateRef<HTMLDivElement>('rightIconRef');

const value = ref(props.defaultValue);
const region = ref<'left' | 'middle' | 'right'>('middle');
const clientX = ref(0);
const overflow = ref(0);
const scale = ref(1);
const leftIconScale = ref(1);
const rightIconScale = ref(1);

let scaleAnimation: number | null = null;
let overflowAnimation: number | null = null;

watch(
  () => props.defaultValue,
  newValue => {
    value.value = newValue;
  }
);

watch(value, newValue => {
  emit('update:modelValue', Number(newValue.toFixed(6)));
});

watch(clientX, latest => {
  if (sliderRef.value) {
    const { left, right } = sliderRef.value.getBoundingClientRect();
    let newValue: number;
    if (latest < left) {
      region.value = 'left';
      newValue = left - latest;
    } else if (latest > right) {
      region.value = 'right';
      newValue = latest - right;
    } else {
      region.value = 'middle';
      newValue = 0;
    }
    overflow.value = decay(newValue, MAX_OVERFLOW);
  }
});

const rangePercentage = computed(() => {
  const totalRange = props.maxValue - props.startingValue;
  if (totalRange === 0) return 0;
  return ((value.value - props.startingValue) / totalRange) * 100;
});

const sliderScaleX = computed(() => {
  if (!sliderRef.value) return 1;
  const { width } = sliderRef.value.getBoundingClientRect();
  return 1 + overflow.value / width;
});

const sliderScaleY = computed(() => {
  const t = overflow.value / MAX_OVERFLOW;
  return 1 + t * (0.8 - 1);
});

const transformOrigin = computed(() => {
  if (!sliderRef.value) return 'center';
  const { left, width } = sliderRef.value.getBoundingClientRect();
  return clientX.value < left + width / 2 ? 'right' : 'left';
});

const sliderHeight = computed(() => {
  const t = (scale.value - 1) / (1.2 - 1);
  return 6 + t * (12 - 6);
});

const sliderMarginTop = computed(() => {
  const t = (scale.value - 1) / (1.2 - 1);
  return 0 + t * (-3 - 0);
});

const sliderMarginBottom = computed(() => {
  const t = (scale.value - 1) / (1.2 - 1);
  return 0 + t * (-3 - 0);
});

const sliderOpacity = computed(() => {
  const t = (scale.value - 1) / (1.2 - 1);
  return 0.7 + t * (1 - 0.7);
});

const leftIconTranslateX = computed(() => {
  return region.value === 'left' ? -overflow.value / scale.value : 0;
});

const rightIconTranslateX = computed(() => {
  return region.value === 'right' ? overflow.value / scale.value : 0;
});

const decay = (inputValue: number, max: number): number => {
  if (max === 0) return 0;
  const entry = inputValue / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
};

const animate = (
  target: { value: number },
  to: number,
  options: { type?: string; bounce?: number; duration?: number } = {}
) => {
  const { type = 'tween', bounce = 0, duration = 0.3 } = options;

  if (type === 'spring') {
    return animateSpring(target, to, bounce, duration);
  } else {
    return animateValue(target, to, duration);
  }
};

const animateValue = (target: { value: number }, to: number, duration = 300) => {
  const start = target.value;
  const diff = to - start;
  const startTime = performance.now();

  const animateFrame = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easeOut = 1 - Math.pow(1 - progress, 3);
    target.value = start + diff * easeOut;

    if (progress < 1) {
      return requestAnimationFrame(animateFrame);
    }
    return null;
  };

  return requestAnimationFrame(animateFrame);
};

const animateSpring = (target: { value: number }, to: number, bounce = 0.5, duration = 600) => {
  const start = target.value;
  const startTime = performance.now();

  const mass = 1;
  const stiffness = 170;
  const damping = 26 * (1 - bounce);

  const dampingRatio = damping / (2 * Math.sqrt(mass * stiffness));
  const angularFreq = Math.sqrt(stiffness / mass);
  const dampedFreq = angularFreq * Math.sqrt(1 - dampingRatio * dampingRatio);

  const animateFrame = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const t = elapsed / 1000;

    let displacement: number;

    if (dampingRatio < 1) {
      const envelope = Math.exp(-dampingRatio * angularFreq * t);
      const cos = Math.cos(dampedFreq * t);
      const sin = Math.sin(dampedFreq * t);

      displacement = envelope * (cos + ((dampingRatio * angularFreq) / dampedFreq) * sin);
    } else {
      displacement = Math.exp(-angularFreq * t);
    }

    const currentValue = to + (start - to) * displacement;
    target.value = currentValue;

    const velocity = Math.abs(currentValue - to);
    const isSettled = velocity < 0.01 && elapsed > 100;

    if (!isSettled && elapsed < duration * 3) {
      return requestAnimationFrame(animateFrame);
    } else {
      target.value = to;
      return null;
    }
  };

  return requestAnimationFrame(animateFrame);
};

const animateIconScale = (target: { value: number }, isActive: boolean) => {
  if (isActive) {
    animate(target, 1.4, { duration: 125 });
    setTimeout(() => {
      animate(target, 1, { duration: 125 });
    }, 125);
  } else {
    animate(target, 1, { duration: 250 });
  }
};

watch(region, (newRegion, oldRegion) => {
  if (newRegion === 'left' && oldRegion !== 'left') {
    animateIconScale(leftIconScale, true);
  } else if (newRegion === 'right' && oldRegion !== 'right') {
    animateIconScale(rightIconScale, true);
  }
});

const handlePointerMove = (e: PointerEvent) => {
  if (props.disabled) return;
  if (e.buttons > 0 && sliderRef.value) {
    const { left, width } = sliderRef.value.getBoundingClientRect();

    let newValue = props.startingValue + ((e.clientX - left) / width) * (props.maxValue - props.startingValue);

    if (props.isStepped) {
      newValue = props.startingValue
        + Math.round((newValue - props.startingValue) / props.stepSize) * props.stepSize;
    }

    newValue = Math.min(Math.max(newValue, props.startingValue), props.maxValue);
    value.value = newValue;

    clientX.value = e.clientX;
  }
};

const handlePointerDown = (e: PointerEvent) => {
  if (props.disabled) return;
  handlePointerMove(e);
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
};

const handlePointerUp = () => {
  if (overflowAnimation) {
    cancelAnimationFrame(overflowAnimation);
  }
  overflowAnimation = animate(overflow, 0, { type: 'spring', bounce: 0.4, duration: 500 });
};

const handleMouseEnter = () => {
  if (scaleAnimation) {
    cancelAnimationFrame(scaleAnimation);
  }
  scaleAnimation = animate(scale, 1.2, { duration: 200 });
};

const handleMouseLeave = () => {
  if (scaleAnimation) {
    cancelAnimationFrame(scaleAnimation);
  }
  scaleAnimation = animate(scale, 1, { duration: 200 });
};

const handleTouchStart = () => {
  if (scaleAnimation) {
    cancelAnimationFrame(scaleAnimation);
  }
  scaleAnimation = animate(scale, 1.2, { duration: 200 });
};

const handleTouchEnd = () => {
  if (scaleAnimation) {
    cancelAnimationFrame(scaleAnimation);
  }
  scaleAnimation = animate(scale, 1, { duration: 200 });
};

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return;

  let nextValue = value.value;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    nextValue -= props.stepSize;
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    nextValue += props.stepSize;
  } else if (event.key === 'Home') {
    nextValue = props.startingValue;
  } else if (event.key === 'End') {
    nextValue = props.maxValue;
  } else {
    return;
  }

  event.preventDefault();
  value.value = Math.min(Math.max(nextValue, props.startingValue), props.maxValue);
};

onMounted(() => {
  value.value = props.defaultValue;
});
</script>
