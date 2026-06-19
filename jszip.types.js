/**
 * @typedef {{ name: string, dir: boolean, async: ((type: "base64" | "string") => Promise<string>) & ((type: "uint8array") => Promise<Uint8Array>) & ((type: "arraybuffer") => Promise<ArrayBuffer>) & ((type: "blob") => Promise<Blob>) }} ZipObject
 */
class JSZip {
	constructor() {
		/**
		 * @type {((name: string, data: string | ArrayBuffer | Uint8Array | Blob) => void) & ((name: string) => ZipObject)}
		 */
		// @ts-ignore
		this.file = (name, data) => {
			throw new Error()
		}
	}
	/**
	 * @param {{ type: "blob" }} options
	 * @returns {Promise<Blob>}
	 */
	generateAsync(options) {
		throw new Error()
	}
}
