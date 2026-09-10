/* global hexo */

'use strict'

const fs = require('fs')
const path = require('path')

hexo.extend.generator.register('timetable_schedule', function() {
  const file = path.join(hexo.source_dir, '_data', 'timetable.wakeup_schedule')
  if (!fs.existsSync(file)) return []
  return [{
    path: 'timetable.wakeup_schedule',
    data: fs.readFileSync(file, 'utf8')
  }]
})