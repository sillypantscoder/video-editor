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
	 * @param {{ x: number, y: number }} point
	 * @param {{ x: number, y: number, width: number, height: number }} rect
	 */
	static pointInsideRect(point, rect) {
		return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
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
class ColorProperty extends ObjectProperty {
	/**
	 * @param {number} r
	 * @param {number} g
	 * @param {number} b
	 * @param {number} a
	 */
	constructor(r, g, b, a) {
		super()
		/** @type {number} */
		this.r = r
		/** @type {number} */
		this.g = g
		/** @type {number} */
		this.b = b
		/** @type {number} */
		this.a = a
	}
	/** @returns {{ r: number, g: number, b: number, a: number }} */
	asobj() {
		return { r: this.r, g: this.g, b: this.b, a: this.a }
	}
	/** @returns {ColorProperty} */
	copy() {
		return new ColorProperty(this.r, this.g, this.b, this.a)
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof ColorProperty) {
			this.r = property.r
			this.g = property.g
			this.b = property.b
			this.a = property.a
		} else throw new Error("Cannot set ColorProperty to a differently-typed property")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {ColorProperty}
	 */
	interpolate(time, endpoint) {
		if (endpoint instanceof ColorProperty) {
			var r = ((1-time) * this.r) + (time * endpoint.r)
			var g = ((1-time) * this.g) + (time * endpoint.g)
			var b = ((1-time) * this.b) + (time * endpoint.b)
			var a = ((1-time) * this.a) + (time * endpoint.a)
			return new ColorProperty(r, g, b, a)
		} else throw new Error("Cannot interpolate ColorProperty with a differently-typed property")
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
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {OffscreenCanvas}
	 */
	getVisualRepresentation(screenWidth, screenHeight) {
		throw new Error("Cannot render a base object")
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {{ x: number, y: number, width: number, height: number }}
	 */
	getPixelBoundingBox(screenWidth, screenHeight) {
		throw new Error("Cannot find the bounding box of a base object")
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(screenWidth, screenHeight, canvas) {
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
		var color = new ColorProperty(255, 255, 255, 255)
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["centerX", centerX],
			["centerY", centerY],
			["width", width],
			["text", text],
			["color", color]
		]
		super(startTime, new Map(properties), 5)
		// properties
		this.centerX = centerX
		this.centerY = centerY
		this.width = width
		this.text = text
		this.color = color
		// rendering cache
		/** @type {CacheMap<[number, string, { r: number, g: number, b: number, a: number }], OffscreenCanvas>} */
		this.renders = new CacheMap(VText.createRender, 10)
	}
	/**
	 * @param {number} width
	 * @param {string} text
	 * @param {{ r: number, g: number, b: number, a: number }} color
	 * @returns {OffscreenCanvas}
	 */
	static createRender(width, text, color) {
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
		ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255.0})`;
		completedLines.forEach(((ctx) => (line, i) => ctx.fillText(line, 0, (i * size.y) + size.baseline))(ctx))
		return image
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {OffscreenCanvas}
	 */
	getVisualRepresentation(screenWidth, screenHeight) {
		return this.renders.get(this.width.value * screenWidth, this.text.value, this.color.asobj())
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {{ x: number, y: number, width: number, height: number }}
	 */
	getPixelBoundingBox(screenWidth, screenHeight) {
		var render = this.renders.get(this.width.value * screenWidth, this.text.value, this.color.asobj());
		var posX = (this.centerX.value * screenWidth) - (render.width / 2)
		var posY = (this.centerY.value * screenHeight) - (render.height / 2)
		return {
			x: posX,
			y: posY,
			width: render.width,
			height: render.height
		}
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(screenWidth, screenHeight, canvas) {
		var render = this.renders.get(this.width.value * screenWidth, this.text.value, this.color.asobj());
		var posX = (this.centerX.value * screenWidth) - (render.width / 2)
		var posY = (this.centerY.value * screenHeight) - (render.height / 2)
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
		this.element_preview.addEventListener("click", this.canvasClicked.bind(this))
		this.blockScrollEventsFromUpdatingCurrentTime = 0
		// video data
		this.video_aspect_ratio = 16 / 9;
		this.currentTime = 0;
		/** @type {VObject[]} */
		this.objects = [];
		this.objects.push(new VText(1)); // TEST
		this.objects[0].config.keyframes[0].properties.get("centerX")?.setFrom(new NumericProperty(0.9)) // TEST
		this.objects[0].config.keyframes[0].properties.get("color")?.setFrom(new ColorProperty(255, 0, 0, 255)) // TEST
		/** @type {VObject | null} */
		this.selectedObject = null;
		// timeline tracking
		this.timelinePixelsPerSecond = 50;
		/** @type {Map<VObject, HTMLElement>} */
		this.timelineElements = new Map();
		// initialize dom
		this.element_preview.height = Math.round(Math.min(
			window.innerHeight / 2,
			(window.innerWidth * 2/3) / this.video_aspect_ratio
		))
		this.element_preview.width = Math.round(this.video_aspect_ratio * this.element_preview.height)
		this.onScroll();
		this.updateTimelineTicks();
		this.updateAllTimelineElements();
	}
	/** @param {number} amount */
	zoomTimeline(amount) {
		this.timelinePixelsPerSecond *= amount
		this.element_timeline.setAttribute("style", `--height-per-second: ${this.timelinePixelsPerSecond}px;`)
		this.element_timeline.scrollTop *= amount
		this.updateAllTimelineElements()
	}
	getNumberOfTimelineTicks() {
		var maxSeconds = Math.max(...this.objects.flatMap((v) => [v.config.startTime, ...v.config.keyframes.map((w) => w.time)]))
		var maxPixels = (maxSeconds * this.timelinePixelsPerSecond) + (window.innerHeight * 2/3)
		return maxPixels / this.timelinePixelsPerSecond;
	}
	updateTimelineTicks() {
		var old_ticks = [...this.element_timeline.querySelectorAll(".background-ticks")]
		// generate new ticks
		var nTicks = this.getNumberOfTimelineTicks();
		for (var t = 0; t < nTicks; t++) {
			// make number
			var n = document.createElement("div")
			n.setAttribute("style", `--y: ${t};`)
			n.classList.add("timeline-tick", "background-ticks")
			this.element_timeline.insertAdjacentElement("afterbegin", n)
			n.innerText = t.toString();
		}
		// remove old ticks
		old_ticks.forEach((v) => v.remove())
	}
	updateAllTimelineElements() {
		// remove old elements
		for (var k of [...this.timelineElements.keys()]) {
			if (! this.objects.includes(k)) {
				this.timelineElements.get(k)?.remove()
				this.timelineElements.delete(k)
			}
		}
		// update element for each object
		for (let o of this.objects) {
			let e = this.timelineElements.get(o)
			if (e == undefined) {
				e = document.createElement("div");
				e.classList.add("timeline-block");
				this.element_timeline.appendChild(e);
				this.timelineElements.set(o, e);
			}
			var beginTime = o.config.startTime
			var endTime = Math.max(...o.config.keyframes.map((v) => v.time))
			e.setAttribute("style", `--startY: ${beginTime}; --endY: ${endTime}; --x: 0; --color: #0C0;`);
			// Add previews
			[...e.children].forEach((v) => v.remove())
			this.addPreviewToTimelineElement(o, e);
		}
	}
	/**
	 * @param {VObject} object
	 * @param {HTMLElement} timelineElement
	 */
	async addPreviewToTimelineElement(object, timelineElement) {
		var previewHeight = (timelineElement.lastElementChild?.getBoundingClientRect().bottom ?? timelineElement.getBoundingClientRect().top) - timelineElement.getBoundingClientRect().top;
		if (previewHeight > timelineElement.getBoundingClientRect().height) return; // done creating previews for this element!

		var time = object.config.startTime + (previewHeight / this.timelinePixelsPerSecond)
		object.setCurrentPropertiesToCalculatedPropertiesAtTime(time)

		var canvas = object.getVisualRepresentation(this.element_preview.width, this.element_preview.height)

		// convert to blob URL
		var blob = await canvas.convertToBlob({ type: 'image/png' });
		var imageUrl = URL.createObjectURL(blob);
		// draw to image
		var img = new Image();
		img.setAttribute("style", `opacity: 0;`)
		img.src = imageUrl;
		timelineElement.appendChild(img);

		// When the image has loaded:
		img.addEventListener("load", () => {
			// save memory :)
			URL.revokeObjectURL(imageUrl)
			// fade in :)
			requestAnimationFrame(() => { requestAnimationFrame(() => {
				img.setAttribute("style", `opacity: 1; transition: opacity 1s linear;`);
				// Add next preview!
				this.addPreviewToTimelineElement(object, timelineElement)
			}); });
		});
	}
	updateCanvas() {
		this.preview_ctx.clearRect(0, 0, this.element_preview.width, this.element_preview.height)
		// draw selection background
		if (this.selectedObject != null && this.selectedObject.isVisibleAtTime(this.currentTime)) {
			var box = this.selectedObject.getPixelBoundingBox(this.element_preview.width, this.element_preview.height)
			this.preview_ctx.fillStyle = "#08F3"
			this.preview_ctx.fillRect(box.x, box.y, box.width, box.height)
		}
		// draw objects
		for (var o of this.objects) {
			if (o.isVisibleAtTime(this.currentTime)) {
				o.setCurrentPropertiesToCalculatedPropertiesAtTime(this.currentTime)
				o.render(this.element_preview.width, this.element_preview.height, this.preview_ctx)
			}
		}
		// draw selection
		if (this.selectedObject != null && this.selectedObject.isVisibleAtTime(this.currentTime)) {
			var box = this.selectedObject.getPixelBoundingBox(this.element_preview.width, this.element_preview.height)
			this.preview_ctx.strokeStyle = "#08F"
			this.preview_ctx.lineWidth = 3
			this.preview_ctx.strokeRect(box.x, box.y, box.width, box.height)
		}
	}
	onScroll() {
		if (this.blockScrollEventsFromUpdatingCurrentTime > 0) {
			this.blockScrollEventsFromUpdatingCurrentTime -= 1;
		} else {
			// update scroll position
			var timeline_pos = this.element_timeline.scrollTop;
			this.currentTime = timeline_pos / this.timelinePixelsPerSecond;
		}
		// update timeline number
		var n = this.element_timeline.querySelector(".timeline-tick.current-pos") ?? (() => {
			var e = document.createElement("div");
			this.element_timeline.appendChild(e);
			e.classList.add("timeline-tick", "current-pos");
			return e;
		})();
		n.setAttribute("style", `--y: ${this.currentTime};`)
		var timelineNumberText = String(Math.round(this.currentTime * 100) / 100);
		if (n.textContent != timelineNumberText) n.textContent = timelineNumberText
	}
	onFrame() {
		// redraw canvas
		this.updateCanvas()
	}
	async frameLoop() {
		while (true) {
			this.onFrame()
			await new Promise((resolve) => requestAnimationFrame(resolve))
		}
	}
	/** @param {number} targetTime */
	scrollTimelineTo(targetTime) {
		this.blockScrollEventsFromUpdatingCurrentTime += 1
		this.element_timeline.scrollTop = targetTime * this.timelinePixelsPerSecond;
		this.currentTime = Math.max(targetTime, 0)
	}
	/** @param {number} pixels */
	scrollTimelineByPixels(pixels) {
		var deltaSeconds = pixels / this.timelinePixelsPerSecond;
		var targetTime = Math.round((this.currentTime + deltaSeconds) * 5) / 5
		this.scrollTimelineTo(targetTime)
	}
	/** @param {VObject | null} object */
	setSelectedObject(object) {
		// Deselect previous object
		if (this.selectedObject) this.timelineElements.get(this.selectedObject)?.classList.remove("selected")
		// Select new object
		this.selectedObject = object
		if (this.selectedObject) this.timelineElements.get(this.selectedObject)?.classList.add("selected")
	}
	/** @param {HTMLElement} timelineElement */
	selectObjectFromTimelineBlock(timelineElement) {
		var object = new Map([...this.timelineElements].map((v) => [v[1], v[0]])).get(timelineElement)
		if (object == undefined) {
			// Uh...
			timelineElement.remove()
			return;
			// Anyways!
		}
		this.setSelectedObject(object)
	}
	/** @param {MouseEvent} event */
	canvasClicked(event) {
		var x = event.clientX - this.element_preview.getBoundingClientRect().left
		var y = event.clientY - this.element_preview.getBoundingClientRect().top
		for (var i = this.objects.length - 1; i >= 0; i--) { // reverse for loop ehehehe
			if (! this.objects[i].isVisibleAtTime(this.currentTime)) continue;
			if (Utils.pointInsideRect({ x, y }, this.objects[i].getPixelBoundingBox(this.element_preview.width, this.element_preview.height))) {
				this.setSelectedObject(this.objects[i]);
				return;
			}
		}
		this.setSelectedObject(null);
	}
}

var app = new VideoEditorApp()
app.frameLoop()
