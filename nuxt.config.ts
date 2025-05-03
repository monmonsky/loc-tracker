// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/icon'],
  app: {
    head: {
      title: 'Make Over App',
      link: [
        { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }
      ],
      script: [
        { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    }
  },
})
