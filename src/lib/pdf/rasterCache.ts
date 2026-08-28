export const HIGH_RESOLUTION_PIXEL_BUDGET = 48_000_000;
export const PAGE_PREVIEW_WIDTH = 288;

interface ResidentRaster {
	pixels: number;
	onEvict: () => void;
	pinned: boolean;
}

export class RasterResidency {
	readonly maxPixels: number;
	#entries = new Map<string, ResidentRaster>();
	#residentPixels = 0;

	constructor(maxPixels = HIGH_RESOLUTION_PIXEL_BUDGET) {
		if (!Number.isFinite(maxPixels) || maxPixels <= 0) {
			throw new Error('The raster residency budget must be a positive number of pixels.');
		}
		this.maxPixels = maxPixels;
	}

	get residentPixels(): number {
		return this.#residentPixels;
	}

	get size(): number {
		return this.#entries.size;
	}

	retain(key: string, pixels: number, onEvict: () => void, pinned = false): void {
		if (!Number.isFinite(pixels) || pixels <= 0) {
			throw new Error('A resident raster must occupy a positive number of pixels.');
		}
		this.release(key);
		this.#entries.set(key, { pixels, onEvict, pinned });
		this.#residentPixels += pixels;
		this.#trim();
	}

	setPinned(key: string, pinned: boolean): void {
		const entry = this.#entries.get(key);
		if (!entry || entry.pinned === pinned) return;
		entry.pinned = pinned;
		if (pinned) this.touch(key);
		else this.#trim();
	}

	touch(key: string): void {
		const entry = this.#entries.get(key);
		if (!entry) return;
		this.#entries.delete(key);
		this.#entries.set(key, entry);
	}

	release(key: string, owner?: () => void): void {
		const entry = this.#entries.get(key);
		if (!entry || (owner && entry.onEvict !== owner)) return;
		this.#entries.delete(key);
		this.#residentPixels -= entry.pixels;
	}

	#trim(): void {
		while (this.#residentPixels > this.maxPixels) {
			const oldest = [...this.#entries.entries()].find(([, entry]) => !entry.pinned);
			if (!oldest) return;
			const [key, entry] = oldest;
			this.#entries.delete(key);
			this.#residentPixels -= entry.pixels;
			entry.onEvict();
		}
	}
}

export const pdfRasterResidency = new RasterResidency();

const previews = new Map<string, ImageBitmap>();

export function pagePreview(key: string): ImageBitmap | undefined {
	return previews.get(key);
}

export async function replacePagePreview(
	key: string,
	source: HTMLCanvasElement
): Promise<ImageBitmap> {
	const width = Math.min(PAGE_PREVIEW_WIDTH, source.width);
	const height = Math.max(1, Math.round((source.height / source.width) * width));
	const preview = await createImageBitmap(source, 0, 0, source.width, source.height, {
		resizeWidth: width,
		resizeHeight: height,
		resizeQuality: 'medium'
	});
	previews.get(key)?.close();
	previews.set(key, preview);
	return preview;
}

export function discardPagePreview(key: string): void {
	previews.get(key)?.close();
	previews.delete(key);
}
