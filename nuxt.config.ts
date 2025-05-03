// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/icon'],
  app: {
    head: {
      title: 'Make Over App',
      script: [
        {
          src: 'https://maps.googleapis.com/maps/api/js?key=AIzaSyA-C_c9zgKCDwrvOKnRmW3jjFppjJUhmRU',
          async: true,
          defer: true
        }
      ]
    }
  },
  
})
