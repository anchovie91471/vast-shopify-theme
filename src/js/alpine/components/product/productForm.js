/**
 * Product Form Component
 *
 * Manages product quantity selector, add-to-cart functionality, and buy now button.
 * Integrates with liquid-ajax-cart for AJAX cart operations.
 *
 * Usage in Liquid:
 * <div x-data="productForm">
 */

export default function productForm() {
  return {
    quantity: 1,
    isProcessing: false,
    errorMessage: '',
    variantId: null,
    isAvailable: true,
    sectionId: null,

    init() {
      const productData = Alpine.store('productData')
      const currentVariant = productData.currentVariant
      this.sectionId = productData.sectionId
      this.variantId = currentVariant.id
      this.isAvailable = currentVariant.available

      // Listen for variant:change events
      document.addEventListener('variant:change', (event) => {
        if (event.detail.sectionId === this.sectionId) {
          this.handleVariantChange(event.detail.variant)
        }
      })

      // Listen for liquid-ajax-cart events, but only for requests started by this form.
      // Other requests (e.g. the cart refresh on window focus) must not toggle the button.
      document.addEventListener('liquid-ajax-cart:request-start', (event) => {
        if (this.isOwnRequest(event)) this.isProcessing = true
      })

      document.addEventListener('liquid-ajax-cart:request-end', (event) => {
        if (this.isOwnRequest(event)) this.isProcessing = false
      })
    },

    isOwnRequest(event) {
      const initiator = event.detail?.requestState?.info?.initiator
      return initiator instanceof Element && this.$el.contains(initiator)
    },

    handleVariantChange(variant) {
      if (!variant) return

      this.variantId = variant.id
      this.isAvailable = variant.available
      this.errorMessage = ''

      // Update the add-to-cart button text/state
      this.$nextTick(() => {
        const addButton = this.$el.querySelector('button[type="submit"]')
        if (addButton) {
          addButton.disabled = !this.isAvailable
        }
      })
    },

    incrementQuantity() {
      this.quantity++
    },

    decrementQuantity() {
      if (this.quantity > 1) {
        this.quantity--
      }
    },

    buyNow() {
      if (!this.isAvailable) return
      window.location.href = `/cart/${this.variantId}:${this.quantity}`
    }
  }
}
