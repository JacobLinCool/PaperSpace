import { expect, test, type Page } from '@playwright/test';

async function installWebMcpMock(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const registered: Array<{ name: string; execute: () => unknown }> = [];
		Object.defineProperty(window, '__paperspaceTools', { value: registered });
		Object.defineProperty(document, 'modelContext', {
			configurable: true,
			value: {
				registerTool: async (tool: { name: string; execute: () => unknown }) => {
					registered.push(tool);
				}
			}
		});
	});
}

function paperPdf(pageTexts: readonly string[]): Buffer {
	const fontId = 3 + pageTexts.length * 2;
	const pageIds = pageTexts.map((_, index) => 3 + index * 2);
	const objects: string[] = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`
	];
	for (const [index, text] of pageTexts.entries()) {
		const escaped = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
		const stream = `BT\n/F1 22 Tf\n72 700 Td\n(${escaped}) Tj\nET`;
		const pageId = pageIds[index]!;
		objects.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
			`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
		);
	}
	objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
	const chunks = [Buffer.from('%PDF-1.4\n')];
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(chunks.reduce((total, chunk) => total + chunk.length, 0));
		chunks.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`));
	}
	const xrefOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
	const xref = [
		'xref',
		`0 ${objects.length + 1}`,
		'0000000000 65535 f ',
		...offsets.slice(1).map((offset) => `${offset.toString().padStart(10, '0')} 00000 n `),
		'trailer',
		`<< /Size ${objects.length + 1} /Root 1 0 R >>`,
		'startxref',
		xrefOffset.toString(),
		'%%EOF',
		''
	].join('\n');
	return Buffer.concat([...chunks, Buffer.from(xref)]);
}

test('boots under the production hash-based content security policy', async ({ page }) => {
	await page.goto('/');

	const policy = await page
		.locator('meta[http-equiv="content-security-policy"]')
		.getAttribute('content');
	expect(policy).toContain("script-src 'self' 'sha256-");
	expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
	await expect(page.getByRole('main', { name: 'Spatial paper desk' })).toBeVisible();
});

test('opens a private empty reading desk with its primary controls', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveTitle('My reading desk · PaperSpace');
	await expect(page.getByLabel('PaperSpace')).toBeVisible();
	await expect(page.getByRole('main', { name: 'Spatial paper desk' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Make room for a paper.' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Import PDFs' }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Search papers' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open frame sequence' })).toBeVisible();
	await expect(page.getByLabel('Workspace status')).toContainText('0 papers · 0 pages');
});

test('automatically resets an incompatible browser-local workspace', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Make room for a paper.' })).toBeVisible();
	await page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('paperspace', 2);
			request.addEventListener('success', () => resolve(request.result), { once: true });
			request.addEventListener('error', () => reject(request.error), { once: true });
		});
		const transaction = database.transaction(['workspace', 'pdfs', 'images'], 'readwrite');
		transaction.objectStore('workspace').put({ version: 2 }, 'main');
		transaction.objectStore('pdfs').put({ id: 'legacy-pdf', data: new ArrayBuffer(8) });
		transaction.objectStore('images').put({
			id: 'legacy-image',
			data: new Blob(['legacy'], { type: 'image/png' })
		});
		await new Promise<void>((resolve, reject) => {
			transaction.addEventListener('complete', () => resolve(), { once: true });
			transaction.addEventListener('error', () => reject(transaction.error), { once: true });
		});
		database.close();
	});

	await page.reload();

	await expect(page.getByRole('heading', { name: 'Make room for a paper.' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reset local data' })).toHaveCount(0);
	await expect(page.getByLabel('Workspace status')).toContainText('0 papers · 0 pages');
	await expect(
		page.getByText('PaperSpace updated. Previous local workspace was cleared.')
	).toBeVisible();
	const counts = await page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('paperspace', 2);
			request.addEventListener('success', () => resolve(request.result), { once: true });
			request.addEventListener('error', () => reject(request.error), { once: true });
		});
		const transaction = database.transaction(['workspace', 'pdfs', 'images'], 'readonly');
		const count = (store: string) =>
			new Promise<number>((resolve, reject) => {
				const request = transaction.objectStore(store).count();
				request.addEventListener('success', () => resolve(request.result), { once: true });
				request.addEventListener('error', () => reject(request.error), { once: true });
			});
		const result = await Promise.all(['workspace', 'pdfs', 'images'].map(count));
		database.close();
		return result;
	});
	expect(counts).toEqual([0, 0, 0]);
});

test('explains WebMCP support without hiding the person-facing desk', async ({ page }) => {
	const captureReview = process.env.IMPECCABLE_SCREENSHOTS === '1';
	if (captureReview) await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	await page.getByRole('button', { name: 'WebMCP status' }).click();

	await expect(page.getByRole('heading', { name: 'WebMCP' })).toBeVisible();
	await expect(page.getByText('Prepare once, then ask')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Copy prompt' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reset local data' })).toBeVisible();
	await expect(page.getByText('inspect_workspace', { exact: true })).toBeVisible();
	await expect(page.getByRole('main', { name: 'Spatial paper desk' })).toBeVisible();
	if (captureReview) {
		await page.screenshot({ path: '.impeccable/review/webmcp-desktop.png' });
		await page.setViewportSize({ width: 390, height: 844 });
		await page.screenshot({ path: '.impeccable/review/webmcp-mobile.png' });
	}
});

test('resets browser-local desk data from the WebMCP panel', async ({ page }) => {
	await page.goto('/');
	await page.locator('input[type="file"]').setInputFiles({
		name: 'reset-me.pdf',
		mimeType: 'application/pdf',
		buffer: paperPdf(['This paper should be removed by the explicit local reset.'])
	});
	await expect(page.locator('article.paper')).toHaveCount(1);

	await page.getByRole('button', { name: 'WebMCP status' }).click();
	page.once('dialog', async (dialog) => {
		expect(dialog.type()).toBe('confirm');
		expect(dialog.message()).toContain('remove every local paper, visual, page index');
		await dialog.accept();
	});
	await page.getByRole('button', { name: 'Reset local data' }).click();

	await expect(page.getByRole('heading', { name: 'Make room for a paper.' })).toBeVisible();
	await expect(page.locator('article.paper')).toHaveCount(0);
	await expect(page.getByText('A new local workspace is ready.')).toBeVisible();
});

test('keeps the last successful PDF raster visible while resizing', async ({ page }) => {
	await page.goto('/');
	await page.locator('input[type="file"]').setInputFiles({
		name: 'stable-raster.pdf',
		mimeType: 'application/pdf',
		buffer: paperPdf(['A successful page raster must remain visible while its sheet is resized.'])
	});

	const paper = page.locator('article.paper');
	const surface = paper.locator('[data-pdf-page-surface]');
	await expect(surface).toHaveClass(/ready/);
	await expect(surface.locator('.skeleton')).toHaveCSS('opacity', '0');
	const initial = await surface.evaluate((element) => {
		const active = element.querySelector('canvas.active') as HTMLCanvasElement | null;
		return { width: active?.width ?? 0, height: active?.height ?? 0 };
	});

	await paper.click({ position: { x: 24, y: 24 } });
	const handle = page.getByRole('button', { name: 'Resize page 1' });
	const bounds = await handle.boundingBox();
	if (!bounds) throw new Error('The page resize handle is not visible.');
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2 + 120, bounds.y + bounds.height / 2, {
		steps: 8
	});

	const duringResize = await surface.evaluate((element) => {
		const active = element.querySelector('canvas.active') as HTMLCanvasElement | null;
		return {
			ready: element.classList.contains('ready'),
			canvasCount: element.querySelectorAll('canvas').length,
			activeCount: element.querySelectorAll('canvas.active').length,
			width: active?.width ?? 0,
			skeletonOpacity: getComputedStyle(element.querySelector('.skeleton')!).opacity
		};
	});
	expect(duringResize).toEqual({
		ready: true,
		canvasCount: 2,
		activeCount: 1,
		width: initial.width,
		skeletonOpacity: '0'
	});

	await page.mouse.up();
	await expect
		.poll(() =>
			surface.evaluate((element) => {
				const active = element.querySelector('canvas.active') as HTMLCanvasElement | null;
				return active?.width ?? 0;
			})
		)
		.not.toBe(initial.width);
	await expect(surface).toHaveClass(/ready/);
});

test.describe('high-density PDF cache', () => {
	test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });

	test('keeps a focused 400% page pinned at high resolution', async ({ page }) => {
		await installWebMcpMock(page);
		await page.goto('/');
		await page.locator('input[type="file"]').setInputFiles({
			name: 'focused-raster.pdf',
			mimeType: 'application/pdf',
			buffer: paperPdf(
				Array.from({ length: 15 }, (_, index) => `Attention experiment evidence page ${index + 1}`)
			)
		});
		await expect(page.getByText('Text ready')).toBeVisible({ timeout: 10_000 });

		await page.evaluate(async () => {
			const tools = (
				window as unknown as {
					__paperspaceTools: Array<{
						name: string;
						execute: (input: object) => Promise<{
							structuredContent: { papers?: Array<{ id: string }> };
						}>;
					}>;
				}
			).__paperspaceTools;
			const inspect = tools.find((tool) => tool.name === 'inspect_workspace');
			const focus = tools.find((tool) => tool.name === 'focus_region');
			if (!inspect || !focus) throw new Error('Expected workspace and focus tools.');
			const workspace = await inspect.execute({});
			const paperId = workspace.structuredContent.papers?.[0]?.id;
			if (!paperId) throw new Error('The imported paper is unavailable.');
			await focus.execute({
				paperId,
				page: 8,
				region: { x: 0.3, y: 0.3, width: 0.08, height: 0.04 }
			});
		});

		const focusedPage = page.locator('article.paper[data-page-number="8"]');
		await expect(focusedPage.locator('[data-pdf-page-surface]')).toHaveClass(/ready/);
		await expect
			.poll(
				() =>
					focusedPage.evaluate((element) => {
						const active = element.querySelector('canvas.active') as HTMLCanvasElement | null;
						return active?.width ?? 0;
					}),
				{ timeout: 500 }
			)
			.toBeGreaterThan(2000);
		expect(await page.locator('.zoom-value').textContent()).not.toBe('400%');

		await expect(page.locator('.zoom-value')).toHaveText('400%');
		await page.waitForTimeout(800);
		expect(
			await focusedPage.evaluate((element) => {
				const active = element.querySelector('canvas.active') as HTMLCanvasElement | null;
				return active?.width ?? 0;
			})
		).toBeGreaterThan(2000);
	});
});

test('registers the complete region-aware WebMCP tool surface', async ({ page }) => {
	await installWebMcpMock(page);
	await page.goto('/');

	await expect(page.getByRole('button', { name: 'WebMCP status' })).toContainText('WebMCP ready');
	const names = await page.evaluate(() =>
		(
			window as unknown as {
				__paperspaceTools: Array<{ name: string }>;
			}
		).__paperspaceTools.map((tool) => tool.name)
	);
	expect(names).toEqual([
		'inspect_workspace',
		'search_papers',
		'read_paper_pages',
		'focus_region',
		'arrange_papers',
		'snapshot_paper_region',
		'place_plot',
		'place_image',
		'present_sequence'
	]);
	const forceDefaults = await page.evaluate(() => {
		const tools = (
			window as unknown as {
				__paperspaceTools: Array<{
					name: string;
					inputSchema: { properties?: Record<string, { default?: unknown }> };
				}>;
			}
		).__paperspaceTools;
		return Object.fromEntries(
			tools
				.filter((tool) =>
					['arrange_papers', 'snapshot_paper_region', 'place_plot', 'place_image'].includes(
						tool.name
					)
				)
				.map((tool) => [tool.name, tool.inputSchema.properties?.force?.default])
		);
	});
	expect(forceDefaults).toEqual({
		arrange_papers: false,
		snapshot_paper_region: false,
		place_plot: false,
		place_image: false
	});
	const readContract = await page.evaluate(() => {
		const read = (
			window as unknown as {
				__paperspaceTools: Array<{
					name: string;
					inputSchema: {
						required?: string[];
						properties?: Record<string, { default?: unknown; maximum?: number }>;
					};
				}>;
			}
		).__paperspaceTools.find((tool) => tool.name === 'read_paper_pages');
		return {
			required: read?.inputSchema.required,
			includeBlocksDefault: read?.inputSchema.properties?.includeBlocks?.default,
			maxCharactersMaximum: read?.inputSchema.properties?.maxCharacters?.maximum
		};
	});
	expect(readContract).toEqual({
		required: ['paperId'],
		includeBlocksDefault: false,
		maxCharactersMaximum: undefined
	});
	const deliveryContract = await page.evaluate(() => {
		const tools = (
			window as unknown as {
				__paperspaceTools: Array<{ name: string; description: string }>;
			}
		).__paperspaceTools;
		return {
			inspect: tools.find((tool) => tool.name === 'inspect_workspace')?.description,
			present: tools.find((tool) => tool.name === 'present_sequence')?.description
		};
	});
	expect(deliveryContract.inspect).toContain('PaperSpace the primary surface');
	expect(deliveryContract.present).toContain('default delivery for a paper introduction');
	expect(deliveryContract.present).toContain('do not stop at a chat summary');

	const inspected = await page.evaluate(async () => {
		const [tool] = (
			window as unknown as {
				__paperspaceTools: Array<{ execute: (input: object) => Promise<unknown> }>;
			}
		).__paperspaceTools;
		return tool?.execute({});
	});
	expect(inspected).toMatchObject({
		structuredContent: {
			briefingRevision: expect.any(String),
			readiness: { status: 'empty', questionReady: false },
			agentProtocol: expect.arrayContaining([
				expect.stringContaining('Whole-paper reads are allowed'),
				expect.stringContaining('primary interaction and delivery surface'),
				expect.stringContaining('do not stop at a chat summary'),
				expect.stringContaining('simple localized Q&A'),
				expect.stringContaining('Prefer original paper-region frames')
			]),
			storage: 'Authorized browser-local copies only; original paths are unavailable',
			coordinateSystem: 'PDF regions use top-left normalized x, y, width, and height',
			papers: []
		}
	});

	await page.evaluate(async () => {
		const tools = (
			window as unknown as {
				__paperspaceTools: Array<{
					name: string;
					execute: (input: object) => Promise<{
						structuredContent: { artifact?: { id: string } };
					}>;
				}>;
			}
		).__paperspaceTools;
		const plot = tools.find((tool) => tool.name === 'place_plot');
		const present = tools.find((tool) => tool.name === 'present_sequence');
		if (!plot || !present) throw new Error('Expected WebMCP tools were not registered.');
		const placed = await plot.execute({
			title: 'Loss landscape',
			caption: 'A safe numeric visual',
			xLabel: 'lambda',
			yLabel: 'loss',
			series: [
				{
					name: 'Method A',
					points: [
						{ x: 0, y: 1.4 },
						{ x: 0.4, y: 0.8 },
						{ x: 1, y: 1.2 }
					]
				}
			],
			focus: false
		});
		const artifactId = placed.structuredContent.artifact?.id;
		if (!artifactId) throw new Error('The plot tool did not return an artifact id.');
		try {
			await plot.execute({
				title: 'Conflicting plot',
				xLabel: 'x',
				yLabel: 'y',
				series: [
					{
						name: 'Series',
						points: [
							{ x: 0, y: 0 },
							{ x: 1, y: 1 }
						]
					}
				],
				focus: false
			});
			throw new Error('Expected an unforced visual conflict.');
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes('force: true')) throw error;
		}
		await present.execute({
			title: 'Equation walkthrough',
			frames: [
				{
					kind: 'artifact',
					artifactId,
					name: 'Visual explanation',
					caption: 'The minimum occurs near lambda = 0.4.'
				}
			]
		});
	});

	await expect(page.getByLabel('Derived plot: Loss landscape')).toBeVisible();
	await expect(page.getByText('The minimum occurs near lambda = 0.4.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Keep sequence' })).toBeVisible();
	await page.getByRole('button', { name: 'Keep sequence' }).click();
	await page.getByRole('button', { name: 'Exit presentation' }).click();
	await page.getByRole('button', { name: 'Open frame sequence' }).click();
	await expect(page.getByRole('textbox', { name: 'Frame name' })).toHaveValue('Visual explanation');
});

test('indexes, focuses, and snapshots an exact region from a local PDF', async ({ page }) => {
	const captureReview = process.env.IMPECCABLE_SCREENSHOTS === '1';
	if (captureReview) await page.setViewportSize({ width: 1440, height: 900 });
	await installWebMcpMock(page);
	await page.goto('/');
	await page.locator('input[type="file"]').setInputFiles({
		name: 'region-aware-reading.pdf',
		mimeType: 'application/pdf',
		buffer: paperPdf([
			'Related work assumes a fixed retrieval set',
			'Adaptive retrieval method selects evidence dynamically',
			'Experiment results improve recall by twelve percent'
		])
	});
	await expect(page.getByText('Text ready')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('article.paper')).toHaveCount(3);
	const briefing = await page.evaluate(async () => {
		const inspect = (
			window as unknown as {
				__paperspaceTools: Array<{
					name: string;
					execute: (input: object) => Promise<{
						structuredContent: {
							readiness: { status: string; indexedPages: number };
							papers: Array<{
								id: string;
								contentBrief: { pageBriefs: Array<{ page: number; excerpt: string }> };
							}>;
						};
					}>;
				}>;
			}
		).__paperspaceTools.find((tool) => tool.name === 'inspect_workspace');
		if (!inspect) throw new Error('inspect_workspace was not registered.');
		return (await inspect.execute({})).structuredContent;
	});
	expect(briefing.readiness).toMatchObject({ status: 'ready', indexedPages: 3 });
	expect(briefing.papers[0]!.contentBrief.pageBriefs).toEqual([
		expect.objectContaining({ page: 1, excerpt: expect.stringContaining('fixed retrieval set') }),
		expect.objectContaining({ page: 2, excerpt: expect.stringContaining('Adaptive retrieval') }),
		expect.objectContaining({ page: 3, excerpt: expect.stringContaining('Experiment results') })
	]);
	const wholePaper = await page.evaluate(async (paperId) => {
		const read = (
			window as unknown as {
				__paperspaceTools: Array<{
					name: string;
					execute: (input: object) => Promise<{
						structuredContent: {
							pages: Array<{ page: number; text: string; blocks: unknown[] }>;
							coverage: { wholePaper: boolean; truncated: boolean };
						};
					}>;
				}>;
			}
		).__paperspaceTools.find((tool) => tool.name === 'read_paper_pages');
		if (!read) throw new Error('read_paper_pages was not registered.');
		return (await read.execute({ paperId })).structuredContent;
	}, briefing.papers[0]!.id);
	expect(wholePaper.pages).toEqual([
		expect.objectContaining({ page: 1, text: expect.stringContaining('fixed retrieval set') }),
		expect.objectContaining({ page: 2, text: expect.stringContaining('Adaptive retrieval') }),
		expect.objectContaining({ page: 3, text: expect.stringContaining('Experiment results') })
	]);
	expect(wholePaper.pages.every((entry) => entry.blocks.length === 0)).toBe(true);
	expect(wholePaper.coverage).toMatchObject({ wholePaper: true, truncated: false });
	await expect(page.getByRole('button', { name: 'Previous page' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Next page' })).toHaveCount(0);
	const originalPagePositions = await page
		.locator('article.paper')
		.evaluateAll((pages) =>
			Object.fromEntries(
				pages.map((entry) => [
					entry.getAttribute('data-page-number'),
					{ left: (entry as HTMLElement).style.left, top: (entry as HTMLElement).style.top }
				])
			)
		);

	const focused = await page.evaluate(async () => {
		const tools = (
			window as unknown as {
				__paperspaceTools: Array<{
					name: string;
					execute: (input: object) => Promise<{
						structuredContent: {
							artifact?: { id: string };
							matches?: Array<{
								matchId: string;
								paperId: string;
								page: number;
								region: { x: number; y: number; width: number; height: number };
							}>;
						};
					}>;
				}>;
			}
		).__paperspaceTools;
		const search = tools.find((tool) => tool.name === 'search_papers');
		const focus = tools.find((tool) => tool.name === 'focus_region');
		const snapshot = tools.find((tool) => tool.name === 'snapshot_paper_region');
		const present = tools.find((tool) => tool.name === 'present_sequence');
		if (!search || !focus || !snapshot || !present) {
			throw new Error('Region sequence tools were not registered.');
		}
		const queries = ['fixed retrieval set', 'adaptive retrieval method', 'improve recall'];
		const matches = [];
		for (const query of queries) {
			const result = await search.execute({ query });
			const match = result.structuredContent.matches?.[0];
			if (!match) throw new Error(`The local PDF text was not searchable for ${query}.`);
			matches.push(match);
		}
		await focus.execute({ matchId: matches[0]!.matchId });
		const placedSnapshot = await snapshot.execute({
			paperId: matches[1]!.paperId,
			page: matches[1]!.page,
			region: matches[1]!.region,
			title: 'Method passage',
			focus: false
		});
		const snapshotId = placedSnapshot.structuredContent.artifact?.id;
		if (!snapshotId) throw new Error('The snapshot tool did not return an artifact id.');
		await present.execute({
			title: 'Why adaptive retrieval works',
			frames: [
				{
					kind: 'paper-region',
					paperId: matches[0]!.paperId,
					page: matches[0]!.page,
					region: matches[0]!.region,
					name: 'Prior assumption',
					caption: 'Related work starts from a fixed retrieval set.'
				},
				{
					kind: 'paper-region',
					paperId: matches[1]!.paperId,
					page: matches[1]!.page,
					region: matches[1]!.region,
					name: 'Adaptive method',
					caption: 'The method selects supporting evidence dynamically.'
				},
				{
					kind: 'paper-region',
					paperId: matches[2]!.paperId,
					page: matches[2]!.page,
					region: matches[2]!.region,
					name: 'Measured result',
					caption: 'The experiment improves recall by twelve percent.'
				},
				{
					kind: 'artifact',
					artifactId: snapshotId,
					name: 'Source-linked method crop',
					caption: 'The mixed sequence can visit a visual without moving the artifact.'
				}
			]
		});
		return matches;
	});

	expect(focused.map((match) => match.page)).toEqual([1, 2, 3]);
	for (const match of focused) {
		expect(match.region.x).toBeGreaterThanOrEqual(0);
		expect(match.region.y).toBeGreaterThanOrEqual(0);
		expect(match.region.x + match.region.width).toBeLessThanOrEqual(1);
		expect(match.region.y + match.region.height).toBeLessThanOrEqual(1);
	}
	await page.waitForTimeout(40);
	await page.getByRole('main', { name: 'Spatial paper desk' }).dispatchEvent('wheel', {
		deltaX: 0,
		deltaY: 120
	});
	await page.waitForTimeout(40);
	const interruptedTransform = await page
		.locator('.world')
		.evaluate((world) => world.style.transform);
	await page.waitForTimeout(700);
	expect(await page.locator('.world').evaluate((world) => world.style.transform)).toBe(
		interruptedTransform
	);
	await expect(page.locator('.region-focus')).toHaveCount(0);
	await expect(page.locator('.source-slot')).toHaveCount(3);
	await expect(page.getByLabel('Original position of page 1')).toBeVisible();
	await expect(page.getByLabel('Source crop: Method passage')).toBeVisible();
	await expect(page.getByText('Related work starts from a fixed retrieval set.')).toBeVisible();
	await page.getByRole('button', { name: 'Next frame' }).click();
	await expect(page.getByText('The method selects supporting evidence dynamically.')).toBeVisible();
	await page.getByRole('button', { name: 'Previous frame' }).click();
	await page.getByRole('button', { name: 'Next frame' }).click();
	await page.getByRole('button', { name: 'Next frame' }).click();
	await page.getByRole('button', { name: 'Next frame' }).click();
	await expect(
		page.getByText('The mixed sequence can visit a visual without moving the artifact.')
	).toBeVisible();
	await page.getByRole('button', { name: 'Keep sequence' }).click();
	await page.getByRole('button', { name: 'Exit presentation' }).click();
	const restoredPagePositions = await page
		.locator('article.paper')
		.evaluateAll((pages) =>
			Object.fromEntries(
				pages.map((entry) => [
					entry.getAttribute('data-page-number'),
					{ left: (entry as HTMLElement).style.left, top: (entry as HTMLElement).style.top }
				])
			)
		);
	expect(restoredPagePositions).toEqual(originalPagePositions);
	await expect(page.locator('.source-slot')).toHaveCount(0);
	await page.getByRole('button', { name: 'Open frame sequence' }).click();
	await expect(page.getByRole('textbox', { name: 'Frame name' })).toHaveCount(4);
	await page.getByRole('button', { name: 'Present saved sequence' }).click();
	await expect(page.locator('.source-slot')).toHaveCount(3);
	await page.getByRole('button', { name: 'Exit presentation' }).click();

	if (captureReview) {
		await page.waitForTimeout(3_700);
		await page.getByRole('button', { name: 'Open frame sequence' }).click();
		await page.screenshot({ path: '.impeccable/review/desktop.png' });
		await page.getByRole('button', { name: 'Close frame sequence' }).click();
	}

	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(100);
	await page.getByRole('button', { name: 'Open frame sequence' }).click();
	await page.getByRole('button', { name: 'Present saved sequence' }).click();
	await page.waitForTimeout(1_650);
	const mobileTarget = await page
		.locator('article.paper[data-page-number="1"] .text-layer span')
		.filter({ hasText: 'Related work assumes a fixed retrieval set' })
		.boundingBox();
	expect(mobileTarget).not.toBeNull();
	expect(mobileTarget!.x).toBeGreaterThanOrEqual(20);
	expect(mobileTarget!.x + mobileTarget!.width).toBeLessThanOrEqual(370);
	expect(mobileTarget!.y).toBeGreaterThanOrEqual(56);
	expect(mobileTarget!.y + mobileTarget!.height).toBeLessThanOrEqual(660);
	if (captureReview) await page.screenshot({ path: '.impeccable/review/mobile.png' });
});
