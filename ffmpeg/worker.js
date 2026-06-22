/**
 * @type {any}
 */
let ffmpeg;
const load = async (/** @type {{ coreURL: string, wasmURL: string, workerURL: string }} */ { coreURL, wasmURL, workerURL }) => {
	// when web worker type is `module`.
	const createFFmpegCore = (await import(coreURL)).default;
	if (!createFFmpegCore) {
		throw new Error("ERROR_IMPORT_FAILURE");
	}
	ffmpeg = await createFFmpegCore({
		// Fix `Overload resolution failed.` when using multi-threaded ffmpeg-core.
		// Encoded wasmURL and workerURL in the URL as a hack to fix locateFile issue.
		mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL }))}`,
	});
	ffmpeg.setLogger((/** @type {any} */ data) => self.postMessage({ type: "LOG", data }));
	ffmpeg.setProgress((/** @type {any} */ data) => self.postMessage({ type: "PROGRESS", data, }));
};
const exec = (/** @type {{ args: string[], timeout: number }} */ { args, timeout = -1 }) => {
	ffmpeg.setTimeout(timeout);
	ffmpeg.exec(...args);
	const ret = ffmpeg.ret;
	ffmpeg.reset();
	return ret;
};
const ffprobe = (/** @type {{ args: string[], timeout: number }} */ { args, timeout = -1 }) => {
	ffmpeg.setTimeout(timeout);
	ffmpeg.ffprobe(...args);
	const ret = ffmpeg.ret;
	ffmpeg.reset();
	return ret;
};
const writeFile = (/** @type {{ path: string, data: Uint8Array | string }} */ { path, data }) => {
	ffmpeg.FS.writeFile(path, data);
	return true;
};
const readFile = (/** @type {{ path: string, encoding: "utf8" | "binary" }} */ { path, encoding }) => ffmpeg.FS.readFile(path, { encoding });
// TODO: check if deletion works.
const deleteFile = (/** @type {{ path: string }} */ { path }) => {
	ffmpeg.FS.unlink(path);
	return true;
};
const rename = (/** @type {{ oldPath: string, newPath: string }} */ { oldPath, newPath }) => {
	ffmpeg.FS.rename(oldPath, newPath);
	return true;
};
// TODO: check if creation works.
const createDir = (/** @type {{ path: string }} */ { path }) => {
	ffmpeg.FS.mkdir(path);
	return true;
};
const listDir = (/** @type {{ path: string }} */ { path }) => {
	const names = ffmpeg.FS.readdir(path);
	const nodes = [];
	for (const name of names) {
		const stat = ffmpeg.FS.stat(`${path}/${name}`);
		const isDir = ffmpeg.FS.isDir(stat.mode);
		nodes.push({ name, isDir });
	}
	return nodes;
};
// TODO: check if deletion works.
const deleteDir = (/** @type {{ path: string }} */ { path }) => {
	ffmpeg.FS.rmdir(path);
	return true;
};
const mount = (/** @type {{ fsType: "IDBFS" | "MEMFS" | "NODEFS" | "NODERAWFS" | "PROXYFS" | "WORKERFS", options: { blobs: { data: Blob, name: string }[], files: File[] }, mountPoint: string }} */ { fsType, options, mountPoint }) => {
	const str = fsType;
	const fs = ffmpeg.FS.filesystems[str];
	if (!fs)
		return false;
	ffmpeg.FS.mount(fs, options, mountPoint);
	return true;
};
const unmount = (/** @type {{ mountPoint: string }} */ { mountPoint }) => {
	ffmpeg.FS.unmount(mountPoint);
	return true;
};
self.onmessage = async ({ data: { id, type, data: _data }, }) => {
	const trans = [];
	let data;
	try {
		if (type !== "LOAD" && !ffmpeg)
			throw new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
		switch (type) {
			case "LOAD":
				data = await load(_data);
				break;
			case "EXEC":
				data = exec(_data);
				break;
			case "FFPROBE":
				data = ffprobe(_data);
				break;
			case "WRITE_FILE":
				data = writeFile(_data);
				break;
			case "READ_FILE":
				data = readFile(_data);
				break;
			case "DELETE_FILE":
				data = deleteFile(_data);
				break;
			case "RENAME":
				data = rename(_data);
				break;
			case "CREATE_DIR":
				data = createDir(_data);
				break;
			case "LIST_DIR":
				data = listDir(_data);
				break;
			case "DELETE_DIR":
				data = deleteDir(_data);
				break;
			case "MOUNT":
				data = mount(_data);
				break;
			case "UNMOUNT":
				data = unmount(_data);
				break;
			default:
				throw new Error("unknown message type");
		}
	}
	catch (e) {
		self.postMessage({
			id,
			type: "ERROR",
			data: String(e),
		});
		return;
	}
	if (data instanceof Uint8Array) {
		trans.push(data.buffer);
	}
	// @ts-ignore because worker has a different postmessage
	self.postMessage({ id, type, data }, trans);
};
