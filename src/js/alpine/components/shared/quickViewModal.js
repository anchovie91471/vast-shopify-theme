/**
 * Quick View Modal Component
 *
 * Modal for viewing product details without leaving the collection page.
 * Includes prefetching optimization for first 3 products in grid.
 *
 * Usage in Liquid:
 * <div x-data="quickViewModal"
 *      data-show-description="{{ section.settings.quick_view_show_description | default: true }}"
 *      data-money-format="{{ shop.money_format | json }}">
 */

// Static cache shared across all quickViewModal instances
// This enables prefetching without duplicating requests
const productCache = new Map()
const prefetchPromises = new Map()

export default function quickViewModal() {
  return {
    isOpen: false,
    loading: false,
    isAdding: false,
    product: null,
    currentVariant: null,
    selectedOptions: {},
    quantity: 1,
    settings: {},
    moneyFormat: '${{amount}}',

    init() {
      // Read settings from data attributes
      const el = this.$el
      this.settings = {
        quick_view_show_description: el.dataset.showDescription === 'true'
      }
      this.moneyFormat = el.dataset.moneyFormat || '${{amount}}'

      // Listen for open-quick-view events on window (since modal is outside product grid DOM tree)
      window.addEventListener('open-quick-view', (event) => {
        this.open(event.detail.productHandle)
      })

      // Listen for prefetch requests from product grid items
      window.addEventListener('prefetch-product', (event) => {
        this.prefetchProduct(event.detail.productHandle)
      })
    },

    /**
     * Prefetch product data for instant Quick View
     * Called when user hovers over Quick View button on first 3 products
     */
    async prefetchProduct(productHandle) {
      // Skip if already cached or currently prefetching
      if (productCache.has(productHandle) || prefetchPromises.has(productHandle)) {
        return
      }

      // Create prefetch promise and cache it to prevent duplicate requests
      const prefetchPromise = fetch(`/products/${productHandle}.js`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to prefetch product: ${response.status}`)
          }
          return response.json()
        })
        .then(productData => {
          // Cache the product data
          productCache.set(productHandle, productData)
          // Clean up prefetch promise tracking
          prefetchPromises.delete(productHandle)
          return productData
        })
        .catch(error => {
          // Silently fail prefetch - product will load normally on click
          console.debug('Prefetch failed for', productHandle, error)
          prefetchPromises.delete(productHandle)
        })

      prefetchPromises.set(productHandle, prefetchPromise)
    },

    async open(productHandle) {
      this.loading = true
      this.isOpen = true
      document.body.style.overflow = 'hidden'

      try {
        let productData

        // Check if product is already cached (from prefetch or previous open)
        if (productCache.has(productHandle)) {
          productData = productCache.get(productHandle)
        } else if (prefetchPromises.has(productHandle)) {
          // Prefetch is in progress, wait for it
          productData = await prefetchPromises.get(productHandle)
        } else {
          // No cache, fetch normally
          const response = await fetch(`/products/${productHandle}.js`)
          if (!response.ok) throw new Error('Failed to fetch product')

          productData = await response.json()
          // Cache for future use
          productCache.set(productHandle, productData)
        }

        this.product = productData
        this.currentVariant = this.product.variants[0]
        this.initializeSelectedOptions()

        await this.$nextTick()
        this.updateModalContent()
      } catch (error) {
        console.error('Error loading product:', error)
        this.close()
      } finally {
        this.loading = false
      }
    },

    close() {
      this.isOpen = false
      this.product = null
      this.currentVariant = null
      this.selectedOptions = {}
      this.quantity = 1
      document.body.style.overflow = ''
    },

    initializeSelectedOptions() {
      if (!this.product || !this.currentVariant) return
      this.product.options.forEach((option, index) => {
        this.selectedOptions[option.name] = this.currentVariant.options[index]
      })
    },

    updateModalContent() {
      // Update product image
      const imgElement = this.$refs.productImage
      if (imgElement && this.currentVariant.featured_image) {
        imgElement.src = this.getImageUrl(this.currentVariant.featured_image.src, 800)
      } else if (imgElement && this.product.featured_image) {
        imgElement.src = this.getImageUrl(this.product.featured_image, 800)
      }
    },

    handleOptionChange(optionName, value) {
      this.selectedOptions[optionName] = value
      this.updateVariant()
    },

    updateVariant() {
      const selectedVariant = this.product.variants.find(variant => {
        return variant.options.every((option, index) => {
          const optionName = this.product.options[index].name
          return option === this.selectedOptions[optionName]
        })
      })

      if (selectedVariant) {
        this.currentVariant = selectedVariant
        this.updateModalContent()
      }
    },

    async addToCart() {
      if (!this.currentVariant.available || this.isAdding) return

      this.isAdding = true

      try {
        const body = {
          items: [{
            id: this.currentVariant.id,
            quantity: this.quantity
          }]
        }

        // Use Liquid Ajax Cart API to properly update cart state and sections
        window.liquidAjaxCart.add(body, {
          lastCallback: (requestState) => {
            // Reset loading state
            this.isAdding = false

            // Check if request was successful
            if (requestState.responseData?.ok) {
              // Close modal
              this.close()

              // Show minicart
              if (window.Alpine && window.Alpine.store('global')) {
                window.Alpine.store('global').isMinicartVisible = true
              }
            }
          }
        })
      } catch (error) {
        console.error('Error adding to cart:', error)
        this.isAdding = false
        alert('Failed to add product to cart')
      }
    },

    getImageUrl(src, width = 800) {
      if (!src) return ''
      const baseUrl = src.split('?')[0]
      return `${baseUrl}?width=${width}`
    },

    formatMoney(cents) {
      if (window.vast && window.vast.helpers && window.vast.helpers.formatMoney) {
        return window.vast.helpers.formatMoney(cents, this.moneyFormat)
      }
      return `$${(cents / 100).toFixed(2)}`
    }
  }
}
