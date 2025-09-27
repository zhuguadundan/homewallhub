import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 基本的日历事件接口
interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  description?: string
  type: 'task' | 'appointment' | 'reminder' | 'other'
}

export const useCalendarStore = defineStore('calendar', () => {
  // 状态
  const events = ref<CalendarEvent[]>([])
  const currentDate = ref<string>(new Date().toISOString().split('T')[0])
  const loading = ref(false)

  // 计算属性
  const todayEvents = computed(() => {
    return events.value.filter(event => event.date === currentDate.value)
  })

  const upcomingEvents = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return events.value.filter(event => event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
  })

  // 方法
  const setCurrentDate = (date: string) => {
    currentDate.value = date
  }

  const addEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: Date.now().toString()
    }
    events.value.push(newEvent)
  }

  const removeEvent = (eventId: string) => {
    const index = events.value.findIndex(event => event.id === eventId)
    if (index > -1) {
      events.value.splice(index, 1)
    }
  }

  const getEventsByDate = (date: string) => {
    return events.value.filter(event => event.date === date)
  }

  return {
    // 状态
    events,
    currentDate,
    loading,

    // 计算属性
    todayEvents,
    upcomingEvents,

    // 方法
    setCurrentDate,
    addEvent,
    removeEvent,
    getEventsByDate
  }
})