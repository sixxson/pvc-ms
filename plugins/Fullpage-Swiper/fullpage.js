import Swiper, {
	EffectCreative,
	Keyboard,
	Mousewheel,
	Navigation,
	Pagination,
	Thumbs,
} from "swiper";
import { appendFineAnt } from "./utils";
var timerShowPagination;
export const Fullpage = {
	generateThumbs: function () {
		const countSlide = jQuery(
			".fullpage-swiper > .swiper > .swiper-wrapper > .swiper-slide"
		).length;
		jQuery(
			".fullpage-swiper > .swiper > .swiper-wrapper > .swiper-slide"
		).each(function (index) {
			let title = $(this).data("title");
			jQuery(".fullpage-slide-thumb .swiper-wrapper").append(
				`<div class="swiper-slide"><div class="item-thumb"><p>${
					title || ""
				}</p><span>0${index + 1}</span></div></div>`
			);
		});
	},
	swiper: function () {
		var fullpage_thumb = new Swiper(".fullpage-slide-thumb .swiper", {
			direction: "vertical",
			speed: 800,
			allowTouchMove: false,
			observer: true,
			observeParents: true,
		});
		var fullpage_main = new Swiper(
			".fullpage-swiper .swiper-full-current",
			{
				spaceBetween: 0,
				direction: "vertical",
				speed: 1000,
				observer: true,
				observeParents: true,
				modules: [
					Pagination,
					EffectCreative,
					Keyboard,
					Mousewheel,
					Navigation,
					Thumbs,
				],
				mousewheel: {
					forceToAxis: true,
					thresholdTime: 1200,
				},
				thumbs: {
					swiper: fullpage_thumb,
				},
				keyboard: {
					enabled: true,
				},
				freeMode: false,
				slidesPerView: 1,
				allowTouchMove: false,
				effect: "creative",
				creativeEffect: {
					prev: {
						shadow: true,
						translate: [0, "-100%", -1],
					},
					next: {
						translate: [0, "100%", 0],
					},
				},
				on: {
					init: async () => {
						const sleep = t => new Promise(r => setTimeout(r, t));
						await sleep(1000);
						jQuery("header").addClass("header-black");
						$(".fullpage-slide-thumb").addClass("active");
					},
					slideChange: async () => {
						var index = fullpage_main.activeIndex + 1;
						window.clearTimeout(timerShowPagination);
						$('.fullpage-slide-thumb').removeClass('hidden-navigation');
						$('.tools-fixed').removeClass('hidden-tools');
						timerShowPagination = window.setTimeout(() => {
							$('.fullpage-slide-thumb').addClass('hidden-navigation');
							$('.tools-fixed').addClass('hidden-tools');
						},2500)
						const sleep = t => new Promise(r => setTimeout(r, t));
						await sleep(1000);
						if (index == 2) {
							const options = {
								duration: 5,
							};
							var nodeCount = $(".count-up");
							nodeCount.each(function (index) {
								var value = $(nodeCount[index]).data("number");
								var nodeAnimation = new countUp.CountUp(
									nodeCount[index],
									value,
									options
								);
								nodeAnimation.start();
							});
							appendFineAnt()
						}
						if (index == 6) {
							jQuery("header").addClass("header-buff-white");
						} else {
							jQuery("header").removeClass("header-buff-white");
						}
						if (index == 7 || index == 1) {
							jQuery("header").addClass("header-black");
							jQuery("header").removeClass(
								"header-scroll-fullpage"
							);
							$(".fullpage-slide-thumb").addClass('active');
						} else {
							jQuery("header").removeClass("header-black");
							$(".fullpage-slide-thumb").removeClass("active");
						}
						if (index > 1 && index != 7) {
							jQuery("header").addClass("header-scroll-fullpage");
						} else {
							jQuery("header").removeClass(
								"header-scroll-fullpage"
							);
						}
					},
				},
			}
		);
		$(".button-to-top").on("click", function () {
			fullpage_main.slideTo(0);
		});
	},
	detectDragMouseNearPagination: function () {
		$('.fullpage-slide-thumb').on('mouseenter', function () {
			window.clearTimeout(timerShowPagination)
			$(this).removeClass('hidden-navigation');
			timerShowPagination = setTimeout(() => {
				$(this).addClass('hidden-navigation');
			}, 2500)
		})
	},
	init: function () {
		if ($(window).width() < 1260) return;
		Fullpage.generateThumbs();
		Fullpage.swiper();
		Fullpage.detectDragMouseNearPagination();
	},
};
