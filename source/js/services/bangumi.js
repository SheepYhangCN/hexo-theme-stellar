utils.jq(() => {
  $(function () {
    const cards = document.querySelectorAll('.poster-card[data-bangumi-id]');
    if (cards.length === 0) return;
    const default_cover = def.cover;

    for (let card of cards) {
      const bgmId = card.dataset.bangumiId;
      const apiHost = card.dataset.bangumiApi || 'https://api.bgm.tv';
      const api = `${apiHost}/v0/subjects/${bgmId}`;
      fetch(api).then(resp => {
        if (!resp.ok) throw new Error('Bangumi API 响应失败');
        return resp.json();
      }).then(data => {
        const title = data.name_cn || data.name;
        const cover = data.images?.common || default_cover;

        // 更新标题
        const caption = card.querySelector('.image-caption');
        if (caption) caption.textContent = title;

        // 创建真正的 lazy 图片元素替换占位
        const pending = card.querySelector('.bangumi-pending');
        if (pending) {
          const wrapper = pending.closest('.lazy-box');
          if (wrapper) {
            const icon = wrapper.querySelector('.lazy-icon');
            const img = document.createElement('img');
            img.className = 'lazy';
            img.dataset.src = cover;
            img.onerror = function() {
              this.removeAttribute('data-src');
              this.src = default_cover;
            };
            wrapper.insertBefore(img, icon);
            pending.remove();

            // 通知 LazyLoad 有新图片
            if (window.lazyLoadInstance?.update) {
              window.lazyLoadInstance.update();
            }
          }
        }
      }).catch(err => {
        console.warn('[bangumi] 请求失败:', api, err);
      });
    }
  });
});