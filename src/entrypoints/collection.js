// src/entrypoints/collection.js
//
// Collection/search-scoped Alpine components. Loaded on templates
// matching `template == 'collection'`, `template contains 'collection.'`,
// or `template contains 'search'`. Excludes `list-collections` by design.

import { registerComponents } from '../js/alpine/register.js'

document.addEventListener('alpine:init', () => {
  registerComponents(window.Alpine,
    import.meta.glob('../js/alpine/components/collection/*.js', { eager: true, import: 'default' })
  )
})
