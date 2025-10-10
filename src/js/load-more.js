export class LoadMoreElement {
	constructor(options) {
		const defaults = {
			parentSelector: "",
			itemSelector: "",
			buttonSelector: "",
			visibleCount: 10,
			loadStep: 5,
		};

		this.settings = { ...defaults, ...options };
		this.$parent = $(this.settings.parentSelector);
		this.$items = this.$parent.find(this.settings.itemSelector);
		this.$button = $(this.settings.buttonSelector);
		this.visibleCount = this.settings.visibleCount;

		this.init();
	}

	init() {
		this.$items.slice(this.visibleCount).hide();
		this.bindEvents();
	}

	bindEvents() {
		this.$button.on("click", (e) => {
			e.preventDefault();
			this.loadMore();
		});
	}

	loadMore() {
		const nextVisible = this.visibleCount + this.settings.loadStep;
		this.$items.slice(this.visibleCount, nextVisible).show();
		this.visibleCount = nextVisible;

		if (this.visibleCount >= this.$items.length) {
			this.$button.hide();
		}
	}
}
