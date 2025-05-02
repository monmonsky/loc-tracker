// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/icon'],
  app: {
    head: {
      title: 'MAKEOVER X NIKI'
    }
  }
})
