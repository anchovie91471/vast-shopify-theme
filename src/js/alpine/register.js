// src/js/alpine/register.js

export function registerStores(Alpine, modules) {
  for (const path in modules) {
    const store = modules[path]
    const name = store.name
    const storeInstance = store.store()
    Alpine.store(name, storeInstance)
    if (typeof storeInstance.init === 'function') {
      storeInstance.init()
    }
  }
}

export function registerComponents(Alpine, modules) {
  const seen = new Set()
  for (const path in modules) {
    const name = path.split('/').pop().replace('.js', '')
    if (seen.has(name)) {
      console.warn(
        `[VAST] Component "${name}" registered twice in this scope. Later definition wins. Path: ${path}`
      )
    }
    seen.add(name)
    if (name && modules[path]) {
      Alpine.data(name, modules[path])
    }
  }
}
