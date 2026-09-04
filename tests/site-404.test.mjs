import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const SITE = resolve(fileURLToPath(import.meta.url), '..', '..', 'site')

test('site build emits the documented 404 page', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'sliced-bread-site-404-'))
  const outputDirectory = join(temporary, 'dist')

  // Astro derives its internal prerender-output directory from
  // `process.cwd()`, not from `--outDir`: when `--outDir` doesn't start
  // with `process.cwd()`, Astro silently falls back to a `.astro/` cache
  // dir under `process.cwd()` and later `fs.rename`s assets from there into
  // `--outDir`, which fails with EXDEV once the two are on different
  // filesystems. Running the build with cwd set to the temp directory
  // itself (and `--root` pointed back at the checkout) keeps every path the
  // build touches under one filesystem without mutating the checkout. The
  // prerendered SSR chunk that Astro executes in-place also needs Node's
  // module resolution to find the site's dependencies by walking up from
  // its own location, so link (not copy) `node_modules` into the temp tree.
  await symlink(join(SITE, 'node_modules'), join(temporary, 'node_modules'), 'dir')

  try {
    const astroBin = join(SITE, 'node_modules', '.bin', 'astro')
    const result = spawnSync(astroBin, ['build', '--root', SITE, '--outDir', outputDirectory], {
      cwd: temporary,
      encoding: 'utf8',
    })
    const output = [result.stdout ?? '', result.stderr ?? '', result.error?.message ?? ''].join('')
    assert.equal(result.status, 0, output)
    assert.doesNotMatch(output, /Entry docs → 404 was not found/)

    const html = await readFile(join(outputDirectory, '404.html'), 'utf8')
    assert.match(html, /<h1[^>]*>\s*Page not found\s*<\/h1>/i)
    assert.match(html, /The documentation page you requested could not be found\./)
    assert.match(
      html,
      /<a[^>]+href="\/sliced-bread-architecture\/"[^>]*>\s*Return to the documentation\s*<\/a>/i,
    )
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
