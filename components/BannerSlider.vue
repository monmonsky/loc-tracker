<template>
    <Swiper
      :modules="[Autoplay, Pagination]"
      :slides-per-view="1"
      :loop="true"
      :autoplay="{ delay: 3000 }"
      :pagination="{ clickable: true }"
      class="my-swiper"
    >
      <SwiperSlide v-for="(image, index) in images" :key="index">
        <a :href="link" target="_blank" rel="noopener">
          <img :src="image" alt="" class="w-full object-cover rounded" />
        </a>
      </SwiperSlide>
    </Swiper>
  </template>
  
  <script setup>
  import { Swiper, SwiperSlide } from 'swiper/vue';
  import { Autoplay, Pagination } from 'swiper/modules'; // ✅ INI YANG BENAR UNTUK V9+
  import 'swiper/css';
  import 'swiper/css/pagination';
  
  const link = 'https://shopee.co.id/product/63984475/26205500767?...';
  
  const images = [
    'https://www.makeoverforall.com/_next/image?url=https%3A%2F%2Fmakeover-ecommerce-bucket.s3.ap-southeast-1.amazonaws.com%2Fimages%2Fdesktop%2F1a6cf2de7a87d924bbebbb241e715eff844b722b.jpg&w=640&q=75',
    'https://www.makeoverforall.com/_next/image?url=https%3A%2F%2Fmakeover-ecommerce-bucket.s3.ap-southeast-1.amazonaws.com%2Fimages%2Fdesktop%2F5b7bffd47d5d522b75604ecc878f5cb3fdb43662.jpg&w=640&q=75',
    'https://www.makeoverforall.com/_next/image?url=https%3A%2F%2Fmakeover-ecommerce-bucket.s3.ap-southeast-1.amazonaws.com%2Fimages%2Fdesktop%2F92a398570d22ccd4cd03de1475678063a90e200e.jpg&w=640&q=75'
  ];
  </script>
  
  <style scoped>
  .my-swiper {
    width: 100%;
    height: auto;
  }
  </style>
  