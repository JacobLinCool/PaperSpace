import type { CameraState } from './types';

export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface Rect extends Point, Size {}

export interface CameraFlightKeyframe {
	offset: number;
	camera: CameraState;
}

export type CameraFlightProfile = 'standard' | 'sequence';

export interface ViewportInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export const MIN_ZOOM = 0.12;
export const MAX_ZOOM = 4;

export function clampZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(point: Point, camera: CameraState, viewport: Size): Point {
	return {
		x: camera.centerX + (point.x - viewport.width / 2) / camera.zoom,
		y: camera.centerY + (point.y - viewport.height / 2) / camera.zoom
	};
}

export function zoomAt(
	camera: CameraState,
	viewport: Size,
	anchor: Point,
	nextZoom: number
): CameraState {
	const zoom = clampZoom(nextZoom);
	const before = screenToWorld(anchor, camera, viewport);
	return {
		zoom,
		centerX: before.x - (anchor.x - viewport.width / 2) / zoom,
		centerY: before.y - (anchor.y - viewport.height / 2) / zoom
	};
}

export function boundsForRects(rects: readonly Rect[]): Rect | null {
	if (rects.length === 0) return null;
	let left = Number.POSITIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	for (const rect of rects) {
		left = Math.min(left, rect.x);
		top = Math.min(top, rect.y);
		right = Math.max(right, rect.x + rect.width);
		bottom = Math.max(bottom, rect.y + rect.height);
	}
	return { x: left, y: top, width: right - left, height: bottom - top };
}

export function fitRect(rect: Rect, viewport: Size, padding = 72): CameraState {
	const availableWidth = Math.max(1, viewport.width - padding * 2);
	const availableHeight = Math.max(1, viewport.height - padding * 2);
	const zoom = clampZoom(Math.min(availableWidth / rect.width, availableHeight / rect.height));
	return {
		centerX: rect.x + rect.width / 2,
		centerY: rect.y + rect.height / 2,
		zoom
	};
}

export function fitRectWithInsets(rect: Rect, viewport: Size, insets: ViewportInsets): CameraState {
	const availableWidth = Math.max(1, viewport.width - insets.left - insets.right);
	const availableHeight = Math.max(1, viewport.height - insets.top - insets.bottom);
	const zoom = clampZoom(Math.min(availableWidth / rect.width, availableHeight / rect.height));
	const screenCenterX = insets.left + availableWidth / 2;
	const screenCenterY = insets.top + availableHeight / 2;
	return {
		centerX: rect.x + rect.width / 2 - (screenCenterX - viewport.width / 2) / zoom,
		centerY: rect.y + rect.height / 2 - (screenCenterY - viewport.height / 2) / zoom,
		zoom
	};
}

export function cameraViewportRect(camera: CameraState, viewport: Size): Rect {
	const width = viewport.width / camera.zoom;
	const height = viewport.height / camera.zoom;
	return {
		x: camera.centerX - width / 2,
		y: camera.centerY - height / 2,
		width,
		height
	};
}

export function cameraFlightKeyframes(
	from: CameraState,
	to: CameraState,
	viewport: Size,
	target: Rect
): CameraFlightKeyframe[] {
	const journey = boundsForRects([cameraViewportRect(from, viewport), target]) ?? target;
	const overview = fitRect(journey, viewport, 84);
	const liftZoom = Math.min(from.zoom, to.zoom, overview.zoom);
	const dx = to.centerX - from.centerX;
	const dy = to.centerY - from.centerY;
	const distance = Math.hypot(dx, dy);
	let arcX = 0;
	let arcY = 0;
	if (distance > 1) {
		let normalX = -dy / distance;
		let normalY = dx / distance;
		if (normalY > 0) {
			normalX *= -1;
			normalY *= -1;
		}
		const arc = Math.min(distance * 0.08, 42 / liftZoom);
		arcX = normalX * arc;
		arcY = normalY * arc;
	}
	return [
		{ offset: 0, camera: from },
		{
			offset: 0.3,
			camera: {
				centerX: overview.centerX + arcX,
				centerY: overview.centerY + arcY,
				zoom: liftZoom
			}
		},
		{
			offset: 0.72,
			camera: { centerX: to.centerX, centerY: to.centerY, zoom: liftZoom }
		},
		{ offset: 1, camera: to }
	];
}

export function cameraFlightDuration(
	from: CameraState,
	to: CameraState,
	viewport: Size,
	profile: CameraFlightProfile = 'standard'
): number {
	const distance = Math.hypot(to.centerX - from.centerX, to.centerY - from.centerY);
	const screenDistance = distance * Math.min(from.zoom, to.zoom);
	const diagonal = Math.max(1, Math.hypot(viewport.width, viewport.height));
	if (profile === 'sequence') {
		const zoomDistance = Math.abs(Math.log(to.zoom / from.zoom));
		return Math.round(
			Math.min(1400, Math.max(720, 720 + (screenDistance / diagonal) * 380 + zoomDistance * 140))
		);
	}
	return Math.round(Math.min(1100, Math.max(560, 560 + (screenDistance / diagonal) * 360)));
}

function monotoneTangents(offsets: readonly number[], values: readonly number[]): number[] {
	const count = values.length;
	if (count <= 1) return [0];
	const spans = Array.from(
		{ length: count - 1 },
		(_, index) => offsets[index + 1]! - offsets[index]!
	);
	const slopes = spans.map((span, index) => (values[index + 1]! - values[index]!) / span);
	const tangents = Array.from({ length: count }, () => 0);
	for (let index = 1; index < count - 1; index += 1) {
		const before = slopes[index - 1]!;
		const after = slopes[index]!;
		if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) continue;
		const beforeSpan = spans[index - 1]!;
		const afterSpan = spans[index]!;
		const beforeWeight = 2 * afterSpan + beforeSpan;
		const afterWeight = afterSpan + 2 * beforeSpan;
		tangents[index] = (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
	}
	return tangents;
}

function sampleMonotone(
	offsets: readonly number[],
	values: readonly number[],
	progress: number
): number {
	if (progress <= offsets[0]!) return values[0]!;
	if (progress >= offsets[offsets.length - 1]!) return values[values.length - 1]!;
	const upperIndex = offsets.findIndex((offset) => offset >= progress);
	const lowerIndex = Math.max(0, upperIndex - 1);
	const lowerOffset = offsets[lowerIndex]!;
	const upperOffset = offsets[upperIndex]!;
	const span = upperOffset - lowerOffset;
	const t = (progress - lowerOffset) / span;
	const t2 = t * t;
	const t3 = t2 * t;
	const tangents = monotoneTangents(offsets, values);
	return (
		(2 * t3 - 3 * t2 + 1) * values[lowerIndex]! +
		(t3 - 2 * t2 + t) * span * tangents[lowerIndex]! +
		(-2 * t3 + 3 * t2) * values[upperIndex]! +
		(t3 - t2) * span * tangents[upperIndex]!
	);
}

export function sampleCameraFlight(
	keyframes: readonly CameraFlightKeyframe[],
	progress: number
): CameraState {
	const offsets = keyframes.map((frame) => frame.offset);
	const centerX = keyframes.map((frame) => frame.camera.centerX);
	const centerY = keyframes.map((frame) => frame.camera.centerY);
	const logZoom = keyframes.map((frame) => Math.log(frame.camera.zoom));
	const t = Math.max(0, Math.min(1, progress));
	return {
		centerX: sampleMonotone(offsets, centerX, t),
		centerY: sampleMonotone(offsets, centerY, t),
		zoom: Math.exp(sampleMonotone(offsets, logZoom, t))
	};
}
