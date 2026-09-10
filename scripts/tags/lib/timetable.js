'use strict'

const fs = require('fs')
const path = require('path')

const SEGMENT_COUNT = 5

function parseTimetableText(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  let segments
  try {
    const parsed = JSON.parse(text)
    segments = Array.isArray(parsed) && parsed.length === SEGMENT_COUNT ? parsed : null
  } catch (_) {
    segments = null
  }
  if (!segments) {
    if (lines.length !== SEGMENT_COUNT) {
      throw new Error(`课表数据必须包含 ${SEGMENT_COUNT} 段 JSON，当前为 ${lines.length} 段`)
    }
    segments = lines.map((line, index) => {
      try {
        return JSON.parse(line.replace(/,$/, ''))
      } catch (error) {
        throw new Error(`课表数据第 ${index + 1} 段解析失败：${error.message}`)
      }
    })
  }

  if (!segments[0] || typeof segments[0] !== 'object' || Array.isArray(segments[0]) ||
      !segments[2] || typeof segments[2] !== 'object' || Array.isArray(segments[2]) ||
      !Array.isArray(segments[1]) || !Array.isArray(segments[3]) || !Array.isArray(segments[4])) {
    throw new Error('课表数据结构错误：时间、课程或安排段必须为数组')
  }
  return {
    config: segments[0],
    nodeTimes: segments[1],
    meta: segments[2],
    courses: segments[3],
    arrangements: segments[4]
  }
}

function readTimetableSource(file) {
  const rawText = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  return rawText
    .split(/\r?\n/)
    .map(line => line.trim().replace(/,$/, ''))
    .filter(Boolean)
    .join('\n')
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char])
}

function currentWeek(startDate, maxWeek) {
  const parts = String(startDate || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return 1
  const start = new Date(parts[0], parts[1] - 1, parts[2])
  const week = Math.floor((Date.now() - start.getTime()) / 86400000 / 7) + 1
  return Math.min(Math.max(week, 1), Math.max(Number(maxWeek) || 1, 1))
}

function color(rawColor, index) {
  if (typeof rawColor === 'string' && /^#[0-9a-f]{8}$/i.test(rawColor)) return `#${rawColor.slice(3)}`
  return ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]
}

function buildLivePayload(data) {
  const courseMap = new Map(data.courses.map(course => [course.id, course]))
  return data.arrangements.map(item => {
    const course = courseMap.get(item.id) || {}
    const startTime = data.nodeTimes.find(time => time.node === item.startNode)
    const endNode = Math.min(item.startNode + (item.step || 1) - 1, data.meta.nodes)
    const endTime = data.nodeTimes.find(time => time.node === endNode)
    return {
      courseName: course.courseName || `课程 #${item.id}`,
      color: color(course.color, item.id),
      teacher: item.teacher || '未填写',
      room: item.room || '未填写',
      day: item.day,
      startWeek: item.startWeek || 1,
      endWeek: item.endWeek || data.meta.maxWeek || 1,
      startMinute: toMinutes(startTime?.startTime),
      endMinute: toMinutes(endTime?.endTime)
    }
  }).filter(item => item.startMinute !== null && item.endMinute !== null)
}

function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

module.exports = ctx => function(rawArgs) {
  return '<div class="tag-plugin timetable ds-timetable" data-timetable-src="/timetable.wakeup_schedule"><div class="timetable-loading">正在加载课表…</div></div>'
}