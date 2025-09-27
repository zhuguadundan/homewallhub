// 日期格式化工具函数

export function formatDate(dateStr: string | Date, format: string = 'YYYY-MM-DD HH:mm'): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) {
    return '无效日期'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return formatDate(date, 'MM-DD HH:mm')
}

export function getDefaultAvatar(name: string): string {
  // 根据名字生成默认头像URL或颜色
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
  const index = name.charCodeAt(0) % colors.length
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${colors[index].slice(1)}&color=fff`
}