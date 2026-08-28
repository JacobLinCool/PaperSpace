import { describe, expect, it } from 'vitest';
import {
	cameraFlightDuration,
	cameraFlightKeyframes,
	fitRect,
	fitRectWithInsets,
	sampleCameraFlight,
	screenToWorld,
	zoomAt
} from './camera';

describe('camera geometry', () => {
	it('keeps the world point under the pointer fixed while zooming', () => {
		const viewport = { width: 1200, height: 800 };
		const anchor = { x: 930, y: 170 };
		const camera = { centerX: 150, centerY: -40, zoom: 0.8 };
		const before = screenToWorld(anchor, camera, viewport);
		const afterCamera = zoomAt(camera, viewport, anchor, 1.6);
		expect(screenToWorld(anchor, afterCamera, viewport)).toEqual(before);
	});

	it('fits a rect inside the padded viewport', () => {
		const camera = fitRect({ x: 0, y: 0, width: 1000, height: 500 }, { width: 1200, height: 800 });
		expect(camera.centerX).toBe(500);
		expect(camera.centerY).toBe(250);
		expect(camera.zoom).toBeCloseTo(1.056);
	});

	it('builds a pull-back, travel, and landing camera path', () => {
		const from = { centerX: 0, centerY: 0, zoom: 1.4 };
		const to = { centerX: 1800, centerY: 700, zoom: 1.1 };
		const frames = cameraFlightKeyframes(
			from,
			to,
			{ width: 1200, height: 800 },
			{ x: 1700, y: 600, width: 200, height: 200 }
		);
		expect(frames.map((frame) => frame.offset)).toEqual([0, 0.3, 0.72, 1]);
		expect(frames[1]!.camera.zoom).toBeLessThan(from.zoom);
		expect(frames[2]!.camera.centerX).toBe(to.centerX);
		expect(frames[3]!.camera).toEqual(to);
	});

	it('samples one continuous flight without velocity seams at phase boundaries', () => {
		const frames = cameraFlightKeyframes(
			{ centerX: 0, centerY: 0, zoom: 1.4 },
			{ centerX: 1800, centerY: 700, zoom: 1.1 },
			{ width: 1200, height: 800 },
			{ x: 1700, y: 600, width: 200, height: 200 }
		);
		const epsilon = 0.000001;
		for (const boundary of [0.3, 0.72]) {
			const before = sampleCameraFlight(frames, boundary - epsilon);
			const at = sampleCameraFlight(frames, boundary);
			const after = sampleCameraFlight(frames, boundary + epsilon);
			for (const key of ['centerX', 'centerY', 'zoom'] as const) {
				const incoming = (at[key] - before[key]) / epsilon;
				const outgoing = (after[key] - at[key]) / epsilon;
				expect(Math.abs(incoming - outgoing)).toBeLessThan(
					Math.max(0.02, Math.abs(incoming) * 0.01, Math.abs(outgoing) * 0.01)
				);
			}
		}
		expect(sampleCameraFlight(frames, 0)).toEqual(frames[0]!.camera);
		expect(sampleCameraFlight(frames, 1)).toEqual(frames[3]!.camera);
	});

	it('keeps logarithmic zoom within the authored flight altitude range', () => {
		const frames = cameraFlightKeyframes(
			{ centerX: 0, centerY: 0, zoom: 1.8 },
			{ centerX: 1500, centerY: 500, zoom: 1.25 },
			{ width: 1200, height: 800 },
			{ x: 1400, y: 400, width: 200, height: 200 }
		);
		const authoredZooms = frames.map((frame) => frame.camera.zoom);
		const minimum = Math.min(...authoredZooms);
		const maximum = Math.max(...authoredZooms);
		for (let step = 0; step <= 100; step += 1) {
			const zoom = sampleCameraFlight(frames, step / 100).zoom;
			expect(zoom).toBeGreaterThanOrEqual(minimum);
			expect(zoom).toBeLessThanOrEqual(maximum);
		}
	});

	it('gives sequence flights a calmer distance-aware timing budget', () => {
		const from = { centerX: 0, centerY: 0, zoom: 1.4 };
		const to = { centerX: 1800, centerY: 700, zoom: 1.1 };
		const viewport = { width: 1200, height: 800 };
		const standard = cameraFlightDuration(from, to, viewport);
		const sequence = cameraFlightDuration(from, to, viewport, 'sequence');
		expect(sequence).toBeGreaterThan(standard);
		expect(sequence).toBeGreaterThanOrEqual(720);
		expect(sequence).toBeLessThanOrEqual(1400);
	});

	it('fits a mobile presentation target around bottom caption chrome without crushing width', () => {
		const camera = fitRectWithInsets(
			{ x: 100, y: 200, width: 100, height: 120 },
			{ width: 390, height: 844 },
			{ top: 68, right: 24, bottom: 184, left: 24 }
		);
		expect(camera.zoom).toBeCloseTo(3.42);
		expect(camera.centerY).toBeGreaterThan(260);
	});
});
