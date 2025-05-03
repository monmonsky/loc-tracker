// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/icon'],
  app: {
    head: {
      title: 'Make Over App',
      
    }
  },
  runtimeConfig: {
    public: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    }
  },
  hooks: {
    'app:resolve': (app) => {
      const config = useRuntimeConfig()
      app.head.script = app.head.script || []
      app.head.script.push({
        src: `https://maps.googleapis.com/maps/api/js?key=${config.public.googleMapsApiKey}`,
        async: true,
        defer: true
      })
    }
  }
  
})
