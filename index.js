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
	 * @param {Map<string, ObjectProperty>[]} maps
	 * @returns {Map<string, ObjectProperty>}
	 */
	static collapsePropertyMaps(maps) {
		/** @type {Map<string, ObjectProperty>} */
		var newMap = new Map();
		for (var map of maps) {
			for (var [key, value] of map) {
				newMap.set(key, value.copy())
			}
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
	 * @param {number} num
	 * @param {number} bits
	 */
	static roundToSignificantDigitsBinary(num, bits) {
		if (num === 0) return 0;
		var exponent = Math.floor(Math.log2(Math.abs(num)));
		var shift = Math.pow(2, bits - 1 - exponent);
		return Math.round(num * shift) / shift;
	}
	/**
	 * @template {HTMLElement} T
	 * @param {WeakRef<T>} element
	 * @param {(element: T) => void} callback
	 */
	static _whileElementConnectedCallback(element, callback) {
		var shouldContinue = (() => {
			var e = element.deref();
			if (e == undefined) {
				return false;
			} else {
				callback(e);
				return true;
			}
		})();
		if (shouldContinue) requestAnimationFrame(() => this._whileElementConnectedCallback(element, callback))
	}
	/**
	 * @template {HTMLElement} T
	 * @param {T} element
	 * @param {(element: T) => void} callback
	 */
	static whileElementConnectedCallback(element, callback) {
		var elementRef = new WeakRef(element)
		Utils._whileElementConnectedCallback(elementRef, callback)
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
	/**
	 * @param {Blob} blob
	 * @param {string} filename
	 */
	static downloadBlob(blob, filename) {
		var url = URL.createObjectURL(blob);
		// Create link element
		var a = document.createElement('a');
		a.setAttribute("style", "display: none;")
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		// Cleanup
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}
/**
 * @typedef {{ type: "number", value: number } | { type: "string", value: string } | { type: "boolean", value: boolean } | { type: "list", value: CustomJSONObject[] } | { type: "map", value: Map<string, CustomJSONObject> } | { type: "null" }} CustomJSONObject
 */
class CustomJSON {
	/**
	 * @param {CustomJSONObject} object
	 * @returns {string}
	 */
	static encode(object) {
		if (object.type == "number") {
			var str = object.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
			return "#" + str;
		} else if (object.type == "string") {
			return "\"" + object.value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll(";", "\\;");
		} else if (object.type == "boolean") {
			return object.value ? "+" : "-"
		} else if (object.type == "list") {
			return "[" + object.value.length + object.value.map((v) => CustomJSON.encode(v)).join(";") + ";"
		} else if (object.type == "map") {
			return "{" + object.value.size + ";" + [...object.value.entries()].map((v) =>
				v[0].replaceAll("\\", "\\\\").replaceAll("#", "\\#").replaceAll("\"", "\\\"").replaceAll("[", "\\[").replaceAll("{", "\\{") + CustomJSON.encode(v[1]) + ";"
			).join("")
		} else {
			return "/";
		}
	}
	/**
	 * @param {string} data
	 * @returns {CustomJSONObject}
	 */
	static decode(data) {
		var chars = [...data.split(""), "[END]"]
		/**
		 * @param {string[]} endChars
		 * @returns {CustomJSONObject}
		 */
		function readValue(endChars) {
			if (chars[0] == "#") {
				chars.shift()
				var objData = chars.splice(0, chars.findIndex((v) => endChars.includes(v))).join("")
				return { type: "number", value: Number(objData) }
			} else if (chars[0] == "\"") {
				chars.shift()
				var stringData = ""
				while (! endChars.includes(chars[0])) {
					// @ts-ignore
					if (chars[0] == "\\") {
						chars.shift()
						stringData += chars.shift()
					}
					stringData += chars.shift()
				}
				return { type: "string", value: stringData }
			} else if (chars[0] == "+") {
				return { type: "boolean", value: true }
			} else if (chars[0] == "-") {
				return { type: "boolean", value: false }
			} else if (chars[0] == "[") {
				chars.shift()
				let arrayLength = Number(chars.splice(0, chars.findIndex((v) => ["#", "\"", "+", "-", "[", "{", "/"].includes(v))).join(""))
				/** @type {CustomJSONObject[]} */
				let parsed = []
				for (let i = 0; i < arrayLength; i++) {
					let value = readValue([";"])
					chars.shift()
					parsed.push(value)
				}
				return { type: "list", value: parsed }
			} else if (chars[0] == "{") {
				chars.shift()
				let mapLength = Number(chars.splice(0, chars.findIndex((v) => v == ";")).join(""))
				chars.shift()
				/** @type {Map<string, CustomJSONObject>} */
				let parsed = new Map()
				for (let i = 0; i < mapLength; i++) {
					let key = chars.splice(0, chars.findIndex((v) => ["#", "\"", "+", "-", "[", "{", "/"].includes(v))).join("");
					let value = readValue([";"])
					chars.shift()
					parsed.set(key, value)
				}
				return { type: "map", value: parsed }
			} else return { type: "null" }
		}
		return readValue(["[END]"])
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
	/** @returns {CustomJSONObject} */
	save() {
		throw new Error("Cannot convert a base property to JSON")
	}
	/**
	 * @param {CustomJSONObject} data
	 * @returns {ObjectProperty}
	 */
	static load(data) {
		if (data.type == "number") return new NumericProperty(data.value)
		else if (data.type == "string") return new StringProperty(data.value)
		else if (data.type == "map") {
			var x = data.value.get("x")
			var y = data.value.get("y")
			if (x != undefined && y != undefined && x.type == "number" && y.type == "number") return new PositionProperty(x.value, y.value)
			var r = data.value.get("r")
			var g = data.value.get("g")
			var b = data.value.get("b")
			var a = data.value.get("a")
			if (r != undefined && g != undefined && b != undefined && a != undefined && r.type == "number" && g.type == "number" && b.type == "number" && a.type == "number") return new ColorProperty(r.value, g.value, b.value, a.value)
		}
		throw new Error("Invalid saved property data")
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
	/**
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(update) {
		throw new Error("Cannot visualize a base property")
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
	/** @returns {CustomJSONObject} */
	save() {
		return { type: "number", value: this.value }
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
	/**
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(update) {
		var e = Options.number(null, () => this.value, (v) => { this.value = v; update(); })
		e.setAttribute("min", "0")
		e.setAttribute("step", "0.001")
		e.setAttribute("max", "1")
		return { contents: [e], children: [] }
	}
}
class PositionProperty extends ObjectProperty {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super()
		/** @type {number} */
		this.x = x
		/** @type {number} */
		this.y = y
	}
	/** @returns {PositionProperty} */
	copy() {
		return new PositionProperty(this.x, this.y)
	}
	/** @returns {CustomJSONObject} */
	save() {
		return { type: "map", value: new Map([
			["x", { type: "number", value: this.x }],
			["y", { type: "number", value: this.y }]
		]) }
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof PositionProperty) {
			this.x = property.x
			this.y = property.y
		} else throw new Error("Cannot set PositionProperty to a differently-typed property")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {PositionProperty}
	 */
	interpolate(time, endpoint) {
		if (endpoint instanceof PositionProperty) {
			var x = ((1-time) * this.x) + (time * endpoint.x)
			var y = ((1-time) * this.y) + (time * endpoint.y)
			return new PositionProperty(x, y)
		} else throw new Error("Cannot interpolate PositionProperty with a differently-typed property")
	}
	/**
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(update) {
		var x = Options.number(null, () => this.x, (v) => { this.x = v; update(); }); x.setAttribute("min", "0"); x.setAttribute("step", "0.01"); x.setAttribute("max", "1");
		var y = Options.number(null, () => this.y, (v) => { this.y = v; update(); }); y.setAttribute("min", "0"); y.setAttribute("step", "0.01"); y.setAttribute("max", "1");
		return { contents: [], children: [
			{
				text: "X:",
				contents: [x],
				children: []
			},
			{
				text: "Y:",
				contents: [y],
				children: []
			}
		] }
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
	/** @returns {CustomJSONObject} */
	save() {
		return { type: "map", value: new Map([
			["r", { type: "number", value: this.r }],
			["g", { type: "number", value: this.g }],
			["b", { type: "number", value: this.b }],
			["a", { type: "number", value: this.a }]
		]) }
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
	/**
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(update) {
		var r = Options.number(null, () => this.r, (v) => { this.r = v; update(); }); r.setAttribute("min", "0"); r.setAttribute("step", "1"); r.setAttribute("max", "255");
		var g = Options.number(null, () => this.g, (v) => { this.g = v; update(); }); g.setAttribute("min", "0"); g.setAttribute("step", "1"); g.setAttribute("max", "255");
		var b = Options.number(null, () => this.b, (v) => { this.b = v; update(); }); b.setAttribute("min", "0"); b.setAttribute("step", "1"); b.setAttribute("max", "255");
		var a = Options.number(null, () => this.a, (v) => { this.a = v; update(); }); a.setAttribute("min", "0"); a.setAttribute("step", "1"); a.setAttribute("max", "255");
		return { contents: [], children: [
			{
				text: "R",
				contents: [r],
				children: []
			}, {
				text: "G",
				contents: [g],
				children: []
			}, {
				text: "B",
				contents: [b],
				children: []
			}, {
				text: "A",
				contents: [a],
				children: []
			}
		]}
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
	/** @returns {CustomJSONObject} */
	save() {
		return { type: "string", value: this.value }
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
	/**
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(update) {
		var e = Options.string(null, () => this.value, (v) => { this.value = v; update(); })
		return { contents: [e], children: [] }
	}
}

/** @template {number[]} L */
class Handle {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 * @param {L} initialPos
	 */
	constructor(app, object, initialPos) {
		this.app = app
		this.object = object
		/** @type {L} */
		this.pos = initialPos
		this.element = document.createElement("div")
		this.element.classList.add("handle")
		this.updatePos()
	}
	updatePos() {}
	/** @param {L} newPos */
	moveTo(newPos) {
		this.pos = newPos
		this.updatePos()
	}
	updateFromObject() {
		this.updatePos()
	}
}
/** @extends {Handle<[number]>} */
class InvisibleTimeHandle extends Handle {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 * @param {number} initialPos
	 */
	constructor(app, object, initialPos) {
		super(app, object, [initialPos])
		this.timeOffset = initialPos - this.object.config.startTime
	}
	updatePos() {}
	/** @param {[number]} newPos */
	moveTo(newPos) {
		newPos[0] = Math.max(newPos[0], this.timeOffset)
		// update pos
		super.moveTo(newPos)
		// set object start time
		var delta = (this.pos[0] - this.timeOffset) - this.object.config.startTime
		this.object.config.startTime += delta
		// set keyframe times
		this.object.config.keyframes.forEach((v) => v.time += delta)
	}
	updateFromObject() {}
}
/** @extends {Handle<[number]>} */
class KeyframeTimeHandle extends Handle {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 * @param {number} keyframe_idx
	 */
	constructor(app, object, keyframe_idx) {
		super(app, object, [object.config.keyframes[keyframe_idx]?.time ?? object.config.startTime])
		this.keyframe_idx = keyframe_idx;
	}
	updatePos() {
		this.element.setAttribute("style", `--y: ${this.pos[0]}; --x: 0;`)
	}
	/** @param {[number]} newPos */
	moveTo(newPos) {
		// validate position
		var minTime = this.keyframe_idx == -1 ? 0 : (this.object.config.keyframes[this.keyframe_idx-1]?.time ?? this.object.config.startTime)
		var maxTime = this.object.config.keyframes[this.keyframe_idx+1]?.time ?? Infinity
		newPos[0] = Math.max(Math.min(newPos[0], maxTime), minTime)
		if (newPos[0] == (this.keyframe_idx == -1 ? this.object.config.startTime : this.object.config.keyframes[this.keyframe_idx].time)) return; // did not move
		// update pos
		super.moveTo(newPos)
		// set keyframe time
		if (this.keyframe_idx == -1) this.object.config.startTime = this.pos[0]
		else this.object.config.keyframes[this.keyframe_idx].time = this.pos[0]
		// update previews
		this.app.refreshTimelinePreviews(this.object)
	}
	updateFromObject() {
		if (this.keyframe_idx == -1) this.pos[0] = this.object.config.startTime
		else this.pos[0] = this.object.config.keyframes[this.keyframe_idx].time
		super.updateFromObject();
	}
}
/** @extends {Handle<[number, number]>} */
class InvisibleObjectMoveHandle extends Handle {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 * @param {{ x: number, y: number }} initialPos
	 * @param {(delta: { x: number, y: number }, keyframe_number: number) => void} move_by
	 * @param {number} keyframe_number
	 */
	constructor(app, object, initialPos, move_by, keyframe_number) {
		super(app, object, [initialPos.x, initialPos.y])
		this.move_by_callback = move_by
		this.keyframe_number = keyframe_number
	}
	updatePos() {}
	/** @param {[number, number]} newPos */
	moveTo(newPos) {
		var difference = {
			x: newPos[0] - this.pos[0],
			y: newPos[1] - this.pos[1]
		}
		// update pos
		super.moveTo(newPos)
		// move by
		this.move_by_callback(difference, this.keyframe_number)
	}
	updateFromObject() {}
}
/** @extends {Handle<[number, number]>} */
class ObjectRescaleHandle extends Handle {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 * @param {{ x: 1 | -1, y: 1 | -1 }} corner
	 * @param {(delta: { x: number, y: number }, keyframe_number: number) => void} move_by
	 * @param {(delta: number, keyframe_number: number) => void} rescale_by
	 * @param {number} keyframe_number
	 */
	constructor(app, object, corner, move_by, rescale_by, keyframe_number) {
		var initialPos = ObjectRescaleHandle.get_pos(app.element_preview.width, app.element_preview.height, object, corner)
		super(app, object, [initialPos.x, initialPos.y])
		this.corner = corner
		this.move_by_callback = move_by
		this.rescale_by_callback = rescale_by
		this.keyframe_number = keyframe_number
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @param {VObject} object
	 * @param {{ x: 1 | -1, y: 1 | -1 }} corner
	 */
	static get_pos(screenWidth, screenHeight, object, corner) {
		var box = object.getPixelBoundingBox(screenWidth, screenHeight)
		var pixelPos = {
			x: box.x + (corner.x == 1 ? box.width : 0),
			y: box.y + (corner.y == 1 ? box.height : 0)
		}
		return {
			x: pixelPos.x / screenWidth,
			y: pixelPos.y / screenHeight
		}
	}
	updatePos() {
		this.element.setAttribute("style", ` --x: ${(this.pos[0] - 0.5) * this.app.element_preview.width}px; --y: ${(this.pos[1] - 0.5) * this.app.element_preview.height}px;`)
	}
	/** @param {[number, number]} newPos */
	moveTo(newPos) {
		var oppositePoint = ObjectRescaleHandle.get_pos(this.app.element_preview.width, this.app.element_preview.height, this.object, { x: this.corner.x == -1 ? 1 : -1, y: this.corner.y == -1 ? 1 : -1 })
		var previousDifference = {
			x: this.pos[0] - oppositePoint.x,
			y: this.pos[1] - oppositePoint.y
		}
		var newDifference = {
			x: newPos[0] - oppositePoint.x,
			y: newPos[1] - oppositePoint.y
		}
		// update pos
		super.moveTo(newPos)
		// scale and move the object (only along the current rescale direction)
		// [NOTE: The next 7 lines were written by AI. I think it's fine. (Also, I really do not want to do all this math myself.)]
		var previousDistance = Math.hypot(previousDifference.x, previousDifference.y)
		var alignedNewDistance = ((newDifference.x * previousDifference.x) + (newDifference.y * previousDifference.y)) / previousDistance
		var scaleFactor = alignedNewDistance / previousDistance
		var moveAmount = {
			x: previousDifference.x * (alignedNewDistance - previousDistance) / (2 * previousDistance),
			y: previousDifference.y * (alignedNewDistance - previousDistance) / (2 * previousDistance)
		}
		this.rescale_by_callback(scaleFactor, this.keyframe_number)
		this.move_by_callback(moveAmount, this.keyframe_number)
	}
	updateFromObject() {
		var pos = ObjectRescaleHandle.get_pos(this.app.element_preview.width, this.app.element_preview.height, this.object, this.corner)
		this.pos[0] = pos.x
		this.pos[1] = pos.y
		super.updateFromObject();
	}
}

class Options {
	/**
	 * @param {string} text
	 * @returns {HTMLElement}
	 */
	static h(text) {
		var e = document.createElement("h3")
		e.innerText = text
		return e
	}
	/**
	 * @param {string} text
	 * @returns {HTMLElement}
	 */
	static p(text) {
		var e = document.createElement("p")
		e.innerText = text
		return e
	}
	/**
	 * @param {{ text: string, onclick: (() => void) | null }[]} buttons
	 * @returns {HTMLElement}
	 */
	static buttons(buttons) {
		var e = document.createElement("div");
		for (var buttonData of buttons) {
			var b = e.appendChild(document.createElement("button"));
			b.innerText = buttonData.text;
			if (buttonData.onclick == null) b.disabled = true;
			else b.addEventListener("click", buttonData.onclick);
		}
		return e;
	}
	/**
	 * @param {string | null} text
	 * @param {() => number} getter
	 * @param {(value: number) => void} setter
	 * @returns {HTMLElement}
	 */
	static number(text, getter, setter) {
		if (text != null)  {
			/** @type {HTMLElement} */
			var c = document.createElement("div")
			c.innerText = text
			var e = c.appendChild(document.createElement("input"))
		} else {
			var e = document.createElement("input")
			/** @type {HTMLElement} */
			var c = e
		}
		e.setAttribute("type", "number")
		e.setAttribute("style", `margin-left: 0.5em;`)
		e.valueAsNumber = getter()
		e.addEventListener("keydown", (event) => {
			if (event.key == "Enter") {
				// @ts-ignore
				event.target.blur();
			}
		})
		var isFocused = false;
		Utils.whileElementConnectedCallback(e, (_e) => {
			if (_e == document.activeElement) {
				isFocused = true;
			} else {
				if (isFocused) {
					// Element just became unfocused
					setter(_e.valueAsNumber)
					isFocused = false;
				} else {
					// set value from getter
					var gotValue = getter()
					if (_e.valueAsNumber != gotValue) _e.valueAsNumber = gotValue
				}
			}
		})
		return c
	}
	/**
	 * @param {string | null} text
	 * @param {() => string} getter
	 * @param {(value: string) => void} setter
	 * @returns {HTMLElement}
	 */
	static string(text, getter, setter) {
		if (text != null)  {
			/** @type {HTMLElement} */
			var c = document.createElement("div")
			c.innerText = text
			var e = c.appendChild(document.createElement("input"))
		} else {
			var e = document.createElement("input")
			/** @type {HTMLElement} */
			var c = e
		}
		e.setAttribute("type", "text")
		e.setAttribute("style", `margin-left: 0.5em;`)
		e.value = getter()
		e.addEventListener("keydown", (event) => {
			if (event.key == "Enter") {
				// @ts-ignore
				event.target.blur();
			}
		})
		var isFocused = false;
		Utils.whileElementConnectedCallback(e, (_e) => {
			if (_e == document.activeElement) {
				isFocused = true;
			} else {
				if (isFocused) {
					// Element just became unfocused
					setter(_e.value)
					isFocused = false;
				} else {
					// set value from getter
					var gotValue = getter()
					if (_e.value != gotValue) _e.value = gotValue
				}
			}
		})
		return c
	}
	/**
	 * @typedef {{ text: string, contents: HTMLElement[], children: OptionsTreeNode[] }} OptionsTreeNode
	 * @param {OptionsTreeNode} rootNode
	 */
	static tree(rootNode) {
		var e = document.createElement("div")
		e.classList.add("tree-node")
		e.appendChild(document.createTextNode(rootNode.text))
		for (let i = 0; i < rootNode.contents.length; i++) {
			let c = rootNode.contents[i];
			e.appendChild(c);
		}
		for (let i = 0; i < rootNode.children.length; i++) {
			let c = rootNode.children[i];
			let subNode = Options.tree(c)
			e.appendChild(subNode);
		}
		return e
	}
	/**
	 * @param {Map<string, ObjectProperty>} properties
	 * @param {string} key
	 * @param {() => void} update
	 */
	static _propertyMap_delete_button(properties, key, update) {
		var button = document.createElement("button")
		button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M 3.8 15.5 Q 3.1 15.5 2.7 15 T 2.2 13.8 V 3 H 1.3 V 1.3 H 5.5 V 0.5 H 10.5 V 1.3 H 14.7 V 3 H 13.8 V 13.8 Q 13.8 14.5 13.3 15 T 12.2 15.5 H 3.8 Z M 12.2 3 H 3.8 V 13.8 H 12.2 V 3 Z M 5.5 12.2 H 7.2 V 4.7 H 5.5 V 12.2 Z M 8.8 12.2 H 10.5 V 4.7 H 8.8 V 12.2 Z M 3.8 3 V 13.8 V 3 Z" fill="currentcolor" /></svg>`
		button.addEventListener("click", () => {
			properties.delete(key)
			update()
		})
		return button
	}
	/**
	 * @param {Map<string, ObjectProperty>} properties
	 * @param {string} key
	 * @param {Map<string, ObjectProperty>} creationDefaultMap
	 * @param {() => void} update
	 */
	static _propertyMap_add_button(properties, key, creationDefaultMap, update) {
		var _newValue = creationDefaultMap.get(key);
		if (_newValue == undefined) throw new Error("missing property creation default value")
		var newValue = _newValue
		// make button
		var button = document.createElement("button")
		button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M 2.17 13.83 H 3.35 L 11.5 5.69 L 10.31 4.5 L 2.17 12.65 V 13.83 Z M 0.5 15.5 V 11.96 L 11.5 0.98 Q 11.75 0.75 12.05 0.62 T 12.69 0.5 Q 13.02 0.5 13.33 0.62 T 13.88 1 L 15.02 2.17 Q 15.27 2.4 15.39 2.71 T 15.5 3.33 Q 15.5 3.67 15.39 3.97 T 15.02 4.52 L 4.04 15.5 H 0.5 Z" fill="currentcolor" /></svg>`
		button.addEventListener("click", () => {
			properties.set(key, newValue.copy())
			update()
		})
		return button
	}
	/**
	 * @param {() => void} update
	 * @param {string[]} allKeys
	 * @param {Map<string, ObjectProperty>} properties
	 * @param {boolean} deletionAllowed
	 * @param {Map<string, ObjectProperty> | null} creationDefaultMap
	 * @returns {OptionsTreeNode[]}
	 */
	static propertyMap(update, allKeys, properties, deletionAllowed, creationDefaultMap) {
		return allKeys.map((v) => {
			var data = properties.get(v)
			if (data == null) return {
				text: v,
				contents: creationDefaultMap == null ? [] : [Options._propertyMap_add_button(properties, v, creationDefaultMap, update)],
				children: []
			}
			var elements = data.makeElements(update)
			return {
				text: v,
				contents: [
					...(deletionAllowed ? [Options._propertyMap_delete_button(properties, v, update)] : []),
					...elements.contents
				],
				children: elements.children
			}
		});
	}
}
class OptionsWindowTab {
	/**
	 * @param {string} name
	 * @param {HTMLElement[]} contents
	 */
	constructor(name, contents) {
		this.button = document.createElement("button")
		var radio = this.button.appendChild(document.createElement("input"))
			radio.setAttribute("type", "radio")
			radio.setAttribute("name", "options")
		this.button.appendChild(document.createTextNode(name))
		this.section = document.createElement("section")
		for (var c of contents) {
			this.section.appendChild(c)
		}
	}
	show() {
		Utils.requireElement("tab-container").appendChild(this.button)
		Utils.requireElement("tab-container").appendChild(this.section)
	}
	focus() {
		this.button.children[0].dispatchEvent(new MouseEvent("click"))
	}
	/**
	 * @param {HTMLElement[]} contents
	 */
	changeContents(contents) {
		[...this.section.children].forEach((v) => v.remove())
		for (var c of contents) {
			this.section.appendChild(c)
		}
	}
	hide() {
		this.button.remove()
		this.section.remove()
	}
}
class ObjectCustomEditorTab extends OptionsWindowTab {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 */
	constructor(app, object) {
		super("Object Options", [])
		this.app = app
		this.object = object
		this.refresh()
	}
	refresh() {
		this.changeContents(ObjectCustomEditorTab.getContents(this.object, this.app.currentTime, (t) => this.app.setCurrentTime(t), () => {
			this.app.refreshTimelinePreviews(this.object)
			this.app.updateViewportHandles()
			this.app.refreshSelectionTabs()
		}))
	}
	/**
	 * @param {VObject} object
	 * @param {number} time
	 * @param {(time: number) => void} setTime
	 * @param {() => void} onObjectUpdated
	 */
	static getContents(object, time, setTime, onObjectUpdated) {
		// Find keyframe number
		let idx = object.config.keyframes.findIndex((v) => v.time == time);
		var keyframeNumber = object.config.startTime == time ? -1 : (idx == -1 ? null : idx);
		if (keyframeNumber == null) {
			return [
				Options.h("Not at a keyframe"),
				Options.buttons([
					{ text: "Previous keyframe", onclick: ObjectCustomEditorTab.previousKeyframe(object, time, setTime) },
					{ text: "Next keyframe", onclick: ObjectCustomEditorTab.nextKeyframe(object, time, setTime) }
				]),
				Options.p("Move the timeline to one of this object's keyframes (or click one of the buttons above) to edit its settings!")
			]
		} else {
			var defaults = object.getPropertiesAtKeyframe(keyframeNumber)
			return [
				Options.h(`Keyframe ${keyframeNumber+2}`),
				Options.buttons([
					{ text: "Previous keyframe", onclick: ObjectCustomEditorTab.previousKeyframe(object, time, setTime) },
					{ text: "Next keyframe", onclick: ObjectCustomEditorTab.nextKeyframe(object, time, setTime) }
				]),
				Options.tree({
					text: `Properties at keyframe ${keyframeNumber+2}`,
					contents: [],
					children: Options.propertyMap(onObjectUpdated, [...defaults.keys()], object.config.keyframes[keyframeNumber]?.properties ?? object.config.initialProperties, keyframeNumber != -1, defaults)
				})
			]
		}
	}
	/**
	 * @param {VObject} object
	 * @param {number} time
	 * @param {(time: number) => void} setTime
	 * @returns {(() => void) | null}
	 */
	static previousKeyframe(object, time, setTime) {
		if (time <= object.config.startTime) return null;
		for (var i = 0; i < object.config.keyframes.length; i++) {
			let t = object.config.keyframes[i].time
			if (time <= t) return setTime.bind(null,
				i == 0 ? object.config.startTime : object.config.keyframes[i - 1].time
			)
		}
		return setTime.bind(null, object.config.keyframes[object.config.keyframes.length - 1].time)
	}
	/**
	 * @param {VObject} object
	 * @param {number} time
	 * @param {(time: number) => void} setTime
	 * @returns {(() => void) | null}
	 */
	static nextKeyframe(object, time, setTime) {
		if (time < object.config.startTime) return setTime.bind(null, object.config.startTime)
		for (var i = 0; i < object.config.keyframes.length; i++) {
			let t = object.config.keyframes[i].time
			if (time < t) return setTime.bind(null, object.config.keyframes[i].time)
		}
		return null;
	}
}
class ObjectPropertiesEditorTab extends OptionsWindowTab {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 */
	constructor(app, object) {
		super("Object Properties", [])
		this.app = app
		this.object = object
		this.refresh()
	}
	refresh() {
		this.changeContents(ObjectPropertiesEditorTab.getContents(this.object, () => {
			this.app.refreshTimelinePreviews(this.object)
			this.app.updateViewportHandles()
			this.app.refreshSelectionTabs()
		}))
	}
	/**
	 * @param {VObject} object
	 * @param {() => void} onObjectUpdated
	 */
	static getContents(object, onObjectUpdated) {
		var treeItems = [object.config.initialProperties, ...object.config.keyframes.map((v) => v.properties)].flatMap((v, i) => ({
			text: `Keyframe ${i+1}`,
			contents: [],
			children: Options.propertyMap(onObjectUpdated, [...object.getPropertiesAtKeyframe(i - 1).keys()], v, i != 0, object.getPropertiesAtKeyframe(i - 1))
		}))
		return [
				Options.tree({
				text: "All Object Properties",
				contents: [],
				children: treeItems
			})
		]
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
				{ time: startTime + length, properties: new Map() }
			]
		}
	}
	/** @returns {{ type: "map", value: Map<string, CustomJSONObject> }} */
	save() {
		return { type: "map", value: new Map([
			["startTime", { type: "number", value: this.config.startTime }],
			["initialProperties", { type: "map", value: new Map(
				[...this.config.initialProperties].map((v) => [v[0], v[1].save()])
			) }],
			["keyframes", { type: "list", value:
				this.config.keyframes.map((v) => ({ type: "map", value: new Map([
					["time", { type: "number", value: v.time }],
					["properties", { type: "map", value: new Map(
						[...v.properties].map((v) => [v[0], v[1].save()])
					) }]
				]) }))
			}]
		]) }
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
	 * @param {number} keyframe_number
	 */
	getPropertiesAtKeyframe(keyframe_number) {
		return Utils.collapsePropertyMaps([
			this.config.initialProperties,
			...this.config.keyframes.slice(0, keyframe_number + 1).map((v) => v.properties)
		])
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
				var previousData = this.getPropertiesAtKeyframe(i - 1)
				var nextData = this.getPropertiesAtKeyframe(i)
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
			if (time == this.config.keyframes[i].time) return this.getPropertiesAtKeyframe(i);
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
	 * @template {new (...args: any[]) => ObjectProperty} T
	 * @param {string} property
	 * @param {T} propertyType
	 * @param {number} keyframe_number
	 * @returns {InstanceType<T>}
	 */
	requireProperty(property, propertyType, keyframe_number) {
		var configuredPosition = keyframe_number == -1 ? this.config.initialProperties.get(property) : this.config.keyframes[keyframe_number].properties.get(property)
		if (configuredPosition == undefined) {
			configuredPosition = this.getPropertiesAtKeyframe(keyframe_number).get(property);
			if (configuredPosition == undefined) throw new Error(`Required property ${JSON.stringify(property)} is not present anywhere in this object`)
			if (keyframe_number == -1) { this.config.initialProperties.set(property, configuredPosition); } else { this.config.keyframes[keyframe_number].properties.set(property, configuredPosition); }
		}
		// @ts-ignore
		if (configuredPosition instanceof propertyType) return configuredPosition
		// @ts-ignore
		throw new Error(`Property ${JSON.stringify(property)} is of an incorrect type; expected ${propertyType.name} but got ${configuredPosition.constructor.name}`);
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
	/**
	 * @param {number} keyframe_number
	 * @param {VideoEditorApp} app
	 * @returns {Handle<[number, number]>[]}
	 */
	getViewportHandles(keyframe_number, app) {
		throw new Error("Cannot get handles of a base object")
	}
	/**
	 * @param {{ x: number, y: number }} delta
	 * @param {number} keyframe_number
	 */
	moveBy(delta, keyframe_number) {
		throw new Error("Cannot move a base object")
	}
}
class VText extends VObject {
	/**
	 * @param {number} startTime
	 */
	constructor(startTime) {
		// - pos/size
		var centerPos = new PositionProperty(0.5, 0.5)
		var width = new NumericProperty(0.15)
		// - text
		var text = new StringProperty("Text goes here asdf asdf asdf asdf asdf")
		var color = new ColorProperty(255, 255, 255, 255)
		var textSize = new NumericProperty(0.015)
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["Center Position", centerPos],
			["Width", width],
			["Text", text],
			["Text Color", color],
			["Text Size", textSize]
		]
		super(startTime, new Map(properties), 5)
		// properties
		this.centerPos = centerPos
		this.width = width
		this.text = text
		this.color = color
		this.textSize = textSize
		// rendering cache
		/** @type {CacheMap<[number, string, { r: number, g: number, b: number, a: number }, number], OffscreenCanvas>} */
		this.renders = new CacheMap(VText.createRender, 10)
	}
	/** @returns {{ type: "map", value: Map<string, CustomJSONObject> }} */
	save() {
		return { type: "map", value: new Map([
			["type", { type: "string", value: "text" }],
			...super.save().value
		]) }
	}
	/**
	 * @param {number} width
	 * @param {string} text
	 * @param {{ r: number, g: number, b: number, a: number }} color
	 * @param {number} textSize
	 * @returns {OffscreenCanvas}
	 */
	static createRender(width, text, color, textSize) {
		var words = text.split(/(?= )/i)
		// Render lines
		var completedLines = []
		var currentLine = ""
		for (var word of words) {
			// Find size
			var lineWithWord = currentLine + word
			var size = Utils.getTextSize(lineWithWord, textSize + "px sans-serif")
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
		var size = Utils.getTextSize("A g", textSize + "px sans-serif")
		var image = new OffscreenCanvas(width, completedLines.length * size.y)
		var ctx = image.getContext('2d');
		if (ctx == null) throw new Error("can't render text because context is null");
		ctx.font = textSize + "px sans-serif";
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
		return this.renders.get(this.width.value * screenWidth, this.text.value, this.color.asobj(), this.textSize.value * screenWidth)
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {{ x: number, y: number, width: number, height: number }}
	 */
	getPixelBoundingBox(screenWidth, screenHeight) {
		var render = this.renders.get(this.width.value * screenWidth, this.text.value, this.color.asobj(), this.textSize.value * screenWidth);
		var posX = (this.centerPos.x * screenWidth) - (render.width / 2)
		var posY = (this.centerPos.y * screenHeight) - (render.height / 2)
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
		var render = this.renders.get(this.width.value * screenWidth, this.text.value, this.color.asobj(), this.textSize.value * screenWidth);
		var posX = (this.centerPos.x * screenWidth) - (render.width / 2)
		var posY = (this.centerPos.y * screenHeight) - (render.height / 2)
		canvas.drawImage(render, Math.round(posX), Math.round(posY))
	}
	/**
	 * @param {number} keyframe_number
	 * @param {VideoEditorApp} app
	 * @returns {Handle<[number, number]>[]}
	 */
	getViewportHandles(keyframe_number, app) {
		return [
			new ObjectRescaleHandle(app, this, { x: -1, y: -1 }, this.moveBy.bind(this), this.rescaleBy.bind(this), keyframe_number),
			new ObjectRescaleHandle(app, this, { x: 1, y: -1 }, this.moveBy.bind(this), this.rescaleBy.bind(this), keyframe_number),
			new ObjectRescaleHandle(app, this, { x: -1, y: 1 }, this.moveBy.bind(this), this.rescaleBy.bind(this), keyframe_number),
			new ObjectRescaleHandle(app, this, { x: 1, y: 1 }, this.moveBy.bind(this), this.rescaleBy.bind(this), keyframe_number)
		]
	}
	/**
	 * @param {{ x: number, y: number }} delta
	 * @param {number} keyframe_number
	 */
	moveBy(delta, keyframe_number) {
		// Set Center Position
		var configuredPosition = this.requireProperty("Center Position", PositionProperty, keyframe_number)
		configuredPosition.x += delta.x;
		configuredPosition.y += delta.y;
	}
	/**
	 * @param {number} delta
	 * @param {number} keyframe_number
	 */
	rescaleBy(delta, keyframe_number) {
		if (delta <= 0 || this.textSize.value * delta < 0.001) return;
		// Set Width
		var configuredWidth = this.requireProperty("Width", NumericProperty, keyframe_number)
		configuredWidth.value *= delta;
		// Set Text Size
		var configuredTextSize = this.requireProperty("Text Size", NumericProperty, keyframe_number)
		configuredTextSize.value *= delta;
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
		this.element_preview.addEventListener("mousedown", this.canvasClicked.bind(this))
		this.blockScrollEventsFromUpdatingCurrentTime = 0
		// video data
		this.video_aspect_ratio = 16 / 9;
		this.currentTime = 0;
		/** @type {VObject[]} */
		this.objects = [];
		this.objects.push(new VText(1)); // TEST
		this.objects[0].config.keyframes[0].properties.set("Center Position", new PositionProperty(0.9, 0.6)) // TEST
		this.objects[0].config.keyframes[0].properties.set("Text Color", new ColorProperty(255, 0, 0, 255)) // TEST
		/** @type {{ object: VObject, timelineHandles: Handle<[number]>[], viewportHandles: Handle<[number, number]>[], draggingHandle: { isTimeline: true, handle: Handle<[number]> } | { isTimeline: false, handle: Handle<[number, number]> } | null, objectEditorTab: ObjectCustomEditorTab, objectPropertiesTab: ObjectPropertiesEditorTab } | null} */
		this.selection = null;
		// main tab
		this.mainOptionsTab = new OptionsWindowTab("Scene", [
			Options.number("Current time:", () => this.currentTime, (v) => this.setCurrentTime(v)),
			Options.buttons([
				{ text: "Export Project", onclick: () => this.export() }
			])
		])
		this.mainOptionsTab.show()
		this.mainOptionsTab.focus()
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
		this.updateAllTimelineElements(true);
	}
	/** @returns {{ type: "map", value: Map<string, CustomJSONObject> }} */
	save() {
		return { type: "map", value: new Map([
			["aspect_ratio", { type: "number", value: this.video_aspect_ratio }],
			["objects", { type: "list", value: this.objects.map((v) => v.save()) }]
		]) }
	}
	export() {
		// Save file
		var data = CustomJSON.encode(this.save())
		// Zip
		var zip = new JSZip();
		zip.file("project.dat", data)
		zip.generateAsync({ type: "blob" }).then((blob) => {
			Utils.downloadBlob(blob, "project.zip")
		})
	}
	/** @param {number} amount */
	zoomTimeline(amount) {
		this.timelinePixelsPerSecond *= amount
		this.element_timeline.setAttribute("style", `--height-per-second: ${this.timelinePixelsPerSecond}px;`)
		this.element_timeline.scrollTop *= amount
		this.updateAllTimelineElements(true);
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
	/** @param {boolean} refreshPreviews */
	updateAllTimelineElements(refreshPreviews) {
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
			if (refreshPreviews) {
				[...e.children].forEach((v) => v.remove())
				this.addPreviewToTimelineElement(o, e);
			}
		}
	}
	/**
	 * @param {VObject} object
	 * @param {HTMLElement} timelineElement
	 * @param {undefined | number} [startTime]
	 */
	async addPreviewToTimelineElement(object, timelineElement, startTime) {
		// Check time
		if (startTime == undefined) {
			startTime = Date.now()
			timelineElement.dataset.adding_previews_started_at = String(startTime)
		} else if (timelineElement.dataset.adding_previews_started_at != String(startTime)) {
			// Another function is updating the previews
			return;
		}

		// Get the height of previous preview elements
		var previewHeight = (timelineElement.lastElementChild?.getBoundingClientRect().bottom ?? timelineElement.getBoundingClientRect().top) - timelineElement.getBoundingClientRect().top;
		if (previewHeight > timelineElement.getBoundingClientRect().height) {
			// done creating previews for this element!
			delete timelineElement.dataset.adding_previews_started_at
			return;
		}

		// Render object
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
				this.addPreviewToTimelineElement(object, timelineElement, startTime)
			}); });
		});
	}
	/**
	 * @param {VObject} object
	 */
	refreshTimelinePreviews(object) {
		var timelineElement = this.timelineElements.get(object);
		if (timelineElement == null) return;
		[...timelineElement.children].forEach((v) => v.remove());
		this.addPreviewToTimelineElement(object, timelineElement)
	}
	updateCanvas() {
		this.preview_ctx.clearRect(0, 0, this.element_preview.width, this.element_preview.height)
		// draw objects
		for (var o of this.objects) {
			if (o.isVisibleAtTime(this.currentTime)) {
				o.setCurrentPropertiesToCalculatedPropertiesAtTime(this.currentTime)
				o.render(this.element_preview.width, this.element_preview.height, this.preview_ctx)
			}
		}
		// draw selection
		if (this.selection != null && this.selection.object.isVisibleAtTime(this.currentTime)) {
			var box = this.selection.object.getPixelBoundingBox(this.element_preview.width, this.element_preview.height)
			this.preview_ctx.fillStyle = "#08F3"
			this.preview_ctx.fillRect(box.x, box.y, box.width, box.height)
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
		// Update selection handles
		this.updateViewportHandles();
		// Update selection-related tabs
		this.refreshSelectionTabs()
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
	/**
	 * @param {number} mouseY
	 */
	getRoundedTimelinePosition(mouseY) {
		let targetTimeExact = this.currentTime + ((mouseY - (window.innerHeight / 2)) / this.timelinePixelsPerSecond)
		let stepSize = Utils.roundToSignificantDigitsBinary(12.5 / this.timelinePixelsPerSecond, 1)
		let targetTimeRounded = Math.round(targetTimeExact / stepSize) * stepSize
		return targetTimeRounded
	}
	/**
	 * @param {number} mouseX
	 * @param {number} mouseY
	 */
	getRoundedViewportPosition(mouseX, mouseY) {
		let rect = this.element_preview.getBoundingClientRect()
		let xExact = (mouseX - rect.left) / this.element_preview.width
		let yExact = (mouseY - rect.top) / this.element_preview.height
		let xRounded = Math.round(xExact * 1000) / 1000
		let yRounded = Math.round(yExact * 1000) / 1000
		return { x: xRounded, y: yRounded }
	}
	/** @param {number} targetTime */
	setCurrentTime(targetTime) {
		this.blockScrollEventsFromUpdatingCurrentTime += 1
		this.element_timeline.scrollTop = targetTime * this.timelinePixelsPerSecond;
		this.currentTime = Math.max(targetTime, 0)
	}
	/** @param {VObject | null} object */
	setSelectedObject(object) {
		// Deselect previous object
		if (this.selection != null) {
			this.timelineElements.get(this.selection.object)?.classList.remove("selected")
			this.selection.objectEditorTab.hide()
			this.selection.objectPropertiesTab.hide()
			this.mainOptionsTab.focus()
		}
		for (let h of this.selection?.timelineHandles ?? []) {
			h.element.remove()
		}
		for (let h of this.selection?.viewportHandles ?? []) {
			h.element.remove()
		}
		// Select new object
		if (object == null) this.selection = null
		else {
			this.selection = {
				object,
				timelineHandles: [],
				viewportHandles: [],
				draggingHandle: null,
				objectEditorTab: new ObjectCustomEditorTab(this, object),
				objectPropertiesTab: new ObjectPropertiesEditorTab(this, object)
			}
			this.selection.objectEditorTab.show()
			this.selection.objectEditorTab.focus()
			this.selection.objectPropertiesTab.show()
			// Start time handle
			{
				let start_time_handle = new KeyframeTimeHandle(this, object, -1);
				this.selection.timelineHandles.push(start_time_handle);
				this.element_timeline.appendChild(start_time_handle.element);
			}
			// Keyframe handle
			for (var i = 0; i < object.config.keyframes.length; i++) {
				let keyframe_handle = new KeyframeTimeHandle(this, object, i);
				this.selection.timelineHandles.push(keyframe_handle);
				this.element_timeline.appendChild(keyframe_handle.element);
			}
			// Viewport handles
			this.updateViewportHandles();
		}
		if (this.selection != null) this.timelineElements.get(this.selection.object)?.classList.add("selected")
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
	updateHandlePositions() {
		if (this.selection == null) return;
		for (let h of this.selection.timelineHandles) {
			h.updateFromObject()
		}
		for (let h of this.selection.viewportHandles) {
			h.updateFromObject()
		}
	}
	updateViewportHandles() {
		if (this.selection == null) return;
		// Viewport Handles
		let idx = this.selection.object.config.keyframes.findIndex((v) => v.time == this.currentTime);
		var keyframeNumber = this.selection.object.config.startTime == this.currentTime ? -1 : (idx == -1 ? null : idx);
		// Remove old handles
		[...this.selection.viewportHandles].forEach((v) => v.element.remove())
		this.selection.viewportHandles = []
		// Add handles
		if (keyframeNumber != null) {
			this.selection.object.setCurrentPropertiesToCalculatedPropertiesAtTime(this.currentTime)
			this.selection.viewportHandles = [...this.selection.object.getViewportHandles(keyframeNumber, this)]
			this.selection.viewportHandles.forEach((v) => this.element_preview.parentNode?.appendChild(v.element))
		}
	}
	refreshSelectionTabs() {
		if (this.selection == null) return;
		this.selection.objectEditorTab.refresh();
		this.selection.objectPropertiesTab.refresh();
	}
	/** @param {MouseEvent} event */
	canvasClicked(event) {
		var x = event.clientX - this.element_preview.getBoundingClientRect().left
		var y = event.clientY - this.element_preview.getBoundingClientRect().top
		for (var i = this.objects.length - 1; i >= 0; i--) { // reverse for loop ehehehe
			if (! this.objects[i].isVisibleAtTime(this.currentTime)) continue;
			if (Utils.pointInsideRect({ x, y }, this.objects[i].getPixelBoundingBox(this.element_preview.width, this.element_preview.height))) {
				// De-select current object or select this object
				if (this.selection != null) {
					if (this.selection.object != this.objects[i]) this.setSelectedObject(null);
					else this.startDraggingInvisibleViewportHandleForObject(this.selection.object, { x: event.clientX, y: event.clientY });
				} else this.setSelectedObject(this.objects[i]);
				return;
			}
		}
		this.setSelectedObject(null);
	}
	/**
	 * @param {HTMLDivElement} element
	 * @param {number} mouseY
	 * @param {number} mouseX
	 */
	startDraggingHandleFromElement(element, mouseX, mouseY) {
		if (this.selection == null || this.selection.draggingHandle != null) return;
		// check for timeline handle
		{
			let handle = new Map(this.selection.timelineHandles.map((v) => [v.element, v])).get(element)
			if (handle != undefined) {
				// Select timeline handle
				this.selection.draggingHandle = {
					isTimeline: true,
					handle: handle
				}
				element.classList.add("active")
				// Move handle
				this.moveDraggingHandle(0, mouseY)
			}
		}
		// check for viewport handle
		{
			let handle = new Map(this.selection.viewportHandles.map((v) => [v.element, v])).get(element)
			if (handle != undefined) {
				// Select viewport handle
				this.selection.draggingHandle = {
					isTimeline: false,
					handle: handle
				}
				element.classList.add("active")
				// Move handle
				this.moveDraggingHandle(mouseX, mouseY)
			}
		}
	}
	/**
	 * @param {VObject} object
	 * @param {number} mouseY
	 */
	startDraggingInvisibleTimelineHandleForObject(object, mouseY) {
		if (this.selection == null || this.selection.draggingHandle != null) return;
		// Select timeline handle
		let targetTime = this.getRoundedTimelinePosition(mouseY);
		this.selection.draggingHandle = {
			isTimeline: true,
			handle: new InvisibleTimeHandle(this, object, targetTime)
		}
	}
	/**
	 * @param {VObject} object
	 * @param {{ x: number, y: number }} pixelMousePos
	 */
	startDraggingInvisibleViewportHandleForObject(object, pixelMousePos) {
		if (this.selection == null || this.selection.draggingHandle != null) return;
		var mousePos = this.getRoundedViewportPosition(pixelMousePos.x, pixelMousePos.y)
		// Find keyframe number
		let idx = this.selection.object.config.keyframes.findIndex((v) => v.time == this.currentTime);
		var keyframeNumber = this.selection.object.config.startTime == this.currentTime ? -1 : (idx == -1 ? null : idx);
		if (keyframeNumber != null) {
			// Select viewport handle
			this.selection.draggingHandle = {
				isTimeline: false,
				handle: new InvisibleObjectMoveHandle(this, object, mousePos, object.moveBy.bind(object), keyframeNumber)
			}
		}
	}
	/**
	 * @param {number} mouseX
	 * @param {number} mouseY
	 */
	moveDraggingHandle(mouseX, mouseY) {
		if (this.selection == null || this.selection.draggingHandle == null) return;
		if (this.selection.draggingHandle.isTimeline) {
			let handle = this.selection.draggingHandle.handle
			// Move handle
			let targetTime = this.getRoundedTimelinePosition(mouseY)
			handle.moveTo([targetTime])
			this.updateViewportHandles()
		} else {
			let handle = this.selection.draggingHandle.handle
			// Move handle
			let targetPos = this.getRoundedViewportPosition(mouseX, mouseY)
			handle.moveTo([targetPos.x, targetPos.y])
			handle.object.setCurrentPropertiesToCalculatedPropertiesAtTime(this.currentTime) // <-- this will update `handle.object`'s direct properties (which will cause `updateHandlePositions` to give the correct handle positions) since `handle.moveTo` only updates the object's `config`
		}
		this.updateAllTimelineElements(false)
		this.updateHandlePositions()
		this.refreshSelectionTabs()
	}
	stopDraggingHandle() {
		if (this.selection == null || this.selection.draggingHandle == null) return;
		// De-select handle
		this.selection.draggingHandle.handle.element.classList.remove("active")
		this.selection.draggingHandle = null
	}
}

var app = new VideoEditorApp()
app.frameLoop()
