import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(ROOT, 'site')
const GENERATED_DIRECTORY = join(SITE, '.astro')
const GENERATED_FILES = [
  join(SITE, 'node_modules/.vite/deps/_metadata.json'),
  join(SITE, 'node_modules/.astro/data-store.json'),
]

async function optionalFile(path) {
  try {
    return await readFile(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if (error && error.code === 'ENOENT') return false
    throw error
  }
}

test('site build emits the documented 404 page', async () => {
  const temporary = await mkdtemp(join(SITE, '.site-test-'))
  const outputDirectory = join(temporary, 'dist')
  const directoryBackup = join(temporary, 'astro-cache')
  const hadGeneratedDirectory = await isDirectory(GENERATED_DIRECTORY)
  if (hadGeneratedDirectory) await cp(GENERATED_DIRECTORY, directoryBackup, { recursive: true })
  const generatedFilesBefore = await Promise.all(GENERATED_FILES.map(optionalFile))

  try {
    const result = spawnSync('npm', ['exec', '--', 'astro', 'build', '--outDir', outputDirectory], {
      cwd: SITE,
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
    await rm(GENERATED_DIRECTORY, { recursive: true, force: true })
    if (hadGeneratedDirectory) await cp(directoryBackup, GENERATED_DIRECTORY, { recursive: true })
    for (let index = 0; index < GENERATED_FILES.length; index += 1) {
      const path = GENERATED_FILES[index]
      const content = generatedFilesBefore[index]
      if (content === null) await rm(path, { force: true })
      else {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, content)
      }
    }
    await rm(temporary, { recursive: true, force: true })
  }
})
