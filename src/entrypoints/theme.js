import "liquid-ajax-cart";

import Alpine from 'alpinejs'
import AlpineCollapse from '@alpinejs/collapse'
import AlpineFocus from '@alpinejs/focus'
import AlpineMorph from '@alpinejs/morph'
import { registerStores, registerComponents } from '../js/alpine/register.js'
import helpers from '../js/helpers.js'

const ns = 'vast'

window.vastNamespace = ns
window[ns] = (window[ns] || {})
window[ns].helpers = helpers

// Register and initialize AlpineJS
window.Alpine = Alpine

Alpine.plugin(
    [
        AlpineCollapse,
        AlpineFocus,
        AlpineMorph
    ]
)

// Register Alpine stores and components
document.addEventListener('alpine:init', () => {
  registerStores(Alpine,
    import.meta.glob('../js/alpine/stores/*.js', { eager: true, import: 'default' })
  )
  registerComponents(Alpine,
    import.meta.glob('../js/alpine/components/shared/*.js', { eager: true, import: 'default' })
  )
})

// Always defer Alpine.start() to DOMContentLoaded so page-scoped
// entrypoints (product.js, collection.js, blog.js) have time to
// attach their alpine:init listeners. Module scripts all execute
// before DCL per the HTML spec, so this is safe and near-zero-latency.
document.addEventListener('DOMContentLoaded', () => Alpine.start())
