import Swiper from "swiper";
import {
  Autoplay,
  Grid,
  Mousewheel,
  Navigation,
  Pagination,
  EffectFade,
  // breakpoints,
} from "swiper/modules";

/**
 * @param swiperInit
 */
export function swiperInit() {

  new Swiper(".pagination-swiper", {
    slidesPerView: 1,
    spaceBetween: 0,
    speed: 1000,
    loop: true,
    effect: "fade",
    // autoplay: {
    //   delay: 3500,
    // },
    modules: [Pagination, Navigation, Autoplay, EffectFade],
    pagination: {
      el: ".section-home-1 .swiper-pagination",
      clickable: true,
      renderBullet: function (index, className) {
        const item_p = [
          "Đối tác tin cậy của nhiều dự án tầm cỡ",
          "Cung cấp dịch vụ toàn diện & hiệu quả",
          "Về chúng tôi",
          "Phát triển bền vững",
        ];
        return (
          '<p class=" col-span-1 text-white !bg-transparent border-white cursor-pointer w-full '+ className +' ">' + item_p[index % item_p.length] +"</p>"
        );
      },
    },
  });
  
  new Swiper('.vertical-swiper', {
    direction: 'vertical',
    slidesPerView: 1,
    mousewheel: true,
    modules: [Pagination, Navigation, Autoplay, EffectFade, Mousewheel],
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });

new Swiper(".scrollswiper-1", {
    slidesPerView: 1,
    spaceBetween: 24,
    // autoplay: {
    //   delay: 3000,
    //   disableOnInteraction: false,
    // },
    navigation: {
      nextEl: ".btn-next",
      prevEl: ".btn-prev",
    },
    pagination: {
      el: ".scrollswiper-1 .swiper-pagination",
      clickable: true,
    },
    breakpoints: {
      768: {
        slidesPerView: 2,
        spaceBetween: 24,
      },
      1024: {
        slidesPerView: 3,
        spaceBetween: 24,
      },
      1200:{
        slidesPerView: 4,
        spaceBetween: 24,
      }
    },
    modules: [Navigation, Pagination, Autoplay],
  });

  
}
