/**
 * @typedef {{ message: string, type: string }} LogEvent
 * @typedef {{ message: number, time: number }} FFMpegProgressEvent
 */

/**
 * Provides APIs to interact with ffmpeg web worker.
 *
 * @example
 * ```ts
 * const ffmpeg = new FFmpeg();
 * ```
 */
class FFmpeg {
	static MIME_TYPE_JAVASCRIPT = "text/javascript";
	static MIME_TYPE_WASM = "application/wasm";
	static CORE_VERSION = "0.12.9";
	static CORE_URL = new URL(`/ffmpeg/core.js`, location.href).href;
	static WASM_URL = `https://unpkg.com/@ffmpeg/core@${FFmpeg.CORE_VERSION}/dist/umd/ffmpeg-core.wasm`;

	static ERROR_NOT_LOADED = new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
	static ERROR_TERMINATED = new Error("called FFmpeg.terminate()");

	static create() {
		var f = new FFmpeg()
		f.load(new URL("/ffmpeg/worker.js", location.href), {
			coreURL: FFmpeg.CORE_URL,
			wasmURL: FFmpeg.WASM_URL,
			workerURL: new URL("/ffmpeg/worker.js", location.href).href
		})
		return f;
	}

	/**
	 * Generate an unique message ID.
	 */
	static getMessageID = (() => {
		let messageID = 0;
		return () => messageID++;
	})();

	/** @type {Worker | null} */
	#worker = null;
	/**
	 * #resolves and #rejects tracks Promise resolves and rejects to
	 * be called when we receive message from web worker.
	 * @type {Object<number | string, (data: any) => void>}
	 */
	#resolves = {};
	/** @type {Object<number | string, (data: any) => void>} */
	#rejects = {};
	/** @type {((event: LogEvent) => void)[]} */
	#logEventCallbacks = [];
	/** @type {((event: FFMpegProgressEvent) => void)[]} */
	#progressEventCallbacks = [];
	loaded = false;
	/**
	 * register worker message event handlers.
	 */
	#registerHandlers = () => {
		if (this.#worker) {
			this.#worker.onmessage = ({ data: { id, type, data }, }) => {
				switch (type) {
					case "LOAD":
						this.loaded = true;
						this.#resolves[id](data);
						break;
					case "MOUNT":
					case "UNMOUNT":
					case "EXEC":
					case "FFPROBE":
					case "WRITE_FILE":
					case "READ_FILE":
					case "DELETE_FILE":
					case "RENAME":
					case "CREATE_DIR":
					case "LIST_DIR":
					case "DELETE_DIR":
						this.#resolves[id](data);
						break;
					case "LOG":
						this.#logEventCallbacks.forEach((f) => f(data));
						break;
					case "PROGRESS":
						this.#progressEventCallbacks.forEach((f) => f(data));
						break;
					case "ERROR":
						this.#rejects[id](data);
						break;
				}
				delete this.#resolves[id];
				delete this.#rejects[id];
			};
		}
	};
	/**
	 * Generic function to send messages to web worker.
	 */
	#send = (
		/** @type {string} */ type,
		/** @type {any} */ data,
		/** @type {Transferable[]} */ trans = [],
		/** @type {AbortSignal | undefined} */ signal = undefined
	) => {
		if (!this.#worker) {
			return Promise.reject(FFmpeg.ERROR_NOT_LOADED);
		}
		return new Promise((resolve, reject) => {
			const id = FFmpeg.getMessageID();
			this.#worker && this.#worker.postMessage({ id, type, data }, trans);
			this.#resolves[id] = resolve;
			this.#rejects[id] = reject;
			signal?.addEventListener("abort", () => {
				reject(new DOMException(`Message # ${id} was aborted`, "AbortError"));
			}, { once: true });
		});
	};
	/**
	 * @param {"log"} event
	 * @param {(event: LogEvent) => void} callback
	 */
	on(event, callback) {
		if (event === "log") {
			this.#logEventCallbacks.push(callback);
		}
		// else if (event === "progress") {
		// 	this.#progressEventCallbacks.push(callback);
		// }
	}
	/**
	 * @param {"log"} event
	 * @param {(event: LogEvent) => void} callback
	 */
	off(event, callback) {
		if (event === "log") {
			this.#logEventCallbacks = this.#logEventCallbacks.filter((f) => f !== callback);
		}
		// else if (event === "progress") {
		// 	this.#progressEventCallbacks = this.#progressEventCallbacks.filter((f) => f !== callback);
		// }
	}
	/**
	 * Loads ffmpeg-core inside web worker. It is required to call this method first
	 * as it initializes WebAssembly and other essential variables.
	 *
	 * @category FFmpeg
	 *
	 * @returns {Promise<void>}
	 */
	load = (/** @type {string | URL} */ classWorkerURL, /** @type {{ coreURL: string, wasmURL: string, workerURL: string }} */ config, /** @type {AbortSignal | undefined} */ signal = undefined) => {
		if (!this.#worker) {
			this.#worker = new Worker(new URL(classWorkerURL), { type: "module" });
			this.#registerHandlers();
		}
		return this.#send("LOAD", config, undefined, signal);
	};
	/**
	 * Execute ffmpeg command.
	 *
	 * @remarks
	 * To avoid common I/O issues, ["-nostdin", "-y"] are prepended to the args
	 * by default.
	 *
	 * @example
	 * ```ts
	 * const ffmpeg = new FFmpeg();
	 * await ffmpeg.load();
	 * await ffmpeg.writeFile("video.avi", ...);
	 * // ffmpeg -i video.avi video.mp4
	 * await ffmpeg.exec(["-i", "video.avi", "video.mp4"]);
	 * const data = ffmpeg.readFile("video.mp4");
	 * ```
	 *
	 * @returns {Promise<number>} `0` if no error, `!= 0` if timeout (1) or error.
	 * @category FFmpeg
	 */
	exec = (
		/** @type {string[]} */ args,
		/**
		 * milliseconds to wait before stopping the command execution.
		 *
		 * @defaultValue -1
		 */
		timeout = -1,
		/** @type {AbortSignal | undefined} */ signal = undefined
	) => this.#send("EXEC", { args, timeout }, undefined, signal);
	/**
	 * Execute ffprobe command.
	 *
	 * @example
	 * ```ts
	 * const ffmpeg = new FFmpeg();
	 * await ffmpeg.load();
	 * await ffmpeg.writeFile("video.avi", ...);
	 * // Getting duration of a video in seconds: ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video.avi -o output.txt
	 * await ffmpeg.ffprobe(["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "video.avi", "-o", "output.txt"]);
	 * const data = ffmpeg.readFile("output.txt");
	 * ```
	 *
	 * @returns {Promise<number>} `0` if no error, `!= 0` if timeout (1) or error.
	 * @category FFmpeg
	 */
	ffprobe = (
		/** ffprobe command line args */
		/** @type {string[]} */ args,
		/**
		 * milliseconds to wait before stopping the command execution.
		 *
		 * @defaultValue -1
		 */
		timeout = -1,
		/** @type {AbortSignal | undefined} */ signal = undefined
	) => this.#send("FFPROBE", { args, timeout }, undefined, signal);
	/**
	 * Terminate all ongoing API calls and terminate web worker.
	 * `FFmpeg.load()` must be called again before calling any other APIs.
	 *
	 * @category FFmpeg
	 */
	terminate = () => {
		const ids = Object.keys(this.#rejects);
		// rejects all incomplete Promises.
		for (const id of ids) {
			this.#rejects[id](FFmpeg.ERROR_TERMINATED);
			delete this.#rejects[id];
			delete this.#resolves[id];
		}
		if (this.#worker) {
			this.#worker.terminate();
			this.#worker = null;
			this.loaded = false;
		}
	};
	/**
	 * Write data to ffmpeg.wasm.
	 *
	 * @example
	 * ```ts
	 * const ffmpeg = new FFmpeg();
	 * await ffmpeg.load();
	 * await ffmpeg.writeFile("video.avi", await fetchFile("../video.avi"));
	 * await ffmpeg.writeFile("text.txt", "hello world");
	 * ```
	 *
	 * @category File System
	 */
	writeFile = (/** @type {string} */ path, /** @type {Uint8Array | string} */ data, /** @type {AbortSignal | undefined} */ signal = undefined) => {
		const trans = [];
		if (data instanceof Uint8Array) {
			trans.push(data.buffer);
		}
		return this.#send("WRITE_FILE", { path, data }, trans, signal);
	};
	mount = (/** @type {"IDBFS" | "MEMFS" | "NODEFS" | "NODERAWFS" | "PROXYFS" | "WORKERFS"} */ fsType, /** @type {{ blobs: { data: Blob, name: string }[], files: File[] }} */ options, /** @type {string} */ mountPoint) => {
		return this.#send("MOUNT", { fsType, options, mountPoint }, []);
	};
	unmount = (/** @type {string} */ mountPoint) => {
		return this.#send("UNMOUNT", { mountPoint }, []);
	};
	/**
	 * Read data from ffmpeg.wasm.
	 *
	 * @example
	 * ```ts
	 * const ffmpeg = new FFmpeg();
	 * await ffmpeg.load();
	 * const data = await ffmpeg.readFile("video.mp4");
	 * ```
	 *
	 * @category File System
	 *
	 * @returns {Promise<Uint8Array<?>>}
	 */
	readFile = (/** @type {string} */ path,
		/**
		 * File content encoding, supports two encodings:
		 * - utf8: read file as text file, return data in string type.
		 * - binary: read file as binary file, return data in Uint8Array type.
		 *
		 * @defaultValue binary
		 * @type {"utf8" | "binary"}
		 */
		encoding = "binary",
		/** @type {AbortSignal | undefined} */
		signal = undefined
	) => this.#send("READ_FILE", { path, encoding }, undefined, signal);
	/**
	 * Delete a file.
	 *
	 * @category File System
	 */
	deleteFile = (
		/** @type {string} */
		path,
		/** @type {AbortSignal | undefined} */
		signal = undefined
	) => this.#send("DELETE_FILE", { path }, undefined, signal);
	/**
	 * Rename a file or directory.
	 *
	 * @category File System
	 *
	 * @returns {Promise<true>}
	 */
	rename = (
		/** @type {string} */ oldPath, /** @type {string} */ newPath, /** @type {AbortSignal | undefined} */ signal = undefined
	) => this.#send("RENAME", { oldPath, newPath }, undefined, signal);
	/**
	 * Create a directory.
	 *
	 * @category File System
	 */
	createDir = (
		/** @type {string} */
		path,
		/** @type {AbortSignal | undefined} */
		signal = undefined
	) => this.#send("CREATE_DIR", { path }, undefined, signal);
	/**
	 * List directory contents.
	 *
	 * @category File System
	 */
	listDir = (
		/** @type {string} */
		path,
		/** @type {AbortSignal | undefined} */
		signal = undefined
	) => this.#send("LIST_DIR", { path }, undefined, signal);
	/**
	 * Delete an empty directory.
	 *
	 * @category File System
	 */
	deleteDir = (
		/** @type {string} */
		path,
		/** @type {AbortSignal | undefined} */
		signal = undefined
	) => this.#send("DELETE_DIR", { path }, undefined, signal);
}
