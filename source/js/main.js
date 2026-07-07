// utils
const util = {

  // https://github.com/jerryc127/hexo-theme-butterfly
  diffDate: (d, more = false) => {
    const dateNow = new Date()
    const datePost = new Date(d)
    const dateDiff = dateNow.getTime() - datePost.getTime()
    const minute = 1000 * 60
    const hour = minute * 60
    const day = hour * 24

    let result
    if (more) {
      const dayCount = dateDiff / day
      const hourCount = dateDiff / hour
      const minuteCount = dateDiff / minute

      if (dayCount > 14) {
        result = null
      } else if (dayCount >= 1) {
        result = parseInt(dayCount) + ' ' + ctx.date_suffix.day
      } else if (hourCount >= 1) {
        result = parseInt(hourCount) + ' ' + ctx.date_suffix.hour
      } else if (minuteCount >= 1) {
        result = parseInt(minuteCount) + ' ' + ctx.date_suffix.min
      } else {
        result = ctx.date_suffix.just
      }
    } else {
      result = parseInt(dateDiff / day)
    }
    return result
  },

  copy: (id, msg) => {
    const el = document.getElementById(id);
    if (el) {
      el.select();
      navigator.clipboard.writeText(el.value).then(() => {
        if (msg && msg.length > 0) {
          hud.toast(msg, 2500);
        }
      }).catch(() => {});
    }
  },

  toggle: (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle("display");
    }
  },

  scrollTop: () => {
    smoothScrollTo(0);
  },

  scrollComment: () => {
    const el = document.getElementById('comments');
    if (el) {
      smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - 32);
    }
  },

  viewportLazyload: (target, func, enabled = true) => {
    if (!enabled || !("IntersectionObserver" in window)) {
      func();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].intersectionRatio > 0) {
        func();
        observer.disconnect();
      }
    });
    observer.observe(target);
  }
}

const hud = {
  toast: (msg, duration) => {
    const d = Number(isNaN(duration) ? 2000 : duration);
    var el = document.createElement('div');
    el.classList.add('toast');
    el.classList.add('show');
    el.innerHTML = msg;
    document.body.appendChild(el);

    setTimeout(function () { document.body.removeChild(el) }, d);

  },

}

// defines

const l_body = document.querySelector('.l_body');

// 通用平滑滚动（自定义动画，TOC / 回到顶部 / 参与讨论共用）
let scrollAnim = null;
function cancelSmoothScroll() {
  if (scrollAnim !== null) {
    cancelAnimationFrame(scrollAnim);
    scrollAnim = null;
  }
}
function smoothScrollTo(targetY) {
  cancelSmoothScroll();
  targetY = Math.max(0, targetY);
  const startY = window.scrollY;
  const diff = targetY - startY;
  if (Math.abs(diff) < 2) {
    return;
  }
  // 短距离 300ms，长距离最多 600ms
  const duration = Math.min(600, Math.max(300, Math.abs(diff) * 0.15));
  const startTime = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    // 显式指定 instant，避免全局 scroll-behavior: smooth 与自定义动画叠加导致滚动变慢
    window.scrollTo({ top: startY + diff * eased, behavior: 'instant' });
    if (t < 1) {
      scrollAnim = requestAnimationFrame(step);
    } else {
      scrollAnim = null;
    }
  }
  scrollAnim = requestAnimationFrame(step);
}
window.addEventListener('wheel', cancelSmoothScroll, { passive: true });
window.addEventListener('touchstart', cancelSmoothScroll, { passive: true });

// 远程 md（mdrender 服务）渲染完成后重建右栏 TOC：结构与服务端 toc() 输出一致
let tocClickBound = false;
function rebuildToc(scope) {
  const widget = document.querySelector('#data-toc');
  if (!widget) {
    return;
  }
  const body = widget.querySelector('.widget-body');
  if (!body) {
    return;
  }
  const article = scope && scope.closest ? scope.closest('article.md-text') : null;
  const root = article || document.querySelector('article.md-text');
  if (!root) {
    return;
  }
  const headings = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
  if (headings.length === 0) {
    return;
  }
  const ol = document.createElement('ol');
  ol.className = 'toc';
  const stack = [];
  headings.forEach(function (h) {
    const id = h.id;
    if (!id) {
      return;
    }
    const level = parseInt(h.tagName.substring(1), 10);
    const li = document.createElement('li');
    li.className = 'toc-item toc-level-' + level;
    const a = document.createElement('a');
    a.className = 'toc-link';
    a.href = '#' + encodeURIComponent(id);
    const span = document.createElement('span');
    span.className = 'toc-text';
    span.textContent = h.textContent.trim();
    a.appendChild(span);
    li.appendChild(a);
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    if (stack.length === 0) {
      ol.appendChild(li);
    } else {
      const parent = stack[stack.length - 1];
      if (!parent.childOl) {
        parent.childOl = document.createElement('ol');
        parent.childOl.className = 'toc-child';
        parent.li.appendChild(parent.childOl);
      }
      parent.childOl.appendChild(li);
    }
    stack.push({ level: level, li: li });
  });
  body.innerHTML = '';
  body.appendChild(ol);
  bindTocClick(widget);
}

function bindTocClick(widget) {
  if (tocClickBound) {
    return;
  }
  tocClickBound = true;
  widget.addEventListener('click', function (e) {
    const link = e.target.closest('a.toc-link');
    if (!link) {
      return;
    }
    const href = link.getAttribute('href');
    const id = href && href.indexOf('#') === 0 ? decodeURIComponent(href.slice(1)) : null;
    const target = id && document.getElementById(id);
    if (target) {
      e.preventDefault();
      const offset = 32;
      const targetY = target.getBoundingClientRect().top + window.scrollY - offset;
      smoothScrollTo(targetY);
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', href);
      }
    }
  });
}

// 远程 md 渲染完成后由页面层重建右栏 TOC
document.addEventListener('stellar:mdrender', function (e) {
  rebuildToc(e.detail && e.detail.target);
});


const init = {
  toc: () => {
    const scrollOffset = 32;
    // 滚动位置取整后标题顶可能落在偏移线下方 1~2px，加容差避免高亮回跳到上一条
    const scrollTolerance = 4;
    function activeTOC() {
      // 每次滚动动态查询：远程 md 内容渲染后标题才存在
      var segs = utils.qsa("article.md-text h1, article.md-text h2, article.md-text h3, article.md-text h4, article.md-text h5, article.md-text h6");
      var scrollTop = window.scrollY;
      var topSeg = null;
      for (var i = 0; i < segs.length; i++) {
        var segTop = segs[i].getBoundingClientRect().top + window.scrollY;
        if (segTop > scrollTop + scrollOffset + scrollTolerance) {
          continue;
        }
        if (!topSeg || segTop >= topSeg.getBoundingClientRect().top + window.scrollY) {
          topSeg = segs[i];
        }
      }
      if (topSeg) {
        utils.dom("#data-toc a.toc-link").removeClass("active");
        var id = topSeg.getAttribute("id");
        var link = id ? "#" + id : "#undefined";
        if (link != '#undefined') {
          const highlightItem = utils.dom('#data-toc a.toc-link[href="' + encodeURI(link) + '"]');
          if (highlightItem.length > 0) {
            highlightItem.addClass("active");
          }
        } else {
          const first = utils.qs('#data-toc a.toc-link');
          if (first) first.classList.add("active");
        }
      }
    }
    function scrollTOC() {
      const e0 = document.querySelector('#data-toc .toc');
      const e1 = document.querySelector('#data-toc .toc a.toc-link.active');
      if (e0 == null || e1 == null) {
        return;
      }
      const offsetBottom = e1.getBoundingClientRect().bottom - e0.getBoundingClientRect().bottom + 100;
      const offsetTop = e1.getBoundingClientRect().top - e0.getBoundingClientRect().top - 64;
      if (offsetTop < 0) {
        e0.scrollBy({ top: offsetTop, behavior: "smooth" });
      } else if (offsetBottom > 0) {
        e0.scrollBy({ top: offsetBottom, behavior: "smooth" });
      }
    }

    var timeout = null;
    window.addEventListener('scroll', function () {
      activeTOC();
      if (timeout !== null) clearTimeout(timeout);
      timeout = setTimeout(function () {
        scrollTOC();
      }, 50);
    });
  },
  sidebar: () => {
    utils.dom("#data-toc a.toc-link").click(function (e) {
      const href = this.getAttribute("href");
      const id = href && href.indexOf("#") === 0 ? decodeURIComponent(href.slice(1)) : null;
      const target = id && document.getElementById(id);
      if (target) {
        e.preventDefault();
        const offset = 32; // 与 activeTOC 的 scrollOffset 保持一致
        const targetY = target.getBoundingClientRect().top + window.scrollY - offset;
        smoothScrollTo(targetY);
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", href);
        }
      }
      sidebar.dismiss();
    });
  },
  wikiStart: () => {
    utils.dom('#l_cover .l_cover.wiki .start-wrap a.button.start').click(function (e) {
      const href = this.getAttribute("href");
      const id = href && href.indexOf("#") === 0 ? decodeURIComponent(href.slice(1)) : null;
      const target = id && document.getElementById(id);
      if (target) {
        e.preventDefault();
        // #start 锚点贴顶滚动，不预留 offset
        const offset = 0;
        smoothScrollTo(target.getBoundingClientRect().top + window.scrollY - offset);
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", href);
        }
      }
    });
  },
  leftbarScroll: () => {
    const container = document.querySelector('.l_left .widgets');
    if (container == null) {
      return;
    }
    const PREFIX = 'Stellar.leftbarScroll.';
    const encode = (s) => encodeURIComponent(String(s || ''));
    function scope() {
      const wikiEl = document.querySelector('.doc-tree[data-wiki]');
      if (wikiEl != null) {
        return 'wiki:' + encode(wikiEl.getAttribute('data-wiki'));
      }
      const notebookEl = document.querySelector('widget[data-notebook]');
      if (notebookEl != null) {
        return 'notebook:' + encode(notebookEl.getAttribute('data-notebook'));
      }
      const body = document.querySelector('.l_body');
      return 'layout:' + encode((body && body.getAttribute('layout')) || 'default');
    }
    window.addEventListener('pagehide', function () {
      try {
        const s = scope();
        sessionStorage.setItem(PREFIX + s, String(container.scrollTop));
        sessionStorage.setItem(PREFIX + 'last', s);
      } catch (e) {}
    });
    try {
      const s = scope();
      // 仅当上一页与当前页属于同一分区时才恢复，离开分区后再回来不跳回旧位置
      if (sessionStorage.getItem(PREFIX + 'last') !== s) {
        return;
      }
      const value = sessionStorage.getItem(PREFIX + s);
      if (value == null) {
        return;
      }
      container.scrollTop = parseInt(value, 10) || 0;
      const link = container.querySelector('a.link.active');
      if (link == null) {
        return;
      }
      const padding = 16;
      const containerRect = container.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const top = linkRect.top - containerRect.top;
      const bottom = linkRect.bottom - containerRect.top;
      if (top < 0) {
        container.scrollTop += top - padding;
      } else if (bottom > container.clientHeight) {
        container.scrollTop += bottom - container.clientHeight + padding;
      }
    } catch (e) {}
  },
  relativeDate: (selector) => {
    selector.forEach(item => {
      const $this = item
      const timeVal = $this.getAttribute('datetime')
      let relativeValue = util.diffDate(timeVal, true)
      if (relativeValue) {
        $this.innerText = relativeValue
      }
    })
  },
  /**
   * Tabs tag listener (without twitter bootstrap).
   */
  registerTabsTag: function () {
    // Binding `nav-tabs` & `tab-content` by real time permalink changing.
    document.querySelectorAll('.tabs .nav-tabs .tab').forEach(element => {
      element.addEventListener('click', event => {
        event.preventDefault();
        // Prevent selected tab to select again.
        if (element.classList.contains('active')) return;
        // Add & Remove active class on `nav-tabs` & `tab-content`.
        [...element.parentNode.children].forEach(target => {
          target.classList.toggle('active', target === element);
        });
        // https://stackoverflow.com/questions/20306204/using-queryselector-with-ids-that-are-numbers
        const tActive = document.getElementById(element.querySelector('a').getAttribute('href').replace('#', ''));
        [...tActive.parentNode.children].forEach(target => {
          target.classList.toggle('active', target === tActive);
        });
        // Trigger event
        tActive.dispatchEvent(new Event('tabs:click', {
          bubbles: true
        }));
      });
    });

    window.dispatchEvent(new Event('tabs:register'));
  },

  canonicalCheck: () => {
    const canonical = window.canonical;
    // 真实主站域名优先从 encoded（base64）反解，避免被「批量替换域名」的克隆站把提示指向自己
    const getOriginalHost = () => {
      try {
        return atob(canonical.encoded || '') || canonical.originalHost || '';
      } catch (e) {
        return canonical.originalHost || '';
      }
    };
    function originStatusCheck() {
      return new Promise((resolve) => {
        if (getOriginalHost() === window.location.hostname) {
          resolve(true);
          return;
        }
        const scriptUrl = `https://${getOriginalHost()}${window.canonical.param.checklink}`;
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.type = 'text/javascript';
        script.onload = function () { resolve(true); };
        script.onerror = function () { resolve(false); };
        document.head.appendChild(script);
      });
    }
    async function showTip(isOfficial = false) {
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex, nofollow';
      document.head.appendChild(meta);
      const notice = document.createElement('div');
      const originalURL = `https://${getOriginalHost()}`;
      let currentURL = originalURL;
      if (canonical.param.permalink && canonical.param.permalink.startsWith("http")) {
        try {
          const permalinkURL = new URL(canonical.param.permalink);
          currentURL = `${originalURL}${permalinkURL.pathname}${permalinkURL.search}`;
        } catch (e) {
          // permalink 异常时退回源站首页
        }
      }
      if (isOfficial) {
        if (!(await originStatusCheck())) return;
        notice.className = 'canonical-tip official';
        notice.innerHTML = `
          <a href="${currentURL}" target="_self" rel="noopener noreferrer">
          本站为官方备用站，仅供应急。点击移步主站<br>${originalURL}
          </a>
        `;
      } else {
        notice.className = 'canonical-tip unofficial';
        notice.innerHTML = `
        <a href="${currentURL}" target="_self" rel="noopener noreferrer">
        <div class="headline icon">☠️</div>
        本站为非法克隆站，请前往官方源站访问。<br>
        源站：${originalURL}
        </a>
        `;
      }
      document.body.appendChild(notice);
    }
    if (!getOriginalHost()) return;
    const currentURL = new URL(window.location.href);
    const currentHost = currentURL.hostname.replace(/^www\./, '');
    if (currentHost == 'localhost') return;
    const encodedCurrentHost = window.btoa(currentHost);
    const isCurrentHostValid = canonical.encoded === encodedCurrentHost;
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      if (isCurrentHostValid) {
        return;
      }
      if (canonical.officialHosts?.includes(currentHost)) {
        showTip(true);
        return;
      }
      showTip(false);
      return;
    }
    const canonicalURL = new URL(canonicalTag.href);
    const canonicalHost = canonicalURL.hostname.replace(/^www\./, '');
    const encodedCanonicalHost = window.btoa(canonicalHost);
    const isCanonicalHostValid = canonical.encoded === encodedCanonicalHost;
    if (isCanonicalHostValid && isCurrentHostValid) {
      return;
    }
    showTip(canonical.officialHosts?.includes(currentHost));
  }

}


// Stellar namespace
window.stellar = window.stellar || {};

/**
 * Initialize page components
 */
stellar.initPage = function () {
  init.toc();
  init.sidebar();
  init.wikiStart();
  init.leftbarScroll();
  init.relativeDate(document.querySelectorAll('#post-meta time'));
  init.registerTabsTag();
  init.revisionHistory();
};

// Initial page load
init.revisionHistory = function () {
  const revisionSection = document.getElementById('revision-history');
  if (!revisionSection) {
    return;
  }

  const loadingEl = revisionSection.querySelector('.revision-history-loading');
  const listEl = revisionSection.querySelector('.revision-history-list');
  if (!loadingEl || !listEl) {
    return;
  }

  // Add toggle functionality
  const toggleBtn = revisionSection.querySelector('.revision-history-toggle');
  const bodyEl = revisionSection.querySelector('.body');
  if (toggleBtn && bodyEl) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = bodyEl.classList.toggle('collapsed');
      toggleBtn.textContent = isCollapsed ? '▶' : '▼';
      toggleBtn.setAttribute('aria-expanded', !isCollapsed);
    });
  }

  function normalizePath(pathname) {
    const root = ctx.root || '/';
    let relative = pathname;
    if (relative.startsWith(root)) {
      relative = relative.slice(root.length);
    }
    if (relative.endsWith('/')) {
      relative += 'index';
    } else if (relative.endsWith('.html')) {
      relative = relative.slice(0, -5);
    }
    if (relative.startsWith('/')) {
      relative = relative.slice(1);
    }
    return relative;
  }

  function getRevisionJsonUrl() {
    const pathname = window.location.pathname;
    const relativePath = normalizePath(pathname);
    const root = ctx.root || '/';
    return `${root}json/revisions/${relativePath}.json`;
  }

  const dateTimeFormatOptions = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  };

  const pad = (n) => String(n).padStart(2, '0');

  const localFormatter = new Intl.DateTimeFormat('en-CA', {
    ...dateTimeFormatOptions,
    timeZoneName: 'shortOffset'
  });

  function formatLocalDateTime(date) {
    try {
      const parts = localFormatter.formatToParts(date);
      const get = (type) => parts.find(p => p.type === type)?.value || '';
      let tzName = get('timeZoneName');
      if (!tzName) {
        const offset = -date.getTimezoneOffset();
        const tzHours = Math.floor(Math.abs(offset) / 60);
        const tzMinutes = Math.abs(offset) % 60;
        const tzSign = offset >= 0 ? '+' : '-';
        tzName = `GMT${tzSign}${tzMinutes === 0 ? tzHours : `${tzHours}:${pad(tzMinutes)}`}`;
      }
      return `${get('year')}/${get('month')}/${get('day')}, ${get('hour')}:${get('minute')}:${get('second')} (${tzName})`;
    } catch (e) {
      const offset = -date.getTimezoneOffset();
      const tzHours = Math.floor(Math.abs(offset) / 60);
      const tzMinutes = Math.abs(offset) % 60;
      const tzSign = offset >= 0 ? '+' : '-';
      const tzStr = tzMinutes === 0 ? `${tzHours}` : `${tzHours}:${pad(tzMinutes)}`;
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} (GMT${tzSign}${tzStr})`;
    }
  }

  function formatDateTimeWithTimezone(date, timezone) {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const offsetMatch = timezone.match(/^([+-])(\d+)(?::(\d+))?$/);
    if (!offsetMatch) {
      return formatLocalDateTime(date);
    }
    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const hours = parseInt(offsetMatch[2], 10);
    const minutes = parseInt(offsetMatch[3] || '0', 10);
    const offsetMs = sign * (hours * 3600000 + minutes * 60000);
    const d = new Date(utc + offsetMs);
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} (GMT${timezone})`;
  }

  function renderHistory(data) {
    const revisions = data.revisions || [];
    const countEl = revisionSection.querySelector('.revision-history-count');
    const toggleBtn = revisionSection.querySelector('.revision-history-toggle');
    const bodyEl = revisionSection.querySelector('.body');

    if (revisions.length === 0) {
      if (countEl) countEl.textContent = '此页面暂无修订历史';
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (bodyEl) bodyEl.style.display = 'none';
      loadingEl.remove();
      return;
    }

    if (countEl) countEl.textContent = `此页面经过 ${revisions.length} 次修订`;
    if (toggleBtn) toggleBtn.style.display = '';
    if (bodyEl) bodyEl.style.display = '';

    loadingEl.remove();
    const list = document.createElement('ul');
    list.className = 'revision-history-list-items';

    revisions.forEach((revision) => {
      const item = document.createElement('li');
      item.className = 'revision-history-item';
      const shortHash = revision.hash.substring(0, 7);
      const commitUrl = `https://github.com/SheepYhangCN/sheepyhangcn.github.io/commit/${revision.hash}`;
      const tooltip = revision.description || revision.subject || '';
      const escapedTooltip = tooltip
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const localDate = new Date(revision.date);
      const localTimeStr = formatLocalDateTime(localDate);
      const originalTimeStr = revision.timezone
        ? formatDateTimeWithTimezone(localDate, revision.timezone)
        : localTimeStr;

      item.innerHTML = `
        <div class="revision-history-meta">
          <div class="revision-history-title" title="${escapedTooltip}">${revision.subject}</div>
          <div class="revision-history-hash">
            <a href="${commitUrl}" target="_blank" rel="noopener noreferrer">${shortHash}</a>
          </div>
        </div>
        <div class="revision-history-info">${revision.author} • <time datetime="${revision.date}" title="${originalTimeStr}">${localTimeStr}</time></div>
      `;
      list.appendChild(item);
    });

    listEl.appendChild(list);
  }

  const url = getRevisionJsonUrl();
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('No revision data');
      }
      return response.json();
    })
    .then(renderHistory)
    .catch(() => {
      const countEl = revisionSection.querySelector('.revision-history-count');
      const toggleBtn = revisionSection.querySelector('.revision-history-toggle');
      const bodyEl = revisionSection.querySelector('.body');
      if (countEl) countEl.textContent = '此页面暂无修订历史';
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (bodyEl) bodyEl.style.display = 'none';
      loadingEl.remove();
    });
};

stellar.initPage();
init.canonicalCheck();
