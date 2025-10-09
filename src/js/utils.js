export function appendFineAnt() {
	const script = document.createElement("script");
	script.src = "https://www.fireant.vn/Scripts/web/widgets.js";
	script.defer = true;
	script.onload = () => {
		new FireAnt.QuoteWidget({
			container_id: "fan-quote-373",
			symbols: "IJC",
			locale: "vi",
			price_line_color: "#71BDDF",
			grid_color: "#999999",
			label_color: "#999999",
			width: "100%",
			height: "200px",
		});
	};
	document.querySelector(".iframe-fineant").appendChild(script);
	console.log('🟢 Fineant is added!')
}
export function showResolutionWeb() {
	const width = $(window).width()
	const height = $(window).height()
	$('main').append(
		`<style>.show-resolution-web{position: fixed; right: 0; bottom: 0; background-color: #f73936; color: white; z-index: 100; padding: 1rem;}</style><div class="show-resolution-web"><p>Width: ${width}px</p> <p>Height: ${height}px</p></div>`
	)
}