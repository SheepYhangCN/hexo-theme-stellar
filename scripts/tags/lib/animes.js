'use strict'

/**
 * animes.js v2 — Bangumi 追番列表
 * 用法: {% animes <group> [size:xs/s/m/l/xl] %}
 * 从 _data/links/animes/ 读取番剧列表，支持 bangumi_id 自动获取封面和标题
 * API: https://api.bgm.tv/v0/subjects/{id}
 */

module.exports = ctx => function(args) {
  var args = ctx.args.map(args, ['size'], ['group'])
  const links = ctx.theme.config.links || {}
  if (args.size == null) {
    args.size = 'm'
  }

  var el = ''
  el += `<div class="data-service ds-bangumi"><div class="tag-plugin posters-wrap">`
  if (args.group) {
    el += `<div class="tag-plugin gallery grid-box" layout="grid" ratio="portrait" ${ctx.args.joinTags(args, ['size']).join(' ')}>`
    for (let item of (links[args.group] || [])) {
      if (item?.bangumi_id == null && !item?.url) continue
      const url = item.url || `https://bgm.tv/subject/${item.bangumi_id}`
      el += `<div class="grid-cell poster-card"`
      if (item.bangumi_id) {
        el += ` data-bangumi-id="${item.bangumi_id}"`
        if (item.bangumi_api) {
          el += ` data-bangumi-api="${item.bangumi_api}"`
        }
      }
      el += `>`
      el += `<a class="card-link lazy-box" target="_blank" rel="external nofollow noopener noreferrer" href="${url}">`
      if (item.bangumi_id) {
        // 由客户端 bangumi.js 通过 API 获取封面后再触发 lazy load
        el += `<img class="bangumi-pending" style="display:none"/>`
        el += `<div class="lazy-icon" style="background-image:url(${ctx.theme.config.default.loading});"></div>`
      } else {
        const cover = item.cover || item.icon || item.avatar || ctx.theme.config.default.cover
        el += `<img class="lazy" data-src="${cover}" onerror="javascript:this.removeAttribute(&quot;data-src&quot;);this.src=&quot;${ctx.theme.config.default.cover}&quot;;"/>`
        el += `<div class="lazy-icon" style="background-image:url(${ctx.theme.config.default.loading});"></div>`
      }
      el += `<div class="image-meta">`
      if (item.bangumi_id) {
        // 由 bangumi.js 从 API 获取标题后填充
        el += `<span class="image-caption">${item.title || ''}</span>`
      } else if (item.title) {
        el += `<span class="image-caption">${item.title}</span>`
      }
      el += `</div>`
      el += `</a>`
      el += `</div>`
    }
    el += `</div>`
  }
  el += `</div></div>`
  return el
}
