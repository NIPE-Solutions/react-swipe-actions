import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'

const styleNames = ['core.css', 'theme.css', 'styles.css']
const defaultSourceDirectory = new URL('../src/styles/', import.meta.url)
const defaultOutputDirectory = new URL('../dist/', import.meta.url)

function asPath(pathOrUrl) {
  return pathOrUrl instanceof URL ? fileURLToPath(pathOrUrl) : pathOrUrl
}

function stylePath(directory, name) {
  return new URL(
    name,
    directory instanceof URL ? directory : pathToFileURL(`${directory}/`),
  )
}

export async function copyStyles({
  sourceDirectory = defaultSourceDirectory,
  outputDirectory = defaultOutputDirectory,
} = {}) {
  const outputPath = asPath(outputDirectory)
  await mkdir(outputPath, { recursive: true })

  await Promise.all(
    styleNames.map((name) =>
      copyFile(
        asPath(stylePath(sourceDirectory, name)),
        asPath(stylePath(outputDirectory, name)),
      ),
    ),
  )
}

if (import.meta.main) {
  await copyStyles()
}
