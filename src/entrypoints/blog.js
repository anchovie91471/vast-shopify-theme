// src/entrypoints/blog.js
//
// Blog/article-scoped Alpine components. Loaded on templates where
// `template contains 'blog'` or `template contains 'article'`.

import { registerComponents } from '../js/alpine/register.js'

document.addEventListener('alpine:init', () => {
  registerComponents(window.Alpine,
    import.meta.glob('../js/alpine/components/blog/*.js', { eager: true, import: 'default' })
  )
})
