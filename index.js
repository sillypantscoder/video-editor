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
	 * @param {Map<string, ObjectProperty>} map
	 * @returns {Map<string, ObjectProperty>}
	 */
	static copyPropertyMap(map) {
		/** @type {Map<string, ObjectProperty>} */
		var newMap = new Map();
		for (var [key, value] of map) {
			newMap.set(key, value.copy())
		}
		return newMap;
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
	/** @returns {ObjectProperty} */
	copy() {
		throw new Error("Cannot copy a base property")
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		throw new Error("Cannot set a base property's value")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {ObjectProperty}
	 */
	interpolate(time, endpoint) {
		throw new Error("Cannot interpolate a base property's value")
	}
}
class NumericProperty extends ObjectProperty {
	/** @param {number} value */
	constructor(value) {
		super()
		/** @type {number} */
		this.value = value
	}
	/** @returns {NumericProperty} */
	copy() {
		return new NumericProperty(this.value)
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof NumericProperty) {
			this.value = property.value
		} else throw new Error("Cannot set NumericProperty to a differently-typed property")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {NumericProperty}
	 */
	interpolate(time, endpoint) {
		if (endpoint instanceof NumericProperty) {
			var value = ((1-time) * this.value) + (time * endpoint.value)
			return new NumericProperty(value)
		} else throw new Error("Cannot interpolate NumericProperty with a differently-typed property")
	}
}
class StringProperty extends ObjectProperty {
	/** @param {string} value */
	constructor(value) {
		super()
		/** @type {string} */
		this.value = value
	}
	/** @returns {StringProperty} */
	copy() {
		return new StringProperty(this.value)
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof StringProperty) {
			this.value = property.value
		} else throw new Error("Cannot set NumericProperty to a differently-typed property")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {StringProperty}
	 */
	interpolate(time, endpoint) {
		if (endpoint instanceof StringProperty) {
			var value = this.value
			return new StringProperty(value)
		} else throw new Error("Cannot interpolate StringProperty with a differently-typed property")
	}
}

class VObject {
	/**
	 * @param {number} startTime
	 * @param {Map<string, ObjectProperty>} initialProperties
	 * @param {number} length
	 */
	constructor(startTime, initialProperties, length) {
		/** @type {Map<string, ObjectProperty>} */
		this.properties = initialProperties
		/** @type {{ startTime: number, initialProperties: Map<string, ObjectProperty>, keyframes: { time: number, properties: Map<string, ObjectProperty> }[] }} */
		this.config = {
			startTime,
			initialProperties: Utils.copyPropertyMap(initialProperties),
			keyframes: [
				{ time: startTime + length, properties: Utils.copyPropertyMap(initialProperties) }
			]
		}
	}
	/**
	 * @param {number} time
	 * @returns {boolean}
	 */
	isVisibleAtTime(time) {
		if (time < this.config.startTime) return false;
		var maxTime = this.config.keyframes[this.config.keyframes.length - 1].time
		return time <= maxTime;
	}
	/**
	 * @param {number} time
	 * @returns {Map<string, ObjectProperty> | null}
	 */
	getPropertiesAtTime(time) {
		if (time < this.config.startTime) return null;
		if (time == this.config.startTime) return Utils.copyPropertyMap(this.config.initialProperties);
		for (var i = 0; i < this.config.keyframes.length; i++) {
			if (time < this.config.keyframes[i].time) {
				// Get interpolation parameters
				var previousTime = (this.config.keyframes[i-1] ?? { time: this.config.startTime }).time
				var timeDifference = this.config.keyframes[i].time - previousTime
				var fraction = (time - previousTime) / timeDifference
				// Interpolate!
				var previousData = [this.config.initialProperties, ...this.config.keyframes.map((v) => v.properties)][i]
				var nextData = this.config.keyframes[i].properties
				/** @type {Map<string, ObjectProperty>} */
				var interpolatedData = new Map();
				for (var key of previousData.keys()) {
					var previousValue = previousData.get(key);
					if (previousValue == undefined) throw new Error("Missing property in keyframes")
					var nextValue = nextData.get(key);
					if (nextValue == undefined) throw new Error("Missing property in keyframes")
					interpolatedData.set(key, previousValue.interpolate(fraction, nextValue));
				}
				return interpolatedData;
			}
			if (time == this.config.keyframes[i].time) return Utils.copyPropertyMap(this.config.keyframes[i].properties);
		}
		return null;
	}
	/** @param {number} time */
	setCurrentPropertiesToCalculatedPropertiesAtTime(time) {
		var properties = this.getPropertiesAtTime(time)
		if (properties == null) return;
		for (var key of properties.keys()) {
			this.properties.get(key)?.setFrom(properties.get(key) ?? new ObjectProperty())
		}
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
	/**
	 * @param {number} startTime
	 */
	constructor(startTime) {
		// - pos/size
		var centerX = new NumericProperty(0.5)
		var centerY = new NumericProperty(0.5)
		var width = new NumericProperty(0.15)
		// - text
		var text = new StringProperty("Text goes here asdf asdf asdf asdf asdf")
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["centerX", centerX],
			["centerY", centerY],
			["width", width],
			["text", text]
		]
		super(startTime, new Map(properties), 5)
		// properties
		this.centerX = centerX
		this.centerY = centerY
		this.width = width
		this.text = text
		// rendering cache
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
		this.setCurrentPropertiesToCalculatedPropertiesAtTime(currentTime)
		var render = this.renders.get(this.width.value * width, this.text.value)
		var posX = (this.centerX.value * width) - (render.width / 2)
		var posY = (this.centerY.value * height) - (render.height / 2)
		canvas.drawImage(render, Math.round(posX), Math.round(posY))
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
		this.objects.push(new VText(1)); // TEST
		this.objects[0].config.keyframes[0].properties.get("centerX")?.setFrom(new NumericProperty(0.9)) // TEST
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
			if (o.isVisibleAtTime(this.currentTime)) {
				o.render(this.currentTime, this.element_preview.width, this.element_preview.height, this.preview_ctx)
			}
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
