<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'

import type { WritingCalendarDayVm } from '@/entities/user'
import RollingNumber from './RollingNumber.vue'

const props = defineProps<{
  days: WritingCalendarDayVm[]
}>()

interface CalendarCell {
  key: string
  date: Dayjs
  wordCount: number
  level: number
  isFuture: boolean
  isOutsideYear: boolean
}

const levelSamples = [0, 1, 2, 3, 4]
const weekdayLabels = [
  { row: 2, label: '周一' },
  { row: 4, label: '周三' },
  { row: 6, label: '周五' },
]

const today = computed(() => dayjs().startOf('day'))
const selectedYear = ref(today.value.year())
const isCalendarSwitching = ref(false)
let calendarSwitchTimer: ReturnType<typeof setTimeout> | null = null
const yearOptions = computed(() => {
  const currentYear = today.value.year()
  return [currentYear, currentYear - 1, currentYear - 2]
})
const activeYearIndex = computed(() => Math.max(0, yearOptions.value.indexOf(selectedYear.value)))
const yearIndicatorStyle = computed(() => ({
  '--active-year-y': `${activeYearIndex.value * 2.83}rem`,
  '--active-year-x': `${activeYearIndex.value * 5}rem`,
}))
const yearStartDate = computed(() => dayjs(`${selectedYear.value}-01-01`).startOf('day'))
const yearEndDate = computed(() => dayjs(`${selectedYear.value}-12-31`).startOf('day'))
const startDate = computed(() => yearStartDate.value.startOf('week').startOf('day'))
const endDate = computed(() => yearEndDate.value.endOf('week').startOf('day'))

const wordCountByDate = computed(() => {
  const result = new Map<string, number>()
  props.days.forEach((day) => {
    if (!day.date) return
    result.set(day.date, Math.max(0, Number(day.wordCount) || 0))
  })
  return result
})

function resolveLevel(wordCount: number): number {
  if (wordCount <= 0) return 0
  if (wordCount < 300) return 1
  if (wordCount < 800) return 2
  if (wordCount < 1500) return 3
  return 4
}

const calendarCells = computed<CalendarCell[]>(() => {
  const cells: CalendarCell[] = []
  let cursor = startDate.value

  while (cursor.isBefore(endDate.value) || cursor.isSame(endDate.value, 'day')) {
    const key = cursor.format('YYYY-MM-DD')
    const isFuture = cursor.isAfter(today.value, 'day')
    const isOutsideYear = cursor.year() !== selectedYear.value
    const wordCount = isFuture || isOutsideYear ? 0 : wordCountByDate.value.get(key) ?? 0

    cells.push({
      key,
      date: cursor,
      wordCount,
      level: isFuture ? 0 : resolveLevel(wordCount),
      isFuture,
      isOutsideYear,
    })
    cursor = cursor.add(1, 'day')
  }

  return cells
})

const weeks = computed(() => {
  const result: CalendarCell[][] = []
  for (let index = 0; index < calendarCells.value.length; index += 7) {
    result.push(calendarCells.value.slice(index, index + 7))
  }
  return result
})

const weekCount = computed(() => weeks.value.length)
const activeDays = computed(() => calendarCells.value.filter((day) => !day.isFuture && !day.isOutsideYear && day.wordCount > 0).length)
const totalWords = computed(() =>
  calendarCells.value.reduce((sum, day) => sum + (day.isFuture || day.isOutsideYear ? 0 : day.wordCount), 0),
)

const monthLabels = computed(() =>
  weeks.value.map((week, weekIndex) => {
    const monthStart = week.find((day) => !day.isOutsideYear && day.date.date() <= 7)
    if (!monthStart) return ''

    const previousWeek = weeks.value[weekIndex - 1]
    if (previousWeek?.some((day) => !day.isOutsideYear && day.date.month() === monthStart.date.month())) {
      return ''
    }

    return monthStart.date.format('M月')
  }),
)

const summaryText = computed(() => {
  if (activeDays.value === 0) {
    return `${selectedYear.value} 年还没有创作记录`
  }
  return `${selectedYear.value} 年 ${activeDays.value} 天有创作，共 ${totalWords.value.toLocaleString('zh-CN')} 字`
})

function formatCellLabel(day: CalendarCell): string {
  const dateText = day.date.format('YYYY年M月D日')
  if (day.isOutsideYear) return `${dateText}，不属于 ${selectedYear.value} 年`
  if (day.isFuture) return `${dateText}，尚未开始`
  if (day.wordCount <= 0) return `${dateText}，没有创作记录`
  return `${dateText}，创作 ${day.wordCount.toLocaleString('zh-CN')} 字`
}

function selectYear(year: number) {
  if (year === selectedYear.value) return

  if (calendarSwitchTimer) {
    clearTimeout(calendarSwitchTimer)
  }

  isCalendarSwitching.value = true
  calendarSwitchTimer = setTimeout(() => {
    selectedYear.value = year
    calendarSwitchTimer = setTimeout(() => {
      isCalendarSwitching.value = false
      calendarSwitchTimer = null
    }, 90)
  }, 170)
}

onBeforeUnmount(() => {
  if (calendarSwitchTimer) {
    clearTimeout(calendarSwitchTimer)
  }
})
</script>

<template>
  <section
    class="profile-writing-calendar surface-1 rounded-[var(--radius-xl)] p-4 sm:p-5"
    :class="{ 'profile-writing-calendar--switching': isCalendarSwitching }"
  >
    <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">
          创作字数
        </h2>

      </div>
      <p
        class="profile-writing-calendar__summary text-sm text-[var(--color-text-muted)]"
        :aria-label="summaryText"
      >
        <RollingNumber :value="selectedYear" />
        <span> 年 </span>
        <RollingNumber :value="activeDays" />
        <span> 天有创作，共 </span>
        <RollingNumber :value="totalWords" />
        <span> 字</span>
      </p>
    </header>

    <div class="profile-writing-calendar__main mt-5">
      <div class="profile-writing-calendar__scroller">
        <div class="profile-writing-calendar__canvas">
          <div
            class="profile-writing-calendar__months"
            :style="{ '--week-count': weekCount }"
            aria-hidden="true"
          >
            <span
              v-for="(label, index) in monthLabels"
              :key="`${index}-${label}`"
              class="profile-writing-calendar__month"
            >
              {{ label }}
            </span>
          </div>

          <div class="profile-writing-calendar__body">
            <div
              class="profile-writing-calendar__weekdays"
              aria-hidden="true"
            >
              <span
                v-for="item in weekdayLabels"
                :key="item.label"
                :style="{ gridRow: item.row }"
              >
                {{ item.label }}
              </span>
            </div>

            <div
              class="profile-writing-calendar__cells"
              :style="{ '--week-count': weekCount }"
              role="img"
              :aria-label="summaryText"
            >
              <template v-for="week in weeks" :key="week[0]?.key">
                <span
                  v-for="day in week"
                  :key="day.key"
                  class="profile-writing-calendar__cell"
                  :class="[
                    `profile-writing-calendar__cell--level-${day.level}`,
                    {
                      'profile-writing-calendar__cell--future': day.isFuture,
                      'profile-writing-calendar__cell--outside-year': day.isOutsideYear,
                    },
                  ]"
                  :title="formatCellLabel(day)"
                  :aria-label="formatCellLabel(day)"
                />
              </template>
            </div>
          </div>
        </div>
      </div>

      <aside class="profile-writing-calendar__years" aria-label="选择年份">
        <span
          class="profile-writing-calendar__year-indicator"
          :style="yearIndicatorStyle"
          aria-hidden="true"
        />
        <button
          v-for="year in yearOptions"
          :key="year"
          type="button"
          class="profile-writing-calendar__year"
          :class="{ 'profile-writing-calendar__year--active': year === selectedYear }"
          @click="selectYear(year)"
        >
          {{ year }}
        </button>
      </aside>
    </div>

    <footer class="mt-4 flex flex-col gap-3 text-xs text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
      <span></span>
      <div class="profile-writing-calendar__legend" aria-hidden="true">
        <span>少</span>
        <span
          v-for="level in levelSamples"
          :key="level"
          class="profile-writing-calendar__legend-cell"
          :class="`profile-writing-calendar__legend-cell--level-${level}`"
        />
        <span>多</span>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.profile-writing-calendar {
  --calendar-ease: cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-glass-card);
}

.profile-writing-calendar__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.25rem;
  align-items: start;
  gap: 1.25rem;
}

.profile-writing-calendar__summary {
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  min-height: 1.25rem;
  white-space: nowrap;
  transition: opacity 220ms var(--calendar-ease);
}

.profile-writing-calendar__scroller {
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
  min-width: 0;
}

.profile-writing-calendar__canvas {
  min-width: max-content;
}

.profile-writing-calendar__months {
  display: grid;
  grid-template-columns: repeat(var(--week-count), 0.74rem);
  gap: 0.28rem;
  margin-left: 2.75rem;
  min-height: 1.25rem;
  color: var(--color-text-muted);
  font-size: 0.76rem;
  line-height: 1rem;
  transition: opacity 220ms var(--calendar-ease);
}

.profile-writing-calendar__month {
  white-space: nowrap;
}

.profile-writing-calendar__body {
  display: flex;
  align-items: start;
  gap: 0.55rem;
}

.profile-writing-calendar__weekdays {
  display: grid;
  grid-template-rows: repeat(7, 0.74rem);
  gap: 0.28rem;
  width: 2.2rem;
  color: var(--color-text-muted);
  font-size: 0.76rem;
  line-height: 0.74rem;
  transition: opacity 220ms var(--calendar-ease);
}

.profile-writing-calendar__cells {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 0.74rem;
  grid-template-rows: repeat(7, 0.74rem);
  gap: 0.28rem;
  contain: layout paint style;
}

.profile-writing-calendar__cell {
  --cell-transition-duration: 180ms;
  --cell-transition-delay: 0ms;
  display: block;
  width: 0.74rem;
  height: 0.74rem;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 64%, transparent);
  border-radius: 0.2rem;
  background: color-mix(in srgb, var(--color-surface-elevated) 82%, var(--color-text) 5%);
  transition:
    filter var(--cell-transition-duration) var(--calendar-ease) var(--cell-transition-delay),
    opacity var(--cell-transition-duration) var(--calendar-ease) var(--cell-transition-delay);
}

.profile-writing-calendar__cell--level-1 {
  --cell-transition-duration: 220ms;
  --cell-transition-delay: 20ms;
  background: color-mix(in srgb, var(--color-success) 22%, var(--color-surface-elevated));
}

.profile-writing-calendar__cell--level-2 {
  --cell-transition-duration: 280ms;
  --cell-transition-delay: 45ms;
  background: color-mix(in srgb, var(--color-success) 42%, var(--color-surface-elevated));
}

.profile-writing-calendar__cell--level-3 {
  --cell-transition-duration: 340ms;
  --cell-transition-delay: 70ms;
  background: color-mix(in srgb, var(--color-success) 66%, var(--color-surface-elevated));
}

.profile-writing-calendar__cell--level-4 {
  --cell-transition-duration: 420ms;
  --cell-transition-delay: 95ms;
  background: color-mix(in srgb, var(--color-success) 92%, black 4%);
}

.profile-writing-calendar__cell--future {
  opacity: 0.34;
}

.profile-writing-calendar__cell--outside-year {
  opacity: 0.18;
}

.profile-writing-calendar__legend {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
}

.profile-writing-calendar__legend-cell {
  display: block;
  width: 0.74rem;
  height: 0.74rem;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 64%, transparent);
  border-radius: 0.2rem;
  background: color-mix(in srgb, var(--color-surface-elevated) 82%, var(--color-text) 5%);
}

.profile-writing-calendar__legend-cell--level-1 {
  background: color-mix(in srgb, var(--color-success) 22%, var(--color-surface-elevated));
}

.profile-writing-calendar__legend-cell--level-2 {
  background: color-mix(in srgb, var(--color-success) 42%, var(--color-surface-elevated));
}

.profile-writing-calendar__legend-cell--level-3 {
  background: color-mix(in srgb, var(--color-success) 66%, var(--color-surface-elevated));
}

.profile-writing-calendar__legend-cell--level-4 {
  background: color-mix(in srgb, var(--color-success) 92%, black 4%);
}

.profile-writing-calendar__years {
  position: relative;
  display: grid;
  gap: 0.28rem;
  overflow: hidden;
  border-radius: 0.85rem;
  padding: 0.25rem;
}

.profile-writing-calendar__year-indicator {
  position: absolute;
  left: 0.25rem;
  right: 0.25rem;
  top: 0.25rem;
  height: 2.55rem;
  border-radius: 0.7rem;
  background:
    linear-gradient(90deg, var(--color-primary), var(--color-primary-strong));
  transform: translateY(var(--active-year-y));
  transition:
    transform 440ms var(--calendar-ease);
  will-change: transform;
}

.profile-writing-calendar__year {
  position: relative;
  z-index: 1;
  min-height: 2.55rem;
  border-radius: 0.7rem;
  padding: 0.35rem 0.8rem;
  color: var(--color-text-muted);
  font-size: 0.92rem;
  text-align: left;
  will-change: transform;
  transition:
    background-color 340ms var(--calendar-ease),
    box-shadow 340ms var(--calendar-ease),
    color 340ms var(--calendar-ease),
    opacity 220ms var(--calendar-ease),
    transform 340ms var(--calendar-ease);
}

.profile-writing-calendar__year:hover {
  color: var(--color-text);
  transform: translateX(0.08rem);
}

.profile-writing-calendar__year--active {
  color: white;
  transform: translateX(0.18rem);
}

.profile-writing-calendar__year--active:hover {
  color: white;
  transform: translateX(0.18rem);
}

.profile-writing-calendar--switching .profile-writing-calendar__cell {
  --cell-transition-duration: 190ms;
  --cell-transition-delay: 0ms;
  filter: saturate(0.28);
  opacity: 0.18;
}

:global(html.theme-switching .profile-writing-calendar__cell),
:global(html.theme-settling .profile-writing-calendar__cell) {
  transition: none !important;
}

@media (max-width: 640px) {
  .profile-writing-calendar__main {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.85rem;
  }

  .profile-writing-calendar__years {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.1rem;
  }

  .profile-writing-calendar__year-indicator {
    top: 0.25rem;
    left: 0.25rem;
    right: auto;
    width: 4.5rem;
    height: 2.25rem;
    transform: translateX(var(--active-year-x));
  }

  .profile-writing-calendar__year {
    min-height: 2.25rem;
    min-width: 4.5rem;
    text-align: center;
  }

  .profile-writing-calendar__year:hover,
  .profile-writing-calendar__year--active,
  .profile-writing-calendar__year--active:hover {
    transform: none;
  }

  .profile-writing-calendar__months {
    margin-left: 2.45rem;
  }

  .profile-writing-calendar__weekdays {
    width: 1.9rem;
    font-size: 0.7rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-writing-calendar__cell,
  .profile-writing-calendar__months,
  .profile-writing-calendar__summary,
  .profile-writing-calendar__weekdays,
  .profile-writing-calendar__year,
  .profile-writing-calendar__year-indicator {
    transition-duration: 0.01ms !important;
  }

  .profile-writing-calendar__year,
  .profile-writing-calendar__year:hover,
  .profile-writing-calendar__year--active,
  .profile-writing-calendar__year--active:hover,
  .profile-writing-calendar__year-indicator {
    filter: none;
    transform: none;
  }
}
</style>
