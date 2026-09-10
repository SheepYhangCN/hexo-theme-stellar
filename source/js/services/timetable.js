(async function () {
  for (const el of document.querySelectorAll('.ds-timetable')) {
      try {
        const response = await fetch(el.dataset.timetableSrc)
        const text = (await response.text()).replace(/^\uFEFF/, '')
        const segments = text.split(/\r?\n/).map(line => line.trim().replace(/,$/, '')).filter(Boolean).map(line => JSON.parse(line))
        if (segments.length !== 5 || !Array.isArray(segments[1]) || !Array.isArray(segments[3]) || !Array.isArray(segments[4])) throw new Error('课表数据必须包含五段 JSON')
        const [, nodeTimes, meta, courses, arrangements] = segments
        const nodes = nodeTimes.filter(item => item.node >= 1 && item.node <= meta.nodes)
        const days = []
        if (meta.showSun) days.push(7)
        days.push(1, 2, 3, 4, 5)
        if (meta.showSat) days.push(6)
        const labels = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
        const maxWeek = Math.max(1, Number(meta.maxWeek) || 1)
        const dateParts = String(meta.startDate || '').split('-').map(Number)
        const startDate = dateParts.length === 3 ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2]) : null
        const currentWeek = () => startDate && !Number.isNaN(startDate.getTime()) ? Math.min(Math.max(Math.floor((Date.now() - startDate.getTime()) / 86400000 / 7) + 1, 1), maxWeek) : 1
        const requestedWeek = Number(new URLSearchParams(location.search).get('week'))
        let selectedWeek = requestedWeek >= 1 && requestedWeek <= maxWeek ? requestedWeek : currentWeek()
        const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
        const normalizeColor = raw => /^#[0-9a-f]{8}$/i.test(raw || '') ? `#${raw.slice(3)}` : (raw || '#6b7280')
        const courseMap = new Map(courses.map(course => [course.id, course]))
        el.innerHTML = `<div class="timetable-header"><strong>${escapeHtml(meta.tableName || '课表')}</strong><div class="timetable-week-controls"><div class="timetable-week-line"><button class="timetable-week-prev" type="button" aria-label="上一周">&#8592;</button><label>第 <select class="timetable-week" aria-label="选择周次">${Array.from({ length: maxWeek }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select> 周</label><button class="timetable-week-next" type="button" aria-label="下一周">&#8594;</button></div><span class="timetable-current-week" hidden>当前周</span></div></div><div class="timetable-live" aria-live="polite"><b class="timetable-live-status">正在加载</b><span class="timetable-live-next"></span></div><div class="timetable-scroll"><table><colgroup><col class="timetable-period-column">${days.map(() => '<col>').join('')}</colgroup><thead><tr><th>节次</th>${days.map(day => `<th>${labels[day]}</th>`).join('')}</tr></thead><tbody></tbody></table></div>`
        const tableBody = el.querySelector('tbody')
        const select = el.querySelector('.timetable-week')
        const previous = el.querySelector('.timetable-week-prev')
        const next = el.querySelector('.timetable-week-next')
        const currentBadge = el.querySelector('.timetable-current-week')
        const parseTime = value => { const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/); return match ? Number(match[1]) * 60 + Number(match[2]) : null }
        const renderTable = week => {
          const occupiedUntil = new Map()
          let body = ''
          nodes.forEach((node, nodeIndex) => {
            body += `<tr><th>${node.node}<small>${escapeHtml(node.startTime)}<br>${escapeHtml(node.endTime)}</small></th>`
            days.forEach(day => {
              if ((occupiedUntil.get(day) || 0) > nodeIndex) return
              const items = arrangements.filter(item => item.day === day && item.startNode === node.node && week >= (item.startWeek || 1) && week <= (item.endWeek || maxWeek))
              const rowSpan = Math.min(Math.max(...items.map(item => item.step || 1), 1), nodes.length - nodeIndex)
              if (rowSpan > 1) occupiedUntil.set(day, nodeIndex + rowSpan)
              body += `<td${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}>`
              items.forEach(item => {
                const course = courseMap.get(item.id) || {}
                const endNode = Math.min(item.startNode + (item.step || 1) - 1, meta.nodes)
                const endTime = nodeTimes.find(time => time.node === endNode)?.endTime || node.endTime
                body += `<div class="timetable-course" data-day="${day}" data-start-time="${escapeHtml(node.startTime)}" data-end-time="${escapeHtml(endTime)}" style="--course-color:${normalizeColor(course.color)}"><b>${escapeHtml(course.courseName || `课程 #${item.id}`)}</b><small>第 ${item.startNode}-${endNode} 节<br>${escapeHtml(node.startTime)}-${escapeHtml(endTime)}</small><small>${escapeHtml(item.room || '未填写')}</small><small>${escapeHtml(item.teacher || '未填写')}</small></div>`
              })
              body += '</td>'
            })
            body += '</tr>'
          })
          tableBody.innerHTML = body
        }
        const renderLive = () => {
          const now = new Date()
          const day = now.getDay() || 7
          const week = currentWeek()
          const minute = now.getHours() * 60 + now.getMinutes()
          const today = arrangements.filter(item => item.day === day && week >= (item.startWeek || 1) && week <= (item.endWeek || maxWeek)).map(item => { const course = courseMap.get(item.id) || {}; const start = parseTime(nodeTimes.find(time => time.node === item.startNode)?.startTime); const endNode = Math.min(item.startNode + (item.step || 1) - 1, meta.nodes); const end = parseTime(nodeTimes.find(time => time.node === endNode)?.endTime); return { start, end, name: course.courseName || `课程 #${item.id}`, room: item.room || '未填写' } }).filter(item => item.start !== null && item.end !== null).sort((a, b) => a.start - b.start)
          const active = today.find(item => minute >= item.start && minute < item.end)
          const upcoming = today.find(item => item.start > minute)
          el.querySelector('.timetable-live-status').textContent = active ? '正在上课' : (day >= 6 ? '周末' : (today.length && upcoming ? '课前' : today.length ? '今日课毕' : '今日无课'))
          el.querySelector('.timetable-live-next').textContent = active ? `${active.name}\n${active.room}\n${active.end - minute}分钟后下课` : (upcoming ? `下一节：${upcoming.name}\n${upcoming.room}\n${upcoming.start - minute}分钟后上课` : '')
          el.querySelectorAll('.timetable-course').forEach(card => card.classList.remove('is-current'))
          el.querySelectorAll('td.is-current').forEach(cell => {
            cell.classList.remove('is-current')
            cell.style.removeProperty('--course-color')
          })
          if (active && selectedWeek === week) {
            el.querySelectorAll('.timetable-course').forEach(card => {
              if (Number(card.dataset.day) === day && parseTime(card.dataset.startTime) === active.start && parseTime(card.dataset.endTime) === active.end) {
                card.classList.add('is-current')
                const cell = card.closest('td')
                cell?.classList.add('is-current')
                cell?.style.setProperty('--course-color', getComputedStyle(card).getPropertyValue('--course-color'))
              }
            })
          }
        }
        const update = week => { selectedWeek = Math.min(Math.max(Number(week) || 1, 1), maxWeek); renderTable(selectedWeek); select.value = String(selectedWeek); previous.disabled = selectedWeek <= 1; next.disabled = selectedWeek >= maxWeek; currentBadge.hidden = selectedWeek !== currentWeek(); const url = new URL(location.href); url.searchParams.set('week', selectedWeek); history.replaceState(null, '', url); renderLive() }
        select.addEventListener('change', event => update(event.target.value))
        previous.addEventListener('click', () => update(selectedWeek - 1))
        next.addEventListener('click', () => update(selectedWeek + 1))
        update(selectedWeek)
        window.setInterval(renderLive, 30000)
      } catch (error) {
        el.innerHTML = `<div class="timetable-error">课表加载失败：${String(error.message || error)}</div>`
      }
    }
})()
