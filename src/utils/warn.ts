/// <reference types="vite/client" />

const warnedKeys = new Set<string>()

export function warnOnce(key: string, message: string): void {
  if (
    import.meta.env.PROD ||
    runtimeNodeEnvironment() === 'production' ||
    warnedKeys.has(key)
  ) {
    return
  }

  warnedKeys.add(key)
  console.warn(message)
}

function runtimeNodeEnvironment() {
  return (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process
    ?.env?.NODE_ENV
}
