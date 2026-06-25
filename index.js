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
	 * @param {{ time: number, properties: Map<string, ObjectProperty> }[]} maps
	 * @returns {Map<string, ObjectProperty>}
	 */
	static collapsePropertyMaps(maps) {
		/** @type {Map<string, ObjectProperty>} */
		var newMap = new Map();
		/** @type {Map<AutoincrementingTimeProperty, number>} */
		var incProperties = new Map();
		for (var map of maps) {
			for (var [key, value] of map.properties) {
				var newValue = value.copy()
				newMap.set(key, newValue)
				if (newValue instanceof AutoincrementingTimeProperty) {
					// Record the time this property was set
					incProperties.set(newValue, map.time)
				}
			}
		}
		for (var [property, time] of incProperties) {
			property.value += maps[maps.length - 1].time - time
		}
		return newMap;
	}
	/**
	 * @param {string} hex
	 * @returns {{ r: number, g: number, b: number }}
	 */
	static colorHexToRGB(hex) {
		return {
			r: parseInt(hex.substring(1, 3), 16),
			g: parseInt(hex.substring(3, 5), 16),
			b: parseInt(hex.substring(5, 7), 16)
		};
	}
	/**
	 * @param {{ r: number, g: number, b: number }} rgb
	 * @returns {string}
	 */
	static colorRGBToHex(rgb) {
		return "#" + rgb.r.toString(16).padStart(2, '0') + rgb.g.toString(16).padStart(2, '0') + rgb.b.toString(16).padStart(2, '0');
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
	 * @param {T} element
	 * @param {(element: T) => void} callback
	 */
	static whileElementConnectedCallback(element, callback) {
		requestAnimationFrame(() => {
			// Check if the element is connected
			if (element.isConnected) {
				if (element.checkVisibility()) callback(element);
			} else {
				element.style.pointerEvents = "none";
				element.style.background = "#F00";
				element.style.color = "white";
				element.style.fontWeight = "bold";
				element.style.textDecoration = "line-through";
				return;
			}
			// Loop
			requestAnimationFrame(() => {
				this.whileElementConnectedCallback(element, callback)
			});
		});
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
	/** @type {WeakMap<Blob, string>} */
	static BLOB_HASHES = new WeakMap();
	/**
	 * @param {Blob} blob
	 * @returns {Promise<string>}
	 */
	static async _hashBlob(blob) {
		var arrayBuffer = await blob.arrayBuffer();
		// Calculate the hash using Web Crypto API
		var hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
		// convert to hex string
		var hashArray = [...new Uint8Array(hashBuffer)];
		var hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return hashHex;
	}
	/**
	 * @param {Blob} blob
	 * @returns {Promise<string>}
	 */
	static async hashBlob(blob) {
		var cachedValue = this.BLOB_HASHES.get(blob)
		if (cachedValue != undefined) return cachedValue;
		// Create new hash
		var hash = await this._hashBlob(blob)
		this.BLOB_HASHES.set(blob, hash);
		return hash;
	}
	/**
	 * @param {Blob} blob
	 * @returns {string | undefined}
	 */
	static hashBlobInstant(blob) {
		var cachedValue = this.BLOB_HASHES.get(blob)
		if (cachedValue != undefined) return cachedValue;
		else {
			this.hashBlob(blob)
			return undefined;
		}
	}
	/**
	 * @param {AudioBuffer} audioBuffer
	 * @param {number} startTimeSec
	 * @param {number} endTimeSec
	 */
	static async getAudioLoudness(audioBuffer, startTimeSec, endTimeSec) {
		// convert time to sample indexes
		var startSample = Math.round(Math.floor(Math.max(                 0, startTimeSec) * audioBuffer.sampleRate));
		var endSample =   Math.round(Math.floor(Math.min(audioBuffer.duration, endTimeSec) * audioBuffer.sampleRate));
		if (startSample >= endSample) throw new Error("Invalid time window selection.");
		// Calculate RMS
		const channelData = audioBuffer.getChannelData(0);
		let sumOfSquares = 0;
		let sampleCount = 0;
		for (let i = startSample; i < endSample; i++) {
			sumOfSquares += channelData[i] * channelData[i];
			sampleCount++;
		}
		const rms = Math.sqrt(sumOfSquares / sampleCount);
		return 5 * rms;
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
			var str = object.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 });
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
class FFmpegAccessor {
	static FFMPEG = (() => {
		var f = FFmpeg.create()
		f.on("log", (e) => {
			console.log(e.type, e.message)
		})
		return f;
	})();
	static LOCK = (() => {
		var lock = Promise.resolve()
		/** @type {(() => void) | null} */
		var resolver = null
		return {
			acquire: async () => {
				await lock;
				lock = new Promise((resolve) => resolver = resolve)
			},
			unlock: () => {
				if (resolver == null) throw new Error("Lock is already unlocked")
				resolver()
				resolver = null;
			}
		}
	})();
	/**
	 * @param {Blob} blob
	 */
	static async splitVideoOrAudioIntoStreams(blob) {
		await this.LOCK.acquire();
		// Get stream list
		this.FFMPEG.writeFile("/split", new Uint8Array(await blob.arrayBuffer()))
		await this.FFMPEG.ffprobe(["-show_entries", "stream=index,codec_type,channels,channel_layout,channel_layout:stream_disposition", "-of", "json", "/split", "-o", "/probe.txt"])
		var probeOutput = JSON.parse(new TextDecoder().decode(await this.FFMPEG.readFile("/probe.txt"))).streams
		// Parse stream list
		/** @type {({ index: number, streamIndex: number, type: "video" } | { index: number, streamIndex: number, type: "audio", channels: number, layout_name: string })[]} */
		var streams = []
		/** @type {Map<string, number>} */
		var streamIndexes = new Map();
		for (let i = 0; i < probeOutput.length; i++) {
			let index = Number(probeOutput[i].index);
			let type = probeOutput[i].codec_type;
			let streamIndex = (streamIndexes.get(type) ?? -1) + 1; streamIndexes.set(type, streamIndex);
			if (type == "video") {
				if (probeOutput[i].disposition.attached_pic == 1) continue;
				streams.push({ index, streamIndex, type })
			} else if (type == "audio") {
				let channels = Number(probeOutput[i].channels);
				let layout_name = probeOutput[i].channel_layout;
				streams.push({ index, streamIndex, type, channels, layout_name })
			} else {
				console.error("Unknown stream type:", type)
			}
		}
		// Extract each into own file
		var args = [
			"-i", "/split",
			...streams.flatMap((s) => [
				"-map",
				`0:${{ "video": "v", "audio": "a", "subtitle": "s" }[s.type]}:${s.streamIndex}`,
				"-c",
				"copy",
				`/out${s.index}.${{ "video": "mp4", "audio": "wav", "subtitle": "srt" }[s.type]}`
			])
		]
		await this.FFMPEG.exec(args)
		// Finish / clean up
		await this.FFMPEG.deleteFile("/split");
		/** @type {{ type: "video" | "audio", data: Blob }[]} */
		var outputData = [];
		for (let s of streams) {
			let filename = `/out${s.index}.${{ "video": "mp4", "audio": "wav", "subtitle": "srt" }[s.type]}`
			outputData.push({
				type: s.type,
				data: new Blob([await this.FFMPEG.readFile(filename)])
			})
			await this.FFMPEG.deleteFile(filename)
		}
		this.LOCK.unlock();
		return outputData;
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
		var cacheKey = JSON.stringify(params.map((v) => v instanceof Blob ? Utils.hashBlobInstant(v) : v))
		var cachedValue = this.items.get(cacheKey)
		if (cachedValue != undefined) return cachedValue
		var value = this.func(...params)
		this.addCachedValue(cacheKey, value)
		return value;
	}
}
/**
 * @template {any[]} T
 * @template V
 */
class AsyncCacheMap {
	/** @param {(...params: T) => Promise<V>} func */
	constructor(func, size = 10) {
		/** @type {(...params: T) => Promise<V>} */
		this.func = func
		/** @type {number} */
		this.size = size
		/** @type {Map<string, { hasValue: false, callbacks: ((value: V) => void)[] } | { hasValue: true, value: V }>} */
		this.items = new Map()
	}
	clear() {
		this.items.clear()
	}
	/**
	 * @param {string} param
	 * @param {V} result
	 */
	async addCachedValue(param, result) {
		// update promises
		var previousEntry = this.items.get(param)
		if (previousEntry != undefined && !previousEntry.hasValue) previousEntry.callbacks.forEach((v) => v(result))
		// Set item
		this.items.set(param, { hasValue: true, value: result })
		if (this.items.size > this.size) {
			this.items.delete(this.items.keys().next().value ?? "")
		}
	}
	/**
	 * @param {T} params
	 * @returns {V | undefined}
	 */
	get(...params) {
		var cacheKey = JSON.stringify(params.map((v) => v instanceof Blob ? Utils.hashBlobInstant(v) : v))
		// Check for cached value
		var cachedValue = this.items.get(cacheKey)
		if (cachedValue != undefined) {
			if (cachedValue.hasValue) return cachedValue.value;
			else return undefined;
		}
		// New cache entry
		this.items.set(cacheKey, { hasValue: false, callbacks: [] })
		this.func(...params).then((v) => this.addCachedValue(cacheKey, v))
		return undefined;
	}
	/**
	 * @param {T} params
	 * @returns {Promise<V>}
	 */
	async getAsync(...params) {
		var cacheKey = JSON.stringify(params.map((v) => v instanceof Blob ? Utils.hashBlobInstant(v) : v))
		// Check for cached value
		var cachedValue = this.items.get(cacheKey)
		if (cachedValue != undefined) {
			if (cachedValue.hasValue) return cachedValue.value;
			else {
				let promiseArray = cachedValue.callbacks;
				let finalValue = await new Promise((resolve) => void(promiseArray.push(resolve)));
				return finalValue;
			}
		}
		// New cache entry
		this.items.set(cacheKey, { hasValue: false, callbacks: [] })
		let finalValue = await this.func(...params)
		this.addCachedValue(cacheKey, finalValue)
		return finalValue;
	}
}

class ObjectProperty {
	constructor() {}
	/** @returns {ObjectProperty} */
	copy() {
		throw new Error("Cannot copy a base property")
	}
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
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
			var time = data.value.get("time")
			if (time != undefined && time.type == "number") return new AutoincrementingTimeProperty(time.value)
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
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		throw new Error("Cannot visualize a base property")
	}
}
class NumericProperty extends ObjectProperty {
	/**
	 * @param {number} value
	 * @param {number | undefined} [min]
	 * @param {number | undefined} [max]
	 * @param {number | undefined} [step]
	 */
	constructor(value, min, max, step) {
		super()
		/** @type {number} */
		this.value = value
		/** @type {number} */
		this.min = min ?? 0
		/** @type {number} */
		this.max = max ?? 1
		/** @type {number} */
		this.step = step ?? 0.001
	}
	/** @returns {NumericProperty} */
	copy() {
		return new NumericProperty(this.value, this.min, this.max, this.step)
	}
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
		return { type: "number", value: this.value }
	}
	toString() {
		return this.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 });
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
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		var e = Options.number(null, () => this.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.value = v; update(); })
		e.setAttribute("min", this.min.toString())
		e.setAttribute("step", this.step.toString())
		e.setAttribute("max", this.max.toString())
		return { contents: [e], children: [] }
	}
}
class AutoincrementingTimeProperty extends ObjectProperty {
	/**
	 * @param {number} value
	 */
	constructor(value) {
		super()
		/** @type {number} */
		this.value = value
	}
	/** @returns {AutoincrementingTimeProperty} */
	copy() {
		return new AutoincrementingTimeProperty(this.value);
	}
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
		return { type: "map", value: new Map([
			["time", { type: "number", value: Math.ceil(this.value * 8192) / 8192 }]
		]) }
	}
	toString() {
		return this.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 });
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof AutoincrementingTimeProperty) {
			this.value = property.value
		} else throw new Error("Cannot set AutoincrementingTimeProperty to a differently-typed property")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {AutoincrementingTimeProperty}
	 */
	interpolate(time, endpoint) {
		if (endpoint instanceof AutoincrementingTimeProperty) {
			var value = ((1-time) * this.value) + (time * endpoint.value)
			return new AutoincrementingTimeProperty(value)
		} else throw new Error("Cannot interpolate AutoincrementingTimeProperty with a differently-typed property")
	}
	/**
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		var e = Options.number(null, () => this.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 5 }), (v) => { this.value = v; update(); })
		e.setAttribute("min", "0")
		e.setAttribute("step", "0.001")
		if (sourceObject instanceof VVideo) e.setAttribute("max", sourceObject.duration.toString())
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
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
		return { type: "map", value: new Map([
			["x", { type: "number", value: this.x }],
			["y", { type: "number", value: this.y }]
		]) }
	}
	toString() {
		return "X: " + this.x.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }) + ", Y: " + this.y.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 });
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
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		var x = Options.number(null, () => this.x.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.x = v; update(); });
		x.setAttribute("min", "0"); x.setAttribute("step", "0.01"); x.setAttribute("max", "1");
		var y = Options.number(null, () => this.y.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.y = v; update(); });
		y.setAttribute("min", "0"); y.setAttribute("step", "0.01"); y.setAttribute("max", "1");
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
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
		return { type: "map", value: new Map([
			["r", { type: "number", value: this.r }],
			["g", { type: "number", value: this.g }],
			["b", { type: "number", value: this.b }],
			["a", { type: "number", value: this.a }]
		]) }
	}
	toString() {
		return Utils.colorRGBToHex(this.asobj()) + " (R: " + Math.max(Math.min(Math.round(this.r), 255), 0).toString() +
			", G: " + Math.max(Math.min(Math.round(this.g), 255), 0).toString() +
			", B: " + Math.max(Math.min(Math.round(this.g), 255), 0).toString() +
			", A: " + Math.max(Math.min(Math.round(this.g), 255), 0).toString() + ")";
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
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		var r = Options.number(null, () => this.r.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.r = v; update(); });
		r.setAttribute("min", "0"); r.setAttribute("step", "1"); r.setAttribute("max", "255");
		var g = Options.number(null, () => this.g.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.g = v; update(); });
		g.setAttribute("min", "0"); g.setAttribute("step", "1"); g.setAttribute("max", "255");
		var b = Options.number(null, () => this.b.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.b = v; update(); });
		b.setAttribute("min", "0"); b.setAttribute("step", "1"); b.setAttribute("max", "255");
		var a = Options.number(null, () => this.a.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 }), (v) => { this.a = v; update(); });
		a.setAttribute("min", "0"); a.setAttribute("step", "1"); a.setAttribute("max", "255");
		return { contents: [
			Options.color(() => this.asobj(), (v) => {
				this.r = v.r
				this.g = v.g
				this.b = v.b
			})
		], children: [
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
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
		return { type: "string", value: this.value }
	}
	toString() {
		return "\"" + this.value + "\"";
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof StringProperty) {
			this.value = property.value
		} else throw new Error("Cannot set StringProperty to a differently-typed property")
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
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		var e = Options.string(null, () => this.value, (v) => { this.value = v; update(); })
		return { contents: [e], children: [] }
	}
}
class BlobProperty extends ObjectProperty {
	/** @param {Blob} value */
	constructor(value) {
		super()
		/** @type {Blob} */
		this.value = value
		Utils.hashBlob(this.value)
	}
	/** @returns {BlobProperty} */
	copy() {
		return new BlobProperty(this.value)
	}
	/** @returns {Promise<CustomJSONObject>} */
	async save() {
		return { type: "map", value: new Map([
			["blobHash", { type: "string", value: await Utils.hashBlob(this.value) }]
		]) }
	}
	toString() {
		return `[File (${this.value.size / 1000}KB)]`
	}
	/** @param {ObjectProperty} property */
	setFrom(property) {
		if (property instanceof BlobProperty) {
			this.value = property.value
		} else throw new Error("Cannot set NumericProperty to a differently-typed property")
	}
	/**
	 * @param {number} time
	 * @param {ObjectProperty} endpoint
	 * @returns {BlobProperty}
	 */
	interpolate(time, endpoint) {
		throw new Error("Cannot interpolate a BlobProperty")
	}
	/**
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @returns {{ contents: HTMLElement[], children: OptionsTreeNode[]}}
	 */
	makeElements(sourceObject, update) {
		var e = Options.string(null, () => Utils.hashBlobInstant(this.value) ?? "Error", (v) => { throw new Error(); })
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
	onDragFinish() {
		this.object.afterPropertiesUpdated();
		this.app.saveUndoState()
	}
	updateFromObject() {
		this.updatePos()
	}
}
/** @extends {Handle<[number, number]>} */
class InvisibleTimeHandle extends Handle {
	/**
	 * @param {VideoEditorApp} app
	 * @param {VObject} object
	 * @param {number} initialPos
	 */
	constructor(app, object, initialPos) {
		super(app, object, [initialPos, object.config.renderLayer])
		this.timeOffset = initialPos - this.object.config.startTime
	}
	updatePos() {}
	/** @param {[number, number]} newPos */
	moveTo(newPos) {
		newPos[0] = Math.max(newPos[0], this.timeOffset)
		newPos[1] = Math.max(Math.floor(newPos[1]), 0)
		// update pos
		super.moveTo(newPos)
		// set object start time
		var delta = (this.pos[0] - this.timeOffset) - this.object.config.startTime
		this.object.config.startTime += delta
		// set keyframe times
		this.object.config.keyframes.forEach((v) => v.time += delta)
		// set layer
		this.object.config.renderLayer = this.pos[1]
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
		this.element.setAttribute("style", `--y: ${this.pos[0]}; --x: ${this.object.config.renderLayer};`)
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
		this.object.afterPropertiesUpdated();
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
	 * @param {string} text
	 * @returns {HTMLElement}
	 */
	static text(text) {
		var e = document.createElement("span")
		e.innerText = text
		return e
	}
	/**
	 * @param {{ text: string, onclick: (() => void) | null, color?: undefined | string }} buttonData
	 * @returns {HTMLElement}
	 */
	static button(buttonData) {
		var b = document.createElement("button");
		b.innerText = buttonData.text;
		if (buttonData.color != undefined) b.setAttribute("style", `--accent-color: ${buttonData.color};`)
		if (buttonData.onclick == null) b.disabled = true;
		else b.addEventListener("click", buttonData.onclick);
		return b;
	}
	/**
	 * @param {{ text: string, onclick: (() => void) | null, color?: undefined | string }[]} buttons
	 * @returns {HTMLElement}
	 */
	static buttons(buttons) {
		var e = document.createElement("div");
		for (var buttonData of buttons) {
			e.appendChild(Options.button(buttonData));
		}
		return e;
	}
	/**
	 * @param {string | null} text
	 * @param {() => number | string} getter
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
		e.addEventListener("keydown", (event) => {
			if (event.key == "Enter") {
				// @ts-ignore
				event.target.blur();
			}
		})
		{
			var gotValue = getter()
			if (typeof gotValue == "string") e.value = gotValue
			else e.valueAsNumber = gotValue
		}
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
					if (Math.abs(_e.valueAsNumber - Number(gotValue)) > 0.00001) {
						if (typeof gotValue == "string") _e.value = gotValue
						else _e.valueAsNumber = gotValue
					}
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
	 * @param {() => { r: number, g: number, b: number }} getter
	 * @param {(value: { r: number, g: number, b: number }) => void} setter
	 * @returns {HTMLElement}
	 */
	static color(getter, setter) {
		var e = document.createElement("button")
		e.classList.add("custom-color-picker")
		var previousColor = ""
		Utils.whileElementConnectedCallback(e, (_e) => {
			var gotValue = Utils.colorRGBToHex(getter())
			if (previousColor != gotValue) {
				_e.setAttribute("style", `--color-picker-color: ${gotValue};`)
				previousColor = gotValue
			}
		})
		e.addEventListener("click", (event) => {
			if (event.target != event.currentTarget) return;
			var picker = document.createElement("input")
			picker.setAttribute("type", "color")
			e.appendChild(picker)
			requestAnimationFrame(() => picker.click())
			picker.addEventListener("input", () => {
				setter(Utils.colorHexToRGB(picker.value))
			})
		})
		return e
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
	 * @param {VObject} sourceObject
	 * @param {() => void} update
	 * @param {string[]} allKeys
	 * @param {Map<string, ObjectProperty>} properties
	 * @param {boolean} deletionAllowed
	 * @param {Map<string, ObjectProperty> | null} creationDefaultMap
	 * @returns {OptionsTreeNode[]}
	 */
	static propertyMap(sourceObject, update, allKeys, properties, deletionAllowed, creationDefaultMap) {
		return allKeys.map((v) => {
			var data = properties.get(v)
			if (data == null) return {
				text: v,
				contents: creationDefaultMap == null ? [] : [Options._propertyMap_add_button(properties, v, creationDefaultMap, update)],
				children: []
			}
			var elements = data.makeElements(sourceObject, update)
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
			this.object.afterPropertiesUpdated();
			this.app.saveUndoState();
			this.app.refreshTimelinePreviews(this.object)
			this.app.updateViewportHandlesExistence()
			this.app.refreshSelectionTabs()
		}, () => {
			this.object.afterPropertiesUpdated();
			this.app.saveUndoState();
			this.app.updateAllTimelineElements(false)
			this.app.refreshTimelinePreviews(this.object)
			this.app.updateHandlePositions()
			this.app.updateViewportHandlesExistence()
			this.app.refreshSelectionTabs()
		}))
	}
	/**
	 * @param {VObject} object
	 * @param {number} time
	 * @param {(time: number) => void} setTime
	 * @param {() => void} onObjectPropertiesUpdated
	 * @param {() => void} onObjectTimingUpdated
	 */
	static getContents(object, time, setTime, onObjectPropertiesUpdated, onObjectTimingUpdated) {
		// Find keyframe number
		let idx = object.config.keyframes.findIndex((v) => v.time == time);
		var keyframeNumber = object.config.startTime == time ? -1 : (idx == -1 ? null : idx);
		if (keyframeNumber == null) {
			var properties = object.getPropertiesAtTime(time)
			return [
				Options.h("Not at a keyframe"),
				Options.buttons([
					{ text: "Previous keyframe", onclick: ObjectCustomEditorTab.previousKeyframe(object, time, setTime) },
					{ text: "Next keyframe", onclick: ObjectCustomEditorTab.nextKeyframe(object, time, setTime) },
					{ text: "Create keyframe here", onclick: ObjectCustomEditorTab.createKeyframe(object, time, onObjectTimingUpdated) }
				]),
				Options.p("Move the timeline to one of this object's keyframes (or click one of the buttons above) to edit its settings!"),
				...(properties == null ? [] : [Options.tree({
					text: `Computed properties at ${time} seconds`,
					contents: [],
					children: [...properties].map((v) => ({
						text: v[0] + ": ",
						contents: [Options.text(v[1].toString())],
						children: []
					}))
				})])
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
					children: Options.propertyMap(object, onObjectPropertiesUpdated, [...defaults.keys()], object.config.keyframes[keyframeNumber]?.properties ?? object.config.initialProperties, keyframeNumber != -1, defaults)
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
	/**
	 * @param {VObject} object
	 * @param {number} time
	 * @param {() => void} onObjectTimingUpdated
	 * @returns {() => void}
	 */
	static createKeyframe(object, time, onObjectTimingUpdated) {
		if (time < object.config.startTime) return () => {
			// Insert new keyframe at beginnning
			object.config.keyframes.unshift({
				time: object.config.startTime,
				properties: new Map()
			})
			object.config.startTime = time
			onObjectTimingUpdated()
		}
		for (var i = 0; i < object.config.keyframes.length; i++) {
			let t = object.config.keyframes[i].time
			if (time < t) return ((/** @type {number} */ i) => {
				// Insert new keyframe between two other keyframes
				object.config.keyframes.splice(i, 0, {
					time: time,
					properties: object.getPropertiesAtTime(time) ?? Utils.copyPropertyMap(object.config.initialProperties)
				})
				onObjectTimingUpdated()
			}).bind(null, i)
		}
		return () => {
			// Add new keyframe to end
			object.config.keyframes.push({
				time: time,
				properties: new Map()
			})
			onObjectTimingUpdated()
		}
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
			this.object.afterPropertiesUpdated();
			this.app.saveUndoState();
			this.app.refreshTimelinePreviews(this.object)
			this.app.updateViewportHandlesExistence()
			this.app.refreshSelectionTabs()
		}, () => {
			this.object.afterPropertiesUpdated();
			this.app.saveUndoState();
			this.app.updateAllTimelineElements(false)
			this.app.refreshTimelinePreviews(this.object)
			this.app.updateHandlePositions()
			this.app.updateViewportHandlesExistence()
			this.app.refreshSelectionTabs()
		}, () => {
			this.app.setSelectedObject(null)
			this.app.objects.splice(this.app.objects.indexOf(this.object), 1)
			this.app.saveUndoState();
			this.app.updateAllTimelineElements(false)
		}))
	}
	/**
	 * @param {VObject} object
	 * @param {() => void} onObjectPropertiesUpdated
	 * @param {() => void} onObjectTimingUpdated
	 * @param {() => void} deleteObject
	 */
	static getContents(object, onObjectPropertiesUpdated, onObjectTimingUpdated, deleteObject) {
		var treeItems = [object.config.initialProperties, ...object.config.keyframes.map((v) => v.properties)].flatMap((v, i) => ({
			text: `Keyframe ${i+1} at time`,
			contents: [
				Options.number(null, () => object.config.keyframes[i-1]?.time ?? object.config.startTime, (v) => {
					if (i == 0) object.config.startTime = v;
					else object.config.keyframes[i-1].time = v;
					onObjectTimingUpdated();
				}),
				...(object.config.keyframes.length > 1 ? [Options.button({ text: "Delete Keyframe", onclick: i == 0 ? () => {
					// Delete first keyframe
					object.config.initialProperties = object.getPropertiesAtKeyframe(0) // collapse property maps
					object.config.startTime = object.config.keyframes[0].time
					object.config.keyframes.shift()
					onObjectTimingUpdated()
				} : () => {
					// Delete another keyframe
					object.config.keyframes.splice(i-1, 1)
					onObjectTimingUpdated()
				} })] : []),
				Options.button({ text: "Insert Keyframe After", onclick: () => {
					var targetTime = (i == object.config.keyframes.length) ? (object.config.keyframes[i-1].time + 1) : (((object.config.keyframes[i-1]?.time ?? object.config.startTime) + object.config.keyframes[i].time) / 2)
					object.config.keyframes.splice(i, 0, {
						time: targetTime,
						properties: new Map()
					})
					onObjectTimingUpdated()
				} })
			],
			children: Options.propertyMap(object, onObjectPropertiesUpdated, [...object.getPropertiesAtKeyframe(i - 1).keys()], v, i != 0, object.getPropertiesAtKeyframe(i - 1))
		}))
		return [
			Options.tree({
				text: "All Object Properties",
				contents: [],
				children: [
					{
						text: "Layer Number",
						contents: [Options.number(null, () => object.config.renderLayer, (v) => object.config.renderLayer = Math.floor(v))],
						children: []
					},
					...treeItems
				]
			}),
			Options.buttons([
				{ text: "Delete Object", onclick: deleteObject, color: "#F00" }
			])
		]
	}
}

class VObject {
	timelineElementColor = "black"
	/**
	 * @param {number} startTime
	 * @param {Map<string, ObjectProperty>} initialProperties
	 * @param {number} length
	 */
	constructor(startTime, initialProperties, length) {
		/** @type {Map<string, ObjectProperty>} */
		this.properties = initialProperties
		/** @type {{ renderLayer: number, startTime: number, initialProperties: Map<string, ObjectProperty>, keyframes: { time: number, properties: Map<string, ObjectProperty> }[] }} */
		this.config = {
			renderLayer: 0,
			startTime,
			initialProperties: Utils.copyPropertyMap(initialProperties),
			keyframes: [
				{ time: startTime + length, properties: new Map() }
			]
		}
		/**
		 * Resolves when the object's data is loaded, and the object is ready to render. This does NOT guarantee that any given render will be fully loaded.
		 * @type {Promise<void>}
		 */
		this.fullyLoaded = new Promise((resolve) => resolve());
	}
	/** @returns {Promise<{ type: "map", value: Map<string, CustomJSONObject> }>} */
	async save() {
		return { type: "map", value: new Map([
			["renderLayer", { type: "number", value: this.config.renderLayer }],
			["startTime", { type: "number", value: this.config.startTime }],
			["initialProperties", { type: "map", value: new Map(
				await Promise.all(
					[...this.config.initialProperties].map(
						/** @returns {Promise<[string, CustomJSONObject]>} */
						async (v) => [v[0], await v[1].save()]
					)
				)
			) }],
			["keyframes", { type: "list", value:
				await Promise.all(
					this.config.keyframes.map(async (v) => ({ type: "map", value: new Map([
						["time", { type: "number", value: v.time }],
						["properties", { type: "map", value: new Map(
							await Promise.all(
								[...v.properties].map(
									/** @returns {Promise<[string, CustomJSONObject]>} */
									async (v) => [v[0], await v[1].save()]
								)
							)
						) }]
					]) }))
				)
			}]
		]) }
	}
	/** @returns {Blob[]} */
	getAllBlobs() {
		return []
	}
	/**
	 * @param {CustomJSONObject} data
	 * @param {Map<string, Blob>} blobs
	 * @returns {VObject}
	 */
	static load(data, blobs) {
		if (data.type != "map") throw new Error("Object data must be a map")
		var dataMap = data.value
		// get object type
		{
			let gotObjectType = dataMap.get("type")
			if (gotObjectType == undefined) throw new Error("Object data must include object type")
			if (gotObjectType.type != "string") throw new Error("Object type must be a string")
			var objectType = gotObjectType.value;
		}
		// blob getter
		/**
		 * @param {CustomJSONObject | undefined} data
		 * @returns {Blob}
		 */
		function getBlob(data) {
			if (data == undefined) throw new Error("Object of type " + objectType + " requires a blob!")
			if (data.type != "map") throw new Error("Blob hash container must be a map")
			var hash = data.value.get("blobHash")
			if (hash == undefined) throw new Error("Blob hash container must contain blob hash")
			if (hash.type != "string") throw new Error("Blob hash must be a string")
			var gotBlob = blobs.get(hash.value)
			if (gotBlob == undefined) throw new Error("Blob with hash " + hash.value + " is missing!")
			return gotBlob
		}
		// construct object
		/** @type {VObject} */
		var object;
		if (objectType == "text") object = new VText()
		else if (objectType == "image") object = new VImage(getBlob(dataMap.get("imageBlob")))
		else if (objectType == "video") object = new VVideo(getBlob(dataMap.get("videoBlob")))
		else throw new Error("Unknown object type: " + objectType)
		// set object layer
		{
			let gotLayer = dataMap.get("renderLayer")
			if (gotLayer == undefined) throw new Error("Object data must include rendering layer")
			if (gotLayer.type != "number") throw new Error("Object rendering layer must be a number")
			object.config.renderLayer = gotLayer.value;
		}
		// set object time
		{
			let gotStartTime = dataMap.get("startTime")
			if (gotStartTime == undefined) throw new Error("Object data must include object start time")
			if (gotStartTime.type != "number") throw new Error("Object start time must be a number")
			object.config.startTime = gotStartTime.value;
		}
		// set initial properties
		{
			let gotInitialProperties = dataMap.get("initialProperties")
			if (gotInitialProperties == undefined) throw new Error("Object data must include initial properties")
			if (gotInitialProperties.type != "map") throw new Error("Initial properties must be a map")
			var initialProperties = gotInitialProperties.value;
		}
		for (var propertyData of initialProperties) {
			object.config.initialProperties.get(propertyData[0])?.setFrom(ObjectProperty.load(propertyData[1]))
		}
		// set keyframes
		{
			let gotKeyframes = dataMap.get("keyframes")
			if (gotKeyframes == undefined) throw new Error("Object data must include keyframes")
			if (gotKeyframes.type != "list") throw new Error("Object keyframes must be a list")
			object.config.keyframes = gotKeyframes.value.map((v) => {
				if (v.type != "map") throw new Error("Keyframe configuration must be a map")
				var gotTime = v.value.get("time")
				if (gotTime == undefined) throw new Error("Keyframe must include time")
				if (gotTime.type != "number") throw new Error("Keyframe time must be a number")
				var gotProperties = v.value.get("properties")
				if (gotProperties == undefined) throw new Error("Keyframe must include property map")
				if (gotProperties.type != "map") throw new Error("Keyframe properties must be a map")
				return { time: gotTime.value, properties: new Map([...gotProperties.value].map((v) => {
					var property = ObjectProperty.load(v[1])
					return [v[0], property]
				})) }
			});
		}
		return object;
	}
	afterPropertiesUpdated() {}
	/**
	 * @param {number} time
	 * @returns {boolean}
	 */
	isVisibleAtTime(time) {
		if (time < this.config.startTime) return false;
		var maxTime = this.config.keyframes[this.config.keyframes.length - 1].time
		return time <= maxTime;
	}
	/** @param {number} keyframe_number */
	getPropertiesAtKeyframe(keyframe_number) {
		return Utils.collapsePropertyMaps([
			{ time: this.config.startTime, properties: this.config.initialProperties },
			...this.config.keyframes.slice(0, keyframe_number + 1)
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
	 * @returns {Promise<OffscreenCanvas>}
	 */
	async getVisualRepresentation(screenWidth, screenHeight) {
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
	timelineElementColor = "#0C0"
	constructor() {
		// - pos/size
		var centerPos = new PositionProperty(0.5, 0.5)
		var width = new NumericProperty(10)
		// - text
		var text = new StringProperty("Text")
		var color = new ColorProperty(255, 255, 255, 255)
		var scale = new NumericProperty(0.015)
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["Center Position", centerPos],
			["Relative Width", width],
			["Text", text],
			["Text Color", color],
			["Scale", scale]
		]
		super(0, new Map(properties), 5)
		// properties
		this.centerPos = centerPos
		this.width = width
		this.text = text
		this.color = color
		this.scale = scale
		// rendering cache
		/** @type {CacheMap<[number, string, { r: number, g: number, b: number, a: number }, number], OffscreenCanvas>} */
		this.renders = new CacheMap(VText.createRender, 10)
	}
	/** @returns {Promise<{ type: "map", value: Map<string, CustomJSONObject> }>} */
	async save() {
		return { type: "map", value: new Map([
			["type", { type: "string", value: "text" }],
			...(await super.save()).value
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
	getRender(screenWidth, screenHeight) {
		var expectedWidth = this.width.value * this.scale.value * screenWidth
		var canvas = this.renders.get(expectedWidth, this.text.value, this.color.asobj(), this.scale.value * screenWidth)
		return canvas
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {Promise<OffscreenCanvas>}
	 */
	async getVisualRepresentation(screenWidth, screenHeight) {
		return this.getRender(screenWidth, screenHeight);
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {{ x: number, y: number, width: number, height: number }}
	 */
	getPixelBoundingBox(screenWidth, screenHeight) {
		var render = this.getRender(screenWidth, screenHeight);
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
		var render = this.getRender(screenWidth, screenHeight);
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
		if (delta <= 0 || this.scale.value * delta < 0.001) return;
		// Set Scale
		var configuredScale = this.requireProperty("Scale", NumericProperty, keyframe_number)
		configuredScale.value *= delta;
	}
}
/** @template {any[]} T */
class VAbstractVisualObject extends VObject {
	/**
	 * @param {[string, ObjectProperty][]} additionalProperties
	 * @param {(...params: T) => Promise<OffscreenCanvas>} renderer
	 * @param {number} length
	 */
	constructor(additionalProperties, renderer, length) {
		// - pos/size
		var centerPos = new PositionProperty(0.5, 0.5)
		var width = new NumericProperty(0.5)
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["Center Position", centerPos],
			["Width", width],
			...additionalProperties
		]
		super(0, new Map(properties), length)
		// properties
		this.centerPos = centerPos
		this.width = width
		// rendering cache
		/** @type {AsyncCacheMap<T, OffscreenCanvas>} */
		this.renders = new AsyncCacheMap(renderer.bind(this), 40)
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {number}
	 */
	getExpectedHeight(screenWidth, screenHeight) {
		throw new Error("`VAbstractVisualObject` is an abstract class; `getExpectedHeight` must be overridden")
	}
	/**
	 * @param {number} expectedWidth
	 * @param {number} expectedHeight
	 * @returns {OffscreenCanvas}
	 */
	getRender(expectedWidth, expectedHeight) {
		throw new Error("`VAbstractVisualObject` is an abstract class; `getRender` must be overridden")
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {{ x: number, y: number, width: number, height: number }}
	 */
	getPixelBoundingBox(screenWidth, screenHeight) {
		var width = this.width.value * screenWidth;
		var height = this.getExpectedHeight(screenWidth, screenHeight)
		var posX = (this.centerPos.x * screenWidth) - (width / 2)
		var posY = (this.centerPos.y * screenHeight) - (height / 2)
		return {
			x: posX,
			y: posY,
			width: width,
			height: height
		}
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(screenWidth, screenHeight, canvas) {
		var render = this.getRender(screenWidth, screenHeight);
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
		if (delta <= 0 || this.width.value * delta < 0.001) return;
		// Set Width
		var configuredWidth = this.requireProperty("Width", NumericProperty, keyframe_number)
		configuredWidth.value = Utils.roundToSignificantDigitsBinary(configuredWidth.value * delta, 8);
	}
}
/** @extends {VAbstractVisualObject<[number, number, Blob]>} */
class VImage extends VAbstractVisualObject {
	timelineElementColor = "#B00"
	/**
	 * @param {Blob} imageBlob
	 */
	constructor(imageBlob) {
		// - blob
		var image = new BlobProperty(imageBlob)
		// create!
		super([], VImage.createRender, 5)
		// data
		this.image = image
		this.aspect_ratio = 1
		this.fullyLoaded = createImageBitmap(imageBlob).then(async (bitmap) => {
			this.aspect_ratio = bitmap.width / bitmap.height
			// Wait until the object has finished rendering
			while (this.renders.get(bitmap.width, bitmap.height, this.image.value) == undefined) {
				await new Promise((resolve) => requestAnimationFrame(resolve));
			}
		})
		// rendering cache
		this.previousRender = new OffscreenCanvas(1, 1)
	}
	/** @returns {Promise<{ type: "map", value: Map<string, CustomJSONObject> }>} */
	async save() {
		return { type: "map", value: new Map([
			["type", { type: "string", value: "image" }],
			["imageBlob", await this.image.save()],
			...(await super.save()).value
		]) }
	}
	/** @returns {Blob[]} */
	getAllBlobs() {
		return [this.image.value]
	}
	/**
	 * @param {number} width
	 * @param {number} height
	 * @param {Blob} blob
	 * @returns {Promise<OffscreenCanvas>}
	 */
	static async createRender(width, height, blob) {
		var bitmap = await createImageBitmap(blob)
		// create canvas
		var canvas = new OffscreenCanvas(width, height)
		var ctx = canvas.getContext('2d')
		if (ctx == null) throw new Error("can't render image because context is null")
		// draw image
		ctx.drawImage(bitmap, 0, 0, width, height)
		// save
		bitmap.close()
		this.previousRender = canvas;
		return canvas
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 */
	getExpectedHeight(screenWidth, screenHeight) {
		return this.width.value * screenWidth / this.aspect_ratio
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {Promise<OffscreenCanvas>}
	 */
	async getVisualRepresentation(screenWidth, screenHeight) {
		var exactWidth = this.width.value * screenWidth
		var exactHeight = this.getExpectedHeight(screenWidth, screenHeight)
		var expectedWidth = Math.max(1, Math.round(exactWidth))
		var expectedHeight = Math.max(1, Math.round(exactHeight))
		var canvas = await this.renders.getAsync(expectedWidth, expectedHeight, this.image.value)
		return canvas
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {OffscreenCanvas}
	 */
	getRender(screenWidth, screenHeight) {
		var exactWidth = this.width.value * screenWidth
		var exactHeight = this.getExpectedHeight(screenWidth, screenHeight)
		var expectedWidth = Math.max(1, Math.round(exactWidth))
		var expectedHeight = Math.max(1, Math.round(exactHeight))
		var canvas = this.renders.get(expectedWidth, expectedHeight, this.image.value)
		if (canvas != undefined) return canvas
		else return this.previousRender;
	}
}
/** @extends {VAbstractVisualObject<[number, number]>} */
class VVideo extends VAbstractVisualObject {
	timelineElementColor = "#F50"
	/**
	 * @param {Blob} videoBlob
	 */
	constructor(videoBlob) {
		// - video
		var video = new BlobProperty(videoBlob)
		var time = new AutoincrementingTimeProperty(0)
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["Video Time", time]
		]
		super(properties, (expectedWidth, time) => { throw new Error("Cannot render unloaded video") }, 0)
		// data
		this.video = video
		this.aspect_ratio = 1
		this.duration = 0
		this.videoElement1 = document.createElement("video");
		this.videoElement1.src = URL.createObjectURL(videoBlob);
		this.videoElement1.load();
		/** @type {Promise<1>} */ this.videoElement1Lock = Promise.resolve(1);
		this.videoElement2 = document.createElement("video");
		this.videoElement2.src = URL.createObjectURL(videoBlob);
		this.videoElement2.load();
		/** @type {Promise<2>} */ this.videoElement2Lock = Promise.resolve(2);
		this.fullyLoaded = (async () => {
			await new Promise((resolve) => requestAnimationFrame(resolve));
			while (this.videoElement1.readyState < 2 || this.videoElement2.readyState < 2) {
				await new Promise((resolve) => requestAnimationFrame(resolve));
			}
			this.aspect_ratio = this.videoElement1.videoWidth / this.videoElement1.videoHeight
			this.duration = this.videoElement1.duration
			if (this.config.keyframes[0].time == this.config.startTime) this.config.keyframes[0].time += this.duration
			this.afterPropertiesUpdated()
		})()
		// properties
		this.time = time
		// rendering cache
		this.renders.func = this.requestRender.bind(this)
		this.previousRender = new OffscreenCanvas(1, 1)
	}
	/** @returns {Promise<{ type: "map", value: Map<string, CustomJSONObject> }>} */
	async save() {
		return { type: "map", value: new Map([
			["type", { type: "string", value: "video" }],
			["videoBlob", await this.video.save()],
			...(await super.save()).value
		]) }
	}
	afterPropertiesUpdated() {
		// Clamp object length to video length
		for (var i = 0; i < this.config.keyframes.length; i++) {
			var videoTime = this.getPropertiesAtKeyframe(i).get("Video Time")
			if (videoTime == undefined || !(videoTime instanceof AutoincrementingTimeProperty)) return console.error("video time property is missing from video object");
			if (videoTime.value == this.duration) {
				// Remove future keyframes
				if (i < this.config.keyframes.length - 1) this.config.keyframes.splice(i + 1, (this.config.keyframes.length - i) - 1)
				// Done
				return;
			}
			if (videoTime.value > this.duration) {
				// Remove future keyframes
				if (i < this.config.keyframes.length - 1) this.config.keyframes.splice(i + 1, (this.config.keyframes.length - i) - 1)
				// Update keyframe time
				this.config.keyframes[i].time += this.duration - videoTime.value
				// Done
				return;
			}
		}
	}
	/** @returns {Blob[]} */
	getAllBlobs() {
		return [this.video.value]
	}
	/**
	 * @param {number} width
	 * @param {number} aspect_ratio
	 * @param {number} time
	 * @param {HTMLVideoElement} videoElement
	 * @returns {Promise<OffscreenCanvas>}
	 */
	static async createRender(width, aspect_ratio, time, videoElement) {
		// Load image asynchronously and update the cached render when ready
		videoElement.currentTime = time
		while (videoElement.readyState < 2) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		// make width and height
		var targetWidth = Math.max(1, Math.round(width))
		var targetHeight = Math.max(1, Math.round(width / aspect_ratio))
		// create canvas
		var canvas = new OffscreenCanvas(targetWidth, targetHeight)
		var ctx = canvas.getContext('2d')
		if (ctx == null) throw new Error("can't render image because context is null")
		// draw image
		ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight)
		// save
		return canvas
	}
	/**
	 * @param {number} expectedWidth
	 * @param {number} time
	 */
	async requestRender(expectedWidth, time) {
		// Setup
		await this.fullyLoaded;
		// Choose a video element
		var videoElement = await Promise.any([this.videoElement1Lock, this.videoElement2Lock])
		/** @type {() => void} */ var finish = () => void(0)
		if (videoElement == 1) this.videoElement1Lock = new Promise((resolve) => finish = () => resolve(1))
		if (videoElement == 2) this.videoElement2Lock = new Promise((resolve) => finish = () => resolve(2))
		// Create render
		var canvas = await VVideo.createRender(expectedWidth, this.aspect_ratio, time, videoElement == 1 ? this.videoElement1 : this.videoElement2)
		// Cleanup
		finish();
		this.previousRender = canvas;
		return canvas
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 */
	getExpectedHeight(screenWidth, screenHeight) {
		return this.width.value * screenWidth / this.aspect_ratio
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {Promise<OffscreenCanvas>}
	 */
	async getVisualRepresentation(screenWidth, screenHeight) {
		var expectedWidth = Math.round(this.width.value * screenWidth)
		var canvas = await this.requestRender(expectedWidth, this.time.value)
		return canvas
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {OffscreenCanvas}
	 */
	getRender(screenWidth, screenHeight) {
		var expectedWidth = Math.round(this.width.value * screenWidth)
		var expectedHeight = Math.round(this.width.value * screenWidth / this.aspect_ratio)
		var currentTime = this.time.value
		// Find an existing canvas
		var canvas = this.renders.get(expectedWidth, currentTime)
		if (canvas != undefined) return canvas
		else {
			this.requestRender(expectedWidth, currentTime)
			return this.previousRender;
		}
	}
}
class VAudio extends VObject {
	timelineElementColor = "#E0E"
	/**
	 * @param {Blob} audioBlob
	 */
	constructor(audioBlob) {
		// - audio
		var volume = new NumericProperty(1)
		var audio = new BlobProperty(audioBlob)
		var time = new AutoincrementingTimeProperty(0)
		// create!
		/** @type {[string, ObjectProperty][]} */
		var properties = [
			["Volume", volume],
			["Audio Time", time]
		]
		super(0, new Map(properties), 0)
		// data
		this.audio = audio
		this.duration = 0
		/** @type {AudioBuffer | null} */
		this.audioBuffer = null;
		this.fullyLoaded = (async () => {
			// Construct AudioBuffer
			var arrayBuffer = await audioBlob.arrayBuffer();
			var audioContext = new OfflineAudioContext(1, 1, 44100);
			this.audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			// Set duration
			this.duration = this.audioBuffer.duration
			if (this.config.keyframes[0].time == this.config.startTime) this.config.keyframes[0].time += this.duration
			this.afterPropertiesUpdated()
		})()
		// properties
		this.volume = volume
		this.time = time
		// rendering cache
		/** @type {AsyncCacheMap<[number, number, number, AudioBuffer], OffscreenCanvas>} */
		this.renders = new AsyncCacheMap(VAudio.createRender, 5)
	}
	/** @returns {Promise<{ type: "map", value: Map<string, CustomJSONObject> }>} */
	async save() {
		return { type: "map", value: new Map([
			["type", { type: "string", value: "audio" }],
			["audioBlob", await this.audio.save()],
			...(await super.save()).value
		]) }
	}
	afterPropertiesUpdated() {
		// Clamp object length to audio length
		for (var i = 0; i < this.config.keyframes.length; i++) {
			var audioTime = this.getPropertiesAtKeyframe(i).get("Audio Time")
			if (audioTime == undefined || !(audioTime instanceof AutoincrementingTimeProperty)) return console.error("audio time property is missing from audio object");
			if (audioTime.value == this.duration) {
				// Remove future keyframes
				if (i < this.config.keyframes.length - 1) this.config.keyframes.splice(i + 1, (this.config.keyframes.length - i) - 1)
				// Done
				return;
			}
			if (audioTime.value > this.duration) {
				// Remove future keyframes
				if (i < this.config.keyframes.length - 1) this.config.keyframes.splice(i + 1, (this.config.keyframes.length - i) - 1)
				// Update keyframe time
				this.config.keyframes[i].time += this.duration - audioTime.value
				// Done
				return;
			}
		}
		// Clamp volume
		for (var i = -1; i < this.config.keyframes.length; i++) {
			var volume = (this.config.keyframes[i]?.properties ?? this.config.initialProperties).get("Volume")
			if (volume == undefined || !(volume instanceof NumericProperty)) continue;
			if (volume.value < 0) volume.value = 0
			if (volume.value > 1) volume.value = 1
		}
	}
	/** @returns {Blob[]} */
	getAllBlobs() {
		return [this.audio.value]
	}
	/**
	 * @param {number} width
	 * @param {number} volume
	 * @param {number} time
	 * @param {AudioBuffer} audioBuffer
	 * @returns {Promise<OffscreenCanvas>}
	 */
	static async createRender(width, volume, time, audioBuffer) {
		// get audio volume
		var computedVolume = await Utils.getAudioLoudness(audioBuffer, time - 0.5, time + 0.5) * volume;
		// calculate bar appearance
		var pixelSize = Math.ceil(Math.max(computedVolume * width, width / 20));
		var opacity = (computedVolume + 1) / 3
		// create canvas
		var height = Math.max(Math.floor(width / 5), 10)
		var canvas = new OffscreenCanvas(width, height)
		var ctx = canvas.getContext('2d')
		if (ctx == null) throw new Error("can't render audio because context is null")
		// draw image
		ctx.fillStyle = "white";
		ctx.globalAlpha = opacity;
		ctx.beginPath();
		ctx.roundRect((width - pixelSize) / 2, 0, pixelSize, height, Math.floor(width / 20));
		ctx.fill()
		// finish
		return canvas;
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {Promise<OffscreenCanvas>}
	 */
	async getVisualRepresentation(screenWidth, screenHeight) {
		if (this.audioBuffer != null) {
			var expectedWidth = screenWidth * 0.125
			var canvas = await this.renders.getAsync(expectedWidth, this.volume.value, this.time.value, this.audioBuffer)
			return canvas;
		} else throw new Error("Cannot getVisualRepresentation before audio is fully loaded")
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @returns {{ x: number, y: number, width: number, height: number }}
	 */
	getPixelBoundingBox(screenWidth, screenHeight) {
		return {
			x: -Infinity,
			y: -Infinity,
			width: 0,
			height: 0
		}
	}
	/**
	 * @param {number} screenWidth
	 * @param {number} screenHeight
	 * @param {CanvasRenderingContext2D} canvas
	 */
	render(screenWidth, screenHeight, canvas) {
		// no rendering needed
	}
	/**
	 * @param {number} keyframe_number
	 * @param {VideoEditorApp} app
	 * @returns {Handle<[number, number]>[]}
	 */
	getViewportHandles(keyframe_number, app) {
		return []
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
		/** @type {{ object: VObject, timelineHandles: Handle<[number]>[], viewportHandles: Handle<[number, number]>[], draggingHandle: { isTimeline: true, handle: Handle<[number]> | InvisibleTimeHandle } | { isTimeline: false, handle: Handle<[number, number]> } | null, objectEditorTab: ObjectCustomEditorTab, objectPropertiesTab: ObjectPropertiesEditorTab } | null} */
		this.selection = null;
		// undo/redo
		/** @type {{ blobs: Map<string, Blob>, data: Map<string, CustomJSONObject> }[]} */
		this.undoStack = []
		this.save().then((v) => this.undoStack.push(v))
		/** @type {{ blobs: Map<string, Blob>, data: Map<string, CustomJSONObject> }[]} */
		this.redoStack = []
		// main tab
		this.mainOptionsTab = new OptionsWindowTab("Scene", [
			Options.number("Current time:", () => this.currentTime, (v) => this.setCurrentTime(v)),
			Options.buttons([
				{ text: "Export Project", onclick: () => this.export() },
				{ text: "Import Project", onclick: () => this.requestImport() }
			]),
			Options.h("Create an object..."),
			Options.buttons([
				{ text: "Text", onclick: () => this.addFreshObject(new VText(), new Map([
					["Text", new StringProperty(prompt("Enter the text to display:", "Text") ?? (() => {
						throw new Error("Cancelled by user")
					})())]
				]), true) }
			])
		])
		this.mainOptionsTab.show()
		this.mainOptionsTab.focus()
		// timeline tracking
		this.timelinePixelsPerSecond = 100;
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
	/**
	 * @param {VObject[]} objectList
	 */
	static async getAllBlobs(objectList) {
		var blobs = objectList.flatMap((v) => v.getAllBlobs())
		/** @type {Map<string, Blob>} */
		var blobMap = new Map()
		for (var blob of blobs) {
			var hash = await Utils.hashBlob(blob)
			blobMap.set(hash, blob)
		}
		return blobMap
	}
	/** @returns {Promise<{ blobs: Map<string, Blob>, data: Map<string, CustomJSONObject> }>} */
	async save() {
		return { blobs: await VideoEditorApp.getAllBlobs(this.objects), data: new Map([
			["aspect_ratio", { type: "number", value: Math.round(this.video_aspect_ratio * 999) }],
			["objects", { type: "list", value: await Promise.all(this.objects.map((v) => v.save())) }]
		]) }
	}
	async export() {
		// Save file
		var allSaveData = await this.save();
		var mainData = CustomJSON.encode({ type: "map", value: allSaveData.data })
		// Zip
		var zip = new JSZip();
		zip.file("project.dat", mainData);
		var blobFolder = zip.folder("blobs")
		for (var blob of allSaveData.blobs) {
			blobFolder.file(blob[0], blob[1]);
		}
		zip.generateAsync({ type: "blob" }).then((blob) => {
			Utils.downloadBlob(blob, "project.zip")
		})
	}
	requestImport() {
		var e = document.createElement("input")
		e.setAttribute("type", "file")
		e.setAttribute("accept", "application/zip,.zip")
		e.click()
		e.addEventListener("input", () => {
			if (e.files == null) return;
			if (e.files.length == 0) return;
			if (e.files.length > 1) return alert("Please only select one file")
			var file = e.files[0]
			this.import(file)
		})
	}
	/**
	 * @param {ArrayBuffer | Uint8Array | Blob} zipData
	 */
	async import(zipData) {
		// Load zip file
		var zip = await JSZip.loadAsync(zipData)
		var projectData = await zip.file("project.dat").async("string")
		/** @type {Map<string, Blob>} */
		var loadedBlobs = new Map()
		for (var file of (() => {
			/** @type {ZipObject[]} */
			var blobFiles = [];
			zip.folder("blobs").forEach((path, file) => blobFiles.push(file));
			return blobFiles;
		})()) {
			var hash = file.name.split("/")[1].split(".")[0]
			var blob = await file.async("blob")
			loadedBlobs.set(hash, blob)
		}
		this.load(CustomJSON.decode(projectData), loadedBlobs)
		this.saveUndoState();
	}
	/**
	 * @param {CustomJSONObject} projectData
	 * @param {Map<string, Blob>} blobs
	 */
	load(projectData, blobs) {
		// Remove previous data
		this.setSelectedObject(null)
		this.objects = [] // garbage collection let's go
		// Load data
		if (projectData.type != "map") throw new Error("Main project data must be a map")
		{
			let aspect_ratio = projectData.value.get("aspect_ratio")
			if (aspect_ratio == undefined) throw new Error("Main project data must contain aspect ratio")
			if (aspect_ratio.type != "number") throw new Error("Aspect ratio must be a number")
			this.video_aspect_ratio = aspect_ratio.value / 999
			// Update aspect ratio
			this.element_preview.height = Math.round(Math.min(
				window.innerHeight / 2,
				(window.innerWidth * 2/3) / this.video_aspect_ratio
			))
			this.element_preview.width = Math.round(this.video_aspect_ratio * this.element_preview.height)
		}
		{
			let objects = projectData.value.get("objects")
			if (objects == undefined) throw new Error("Main project data must contain object list")
			if (objects.type != "list") throw new Error("Object list must be a list")
			for (var objectData of objects.value) {
				var constructedObject = VObject.load(objectData, blobs)
				this.objects.push(constructedObject)
			}
		}
		// Refresh everything
		this.updateTimelineTicks();
		Promise.all(this.objects.map((v) => v.fullyLoaded)).then(() => {
			this.updateAllTimelineElements(true);
		})
	}
	/**
	 * @param {VObject} object
	 * @param {Map<string, ObjectProperty>} properties
	 * @param {boolean} select
	 */
	addFreshObject(object, properties, select) {
		object.config.startTime = this.currentTime
		object.config.keyframes[0].time += this.currentTime
		for (var entry of properties) {
			var existingProperty = object.config.initialProperties.get(entry[0])
			if (existingProperty == undefined) throw new Error("Can't add object with property '" + entry[0] + "' as that property doesn't exist")
			existingProperty.setFrom(entry[1])
		}
		// Add the object!
		this.objects.push(object)
		// update everything
		this.saveUndoState();
		this.updateTimelineTicks();
		object.fullyLoaded.then(() => {
			this.updateAllTimelineElements(false);
			if (select) {
				this.setSelectedObject(object)
			}
			// add previews to timeline element
			var timelineElement = this.timelineElements.get(object);
			if (timelineElement != undefined) this.addPreviewToTimelineElement(object, timelineElement);
		})
	}
	async saveUndoState() {
		this.redoStack = []
		this.undoStack.push(await this.save())
	}
	undo() {
		if (this.undoStack.length <= 1) return;
		this.redoStack.push(this.undoStack.pop() ?? { blobs: new Map(), data: new Map() })
		var lastUndoStackItem = this.undoStack[this.undoStack.length - 1];
		this.load({ type: "map", value: lastUndoStackItem.data }, lastUndoStackItem.blobs)
	}
	redo() {
		var data = this.redoStack.pop()
		if (data == undefined) return;
		this.undoStack.push(data)
		this.load({ type: "map", value: data.data }, data.blobs)
	}
	addInsertContentEventListeners() {
		window.addEventListener("paste", ((/** @type {ClipboardEvent} */ e) => {
			if (e.clipboardData != null) {
				this.loadInsertedContent([...e.clipboardData.items]);
			}
		}).bind(this))
		document.body.addEventListener("dragover", (e) => {
			// Make body into a drop target
			e.preventDefault();
		});
		document.body.addEventListener("drop", (e) => {
			e.preventDefault();
			if (e.dataTransfer != null) {
				this.loadInsertedContent([...e.dataTransfer.items]);
			}
		});
	}
	attemptPaste() {
		navigator.clipboard.read().then(this.loadInsertedContent.bind(this))
	}
	/** @param {(ClipboardItem | DataTransferItem)[]} content */
	async loadInsertedContent(content) {
		for (var obj of content) {
			// Evaluate this content to see if it can be inserted
			if (obj instanceof ClipboardItem) {
				// If it's a ClipboardItem:
				for (var mimeType of obj.types) {
					if (mimeType.startsWith("image/")) {
						var blob = await obj.getType(mimeType)
						this.insertFile(blob, "image")
					} else if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
						var blob = await obj.getType(mimeType)
						this.insertFile(blob, "media")
					}
				}
			}
			if (obj instanceof DataTransferItem) {
				// If it's a DataTransferItem:
				if (obj.kind != "file") continue;
				if (obj.type.startsWith("image/")) {
					var file = obj.getAsFile()
					if (file != null) this.insertFile(file, "image")
				} else if (obj.type.startsWith("video/") || obj.type.startsWith("audio/")) {
					var file = obj.getAsFile()
					if (file != null) this.insertFile(file, "media")
				}
			}
		}
	}
	/**
	 * @param {Blob} blob
	 * @param {"image" | "media"} mode
	 */
	insertFile(blob, mode) {
		if (mode == "image") {
			this.addFreshObject(new VImage(blob), new Map(), true)
		} else if (mode == "media") {
			FFmpegAccessor.splitVideoOrAudioIntoStreams(blob).then((streams) => {
				for (var s of streams) {
					if (s.type == "video") {
						this.addFreshObject(new VVideo(s.data), new Map(), false);
					} else if (s.type == "audio") {
						this.addFreshObject(new VAudio(s.data), new Map(), false);
					}
				}
			});
		}
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
		var maxPixels = (maxSeconds * this.timelinePixelsPerSecond) + window.innerHeight
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
			e.setAttribute("style", `--startY: ${beginTime}; --endY: ${endTime}; --x: ${o.config.renderLayer}; --color: ${o.timelineElementColor};`);
			// Add previews
			if (refreshPreviews) {
				[...e.children].forEach((v) => v.remove())
				this.addPreviewToTimelineElement(o, e);
			}
		}
		this.updateTimelineTicks()
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

		var canvas = await object.getVisualRepresentation(this.element_preview.width, this.element_preview.height)

		void(canvas.getContext('2d')) // yeah...

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
		for (var o of [...this.objects].sort((a, b) => a.config.renderLayer - b.config.renderLayer)) {
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
		this.updateViewportHandlesExistence();
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
			// Keyframe handles
			for (var i = 0; i < object.config.keyframes.length; i++) {
				let keyframe_handle = new KeyframeTimeHandle(this, object, i);
				this.selection.timelineHandles.push(keyframe_handle);
				this.element_timeline.appendChild(keyframe_handle.element);
			}
			// Viewport handles
			this.updateViewportHandlesExistence();
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
		for (var i = -1; i < this.selection.object.config.keyframes.length; i++) {
			if (i + 1 < this.selection.timelineHandles.length) {
				this.selection.timelineHandles[i+1].updateFromObject()
			} else {
				let keyframe_handle = new KeyframeTimeHandle(this, this.selection.object, i);
				this.selection.timelineHandles.push(keyframe_handle);
				this.element_timeline.appendChild(keyframe_handle.element);
			}
		}
		while (this.selection.timelineHandles.length > this.selection.object.config.keyframes.length + 1) {
			let last_handle = this.selection.timelineHandles[this.selection.timelineHandles.length - 1]
			last_handle.element.remove()
			this.selection.timelineHandles.splice(this.selection.timelineHandles.length - 1, 1)
		}
		for (let h of this.selection.viewportHandles) {
			h.updateFromObject()
		}
	}
	/**
	 * @param {VObject} object
	 */
	getCurrentKeyframeNumberForObjectDragging(object) {
		var keyframeNumber = null;
		for (var i = -1; i < object.config.keyframes.length; i++) {
			var keyframeTime = object.config.keyframes[i]?.time ?? object.config.startTime
			if (this.currentTime == keyframeTime) {
				keyframeNumber = i;
				break;
			}
			if (this.currentTime < keyframeTime) {
				if (i == -1) break;
				// Check whether we can move 2 keyframes simultaneously
				let properties = object.config.keyframes[i].properties;
				if (! (properties.has("Center Position") || properties.has("Width"))) {
					keyframeNumber = i - 0.5;
					break;
				}
			}
		}
		return keyframeNumber;
	}
	updateViewportHandlesExistence() {
		if (this.selection == null) return;
		// Viewport Handles
		var keyframeNumber = this.getCurrentKeyframeNumberForObjectDragging(this.selection.object);
		// Remove old handles
		[...this.selection.viewportHandles].forEach((v) => v.element.remove())
		this.selection.viewportHandles = []
		// Add handles
		if (keyframeNumber != null) {
			this.selection.object.setCurrentPropertiesToCalculatedPropertiesAtTime(this.currentTime)
			this.selection.viewportHandles = [...this.selection.object.getViewportHandles(Math.floor(keyframeNumber), this)]
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
		for (var object of [...this.objects].sort((a, b) => a.config.renderLayer - b.config.renderLayer).reverse()) {
			if (! object.isVisibleAtTime(this.currentTime)) continue;
			if (Utils.pointInsideRect({ x, y }, object.getPixelBoundingBox(this.element_preview.width, this.element_preview.height))) {
				// De-select current object or select this object
				if (this.selection != null) {
					if (this.selection.object != object) this.setSelectedObject(null);
					else this.startDraggingInvisibleViewportHandleForObject(this.selection.object, { x: event.clientX, y: event.clientY });
				} else this.setSelectedObject(object);
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
		var keyframeNumber = this.getCurrentKeyframeNumberForObjectDragging(this.selection.object);
		if (keyframeNumber != null) {
			// Select viewport handle
			this.selection.draggingHandle = {
				isTimeline: false,
				handle: new InvisibleObjectMoveHandle(this, object, mousePos, object.moveBy.bind(object), Math.floor(keyframeNumber))
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
			if (handle instanceof InvisibleTimeHandle) {
				let em = parseFloat(window.getComputedStyle(this.element_timeline).fontSize)
				let targetX = (mouseX - (2*em)) / (3*em)
				handle.moveTo([targetTime, targetX])
			} else {
				handle.moveTo([targetTime])
			}
			this.updateViewportHandlesExistence()
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
		this.selection.draggingHandle.handle.onDragFinish()
		this.selection.draggingHandle.handle.element.classList.remove("active")
		this.selection.draggingHandle = null
	}
}

var app = new VideoEditorApp()
app.addInsertContentEventListeners()
app.frameLoop()
