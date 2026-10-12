// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  typescript: {
    typeCheck: true,
  },
  nitro: {
    vercel: {
      // The chat agent reads a message (and its photos) with an AI model after the webhook returns.
      functions: { maxDuration: 60 },
    },
  },
})
