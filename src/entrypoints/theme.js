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

for (const [key, value] of Object.entries(helpers)) {
    window[ns].helpers[key] = value
}

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
    import.meta.glob('../js/alpine/components/**/*.js', { eager: true, import: 'default' })
  )
})

// Wait for DOM to be interactive before starting Alpine
// This allows critical HTML parsing to complete before Alpine processes x-data bindings
// Improves Interaction to Next Paint (INP) and Time to Interactive (TTI)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Alpine.start())
} else {
  Alpine.start()
}
