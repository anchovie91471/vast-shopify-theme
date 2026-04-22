// src/entrypoints/product.js
//
// Product-scoped Alpine components. Loaded on templates where
// `template contains 'product'`. Registers components from
// src/js/alpine/components/product/ into the Alpine instance
// that theme.js has already set up as window.Alpine.

import { registerComponents } from '../js/alpine/register.js'

document.addEventListener('alpine:init', () => {
  registerComponents(window.Alpine,
    import.meta.glob('../js/alpine/components/product/*.js', { eager: true, import: 'default' })
  )
})
