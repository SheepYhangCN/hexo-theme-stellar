const { execFileSync } = require('child_process');
const path = require('path');

function getGitLog(repoDir, relativePath) {
  try {
    const output = execFileSync(
      `git log --follow --format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e -- "${relativePath}" 2>nul`,
      { cwd: repoDir, encoding: 'utf8', shell: true }
    );
    return output.split('\x1e').map(line => line.trim()).filter(Boolean);
  } catch (err) {
    return [];
  }
}

function getGitFileContent(repoDir, hash, relativePath) {
  try {
    const output = execFileSync(
      `git show "${hash}:${relativePath}" 2>nul`,
      { cwd: repoDir, encoding: 'utf8', shell: true }
    );
    return output.replace(/\r\n/g, '\n');
  } catch (err) {
    return null;
  }
}

function normalizeSourcePath(baseDir, sourcePath) {
  const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.join(baseDir, sourcePath);
  return path.relative(baseDir, absolutePath).split(path.sep).join('/');
}

hexo.extend.generator.register('post_revision_history', function (locals) {
  const baseDir = this.base_dir;
  const results = [];

  // Collect all posts and pages
  const items = [];
  if (locals.posts) {
    locals.posts.each(post => items.push(post));
  }
  if (locals.pages) {
    locals.pages.each(page => items.push(page));
  }

  items.forEach(item => {
    const sourcePath = item.full_source || item.source;
    if (!sourcePath) {
      return;
    }

    const relativePath = normalizeSourcePath(baseDir, sourcePath);
    const logLines = getGitLog(baseDir, relativePath);
    if (logLines.length === 0) {
      return;
    }

    const revisions = [];
    for (const line of logLines) {
      const parts = line.split('\x1f');
      if (parts.length < 5) {
        continue;
      }
      const [hash, author, email, date, subject, ...bodyParts] = parts;
      const description = bodyParts.join('\x1f').trim();
      const content = getGitFileContent(baseDir, hash, relativePath);
      if (content == null) {
        continue;
      }
      revisions.push({
        hash,
        author,
        email,
        date,
        subject,
        description,
        content
      });
    }

    if (revisions.length === 0) {
      return;
    }

    let pathKey = item.path.replace(/\.html$/, '/index.json');
    if (pathKey.startsWith('/')) {
      pathKey = pathKey.slice(1);
    }
    const outPath = `json/revisions/${pathKey}`;
    results.push({
      path: outPath,
      data: JSON.stringify({
        path: item.path,
        revisions
      })
    });
  });

  return results;
});
