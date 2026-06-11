class Utils {
	/**
	 * @param {string} id
	 * @returns {HTMLElement}
	 */
	static requireElement(id) {
		var e = document.getElementById(id)
		if (e == null) throw new Error("Missing element with id " + id)
		return e
	}
	/**
	 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
	 *
	 * @param {String} text The text to be rendered.
	 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
	 *
	 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
	 */
	static getTextSize(text, font) {
		// re-use canvas object for better performance
		/** @type {HTMLCanvasElement} */
		// @ts-ignore
		const canvas = Utils.getTextSize.canvas || (Utils.getTextSize.canvas = document.createElement("canvas"));
		const context = canvas.getContext("2d");
		if (context == null) throw new Error("can't measure text because context is null");
		context.font = font;
		const metrics = context.measureText(text);
		return { x: metrics.width, y: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent, baseline: metrics.fontBoundingBoxAscent };
	}
	/**
	 * @param {string} text
	 * @param {number} fontSize
	 * @param {string} color
	 */
	static renderText(text, fontSize, color) {
		var font = fontSize + "px sans-serif";
		var size = Utils.getTextSize(text, font);
		var image = new OffscreenCanvas(size.x, size.y);
		var ctx = image.getContext('2d');
		if (ctx == null) throw new Error("can't render text because context is null");
		ctx.font = font;
		ctx.fillStyle = color;
		ctx.fillText(text, 0, size.baseline);
		return image;
	}
}

/**
 * @template {any[]} T
 * @template V
 */
class CacheMap {
	/** @param {(...params: T) => V} func */
	constructor(func, size = 10) {
		/** @type {(...params: T) => V} */
		this.func = func
		/** @type {number} */
		this.size = size
		/** @type {Map<string, V>} */
		this.items = new Map()
	}
	clear() {
		this.items.clear()
	}
	/**
	 * @param {string} param
	 * @param {V} result
	 */
	addCachedValue(param, result) {
		this.items.set(param, result)
		if (this.items.size > this.size) {
			this.items.delete(this.items.keys().next().value ?? "")
		}
	}
	/**
	 * @param {T} params
	 * @returns {V}
	 */
	get(...params) {
		var cachedValue = this.items.get(JSON.stringify(params))
		if (cachedValue != undefined) return cachedValue
		var value = this.func(...params)
		this.addCachedValue(JSON.stringify(params), value)
		return value;
	}
}

class ObjectProperty {
	constructor() {}
}
class NumericProperty extends ObjectProperty {
	/** @param {number} value */
	constructor(value) {
		super()
		/** @type {number} */
		this.value = value
	}
}
class StringProperty extends ObjectProperty {
	/** @param {string} value */
	constructor(value) {
		super()
		/** @type {string} */
		this.value = value
	}
}

class VObject {
	constructor() {
		/** @type {Map<string, ObjectProperty>} */
		this.properties = new Map()
	}
	/**
	 * @param {number} currentTime
	 * @param {number} width
	 * @param {number} height
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(currentTime, width, height, canvas) {
		throw new Error("Cannot render a base object")
	}
}
class VText extends VObject {
	constructor() {
		super()
		// pos/size
		this.centerX = new NumericProperty(0.5)
		this.properties.set("centerX", this.centerX)
		this.centerY = new NumericProperty(0.5)
		this.properties.set("centerY", this.centerY)
		this.width = new NumericProperty(0.3)
		this.properties.set("width", this.width)
		// text
		this.text = new StringProperty("Text goes here asdf asdf asdf asdf asdf")
		this.properties.set("text", this.text)
		// render
		/** @type {CacheMap<[number, string], OffscreenCanvas>} */
		this.renders = new CacheMap(VText.createRender, 10)
	}
	/**
	 * @param {number} width
	 * @param {string} text
	 * @returns {OffscreenCanvas}
	 */
	static createRender(width, text) {
		var words = text.split(/(?= )/i)
		// Render lines
		var completedLines = []
		var currentLine = ""
		for (var word of words) {
			// Find size
			var lineWithWord = currentLine + word
			var size = Utils.getTextSize(lineWithWord, "14px sans-serif")
			if (size.x > width) {
				// Next line
				completedLines.push(currentLine)
				currentLine = word.trimStart()
			} else {
				// Add word
				currentLine += word
			}
		}
		if (currentLine.length > 0) completedLines.push(currentLine)
		// Render
		var size = Utils.getTextSize("A g", "14px sans-serif")
		var image = new OffscreenCanvas(width, completedLines.length * size.y)
		var ctx = image.getContext('2d');
		if (ctx == null) throw new Error("can't render text because context is null");
		ctx.font = "14px sans-serif"; // TEST
		ctx.fillStyle = "white";
		completedLines.forEach(((ctx) => (line, i) => ctx.fillText(line, 0, (i * size.y) + size.baseline))(ctx))
		return image
	}
	/**
	 * @param {number} currentTime
	 * @param {number} width
	 * @param {number} height
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(currentTime, width, height, canvas) {
		var render = this.renders.get(this.width.value * width, this.text.value) // TEST
		var posX = (this.centerX.value * width) - (render.width / 2)
		var posY = (this.centerY.value * height) - (render.height / 2)
		canvas.drawImage(render, Math.round(posX + currentTime), Math.round(posY + currentTime)) // TEST
	}
}

class VideoEditorApp {
	constructor() {
		// elements
		this.element_timeline = Utils.requireElement("timeline")
		var pc = Utils.requireElement("preview-container")
		this.element_preview = pc.appendChild(document.createElement("canvas"))
		var ctx = this.element_preview.getContext('2d')
		if (ctx == null) throw new Error("missing canvas context")
		this.preview_ctx = ctx
		// video data
		this.video_aspect_ratio = 16 / 9;
		this.currentTime = 0;
		/** @type {VObject[]} */
		this.objects = [];
		this.objects.push(new VText()); // TEST
		// initialize dom
		this.updateTimelineTicks();
		this.element_preview.height = Math.round(Math.min(
			window.innerHeight / 2,
			(window.innerWidth * 2/3) / this.video_aspect_ratio
		))
		this.element_preview.width = Math.round(this.video_aspect_ratio * this.element_preview.height)
	}
	updateTimelineTicks() {
		var old_ticks = [...this.element_timeline.querySelectorAll(".background-ticks")]
		// generate new ticks
		for (var t = 0; t < 30; t++) { // TEST
			var pos = t * 50; // TEST
			// make number
			var n = document.createElement("div")
			n.setAttribute("style", `--y: ${pos}px;`)
			n.classList.add("timeline-tick", "background-ticks")
			this.element_timeline.appendChild(n)
			n.innerText = t.toString();
			// make bar
			var bar = document.createElement("div")
			bar.setAttribute("style", `--y: ${pos}px;`)
			bar.classList.add("timeline-bar", "background-ticks")
			this.element_timeline.appendChild(bar)
		}
		// remove old ticks
		old_ticks.forEach((v) => v.remove())
	}
	updateCanvas() {
		this.preview_ctx.clearRect(0, 0, this.element_preview.width, this.element_preview.height)
		// draw objects
		for (var o of this.objects) {
			o.render(this.currentTime, this.element_preview.width, this.element_preview.height, this.preview_ctx)
		}
	}
	onFrame() {
		// update scroll position
		var timeline_pos = this.element_timeline.scrollTop;
		this.currentTime = timeline_pos / 50; // TEST
		// update timeline number
		var n = this.element_timeline.querySelector(".timeline-tick.current-pos") ?? (() => {
			var e = document.createElement("div");
			this.element_timeline.appendChild(e);
			e.classList.add("timeline-tick", "current-pos");
			return e;
		})();
		n.setAttribute("style", `--y: ${timeline_pos}px;`)
		var timelineNumberText = String(Math.round(this.currentTime * 100) / 100);
		if (n.textContent != timelineNumberText) n.textContent = timelineNumberText
		// update timeline bar
		var n = this.element_timeline.querySelector(".timeline-bar.current-pos") ?? (() => {
			var e = document.createElement("div");
			this.element_timeline.appendChild(e);
			e.classList.add("timeline-bar", "current-pos");
			return e;
		})();
		n.setAttribute("style", `--y: ${timeline_pos}px;`)
		// redraw canvas
		this.updateCanvas()
	}
	async frameLoop() {
		while (true) {
			this.onFrame()
			await new Promise((resolve) => requestAnimationFrame(resolve))
		}
	}
}

var app = new VideoEditorApp()
app.frameLoop()
