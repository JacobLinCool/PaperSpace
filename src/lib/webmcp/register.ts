import type { JsonSchemaForInference } from '@mcp-b/webmcp-types';
import type { FrameTarget, PageRegion, PlotSeries } from '$lib/domain/types';
import { paperBounds } from '$lib/domain/layout';
import type { SequenceFrameInput, Workspace } from '$lib/workspace/workspace.svelte';
import { briefingRevision, paperContentBrief, workspaceReadiness } from '$lib/webmcp/briefing';

function result(data: unknown) {
	return {
		content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
		structuredContent: data
	};
}

const regionSchema = {
	type: 'object',
	properties: {
		x: { type: 'number', minimum: 0, maximum: 1 },
		y: { type: 'number', minimum: 0, maximum: 1 },
		width: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
		height: { type: 'number', exclusiveMinimum: 0, maximum: 1 }
	},
	required: ['x', 'y', 'width', 'height'],
	additionalProperties: false,
	description: 'Top-left normalized PDF page region. x + width and y + height must not exceed 1.'
} as const satisfies JsonSchemaForInference;

const forceSchema = {
	type: 'boolean',
	default: false,
	description:
		'Allow app-detected visual overlap or crowding. This bypasses only spatial presentation safeguards, never data, media, security, or target validation.'
} as const satisfies JsonSchemaForInference;

const searchSchema = {
	type: 'object',
	properties: {
		query: { type: 'string', minLength: 1, description: 'Words or an exact phrase to find.' },
		paperId: { type: 'string', description: 'Optional exact paper id.' },
		limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 }
	},
	required: ['query'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const readSchema = {
	type: 'object',
	properties: {
		paperId: { type: 'string', description: 'Exact paper id from inspect_workspace.' },
		startPage: {
			type: 'integer',
			minimum: 1,
			description: 'Optional first page. Defaults to page 1.'
		},
		endPage: {
			type: 'integer',
			minimum: 1,
			description:
				'Optional last page. Defaults to the last currently indexed page, so omitting both bounds reads the whole indexed paper in one call.'
		},
		includeBlocks: {
			type: 'boolean',
			default: false,
			description: 'Include normalized geometry for locally extracted text blocks.'
		},
		maxCharacters: {
			type: 'integer',
			minimum: 500,
			description:
				'Optional explicit text cap for this call. Omit it to return all extracted text in the requested range.'
		}
	},
	required: ['paperId'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const focusSchema = {
	type: 'object',
	properties: {
		matchId: {
			type: 'string',
			description:
				'A recent matchId from search_papers. Use this instead of explicit target fields.'
		},
		paperId: { type: 'string', description: 'Exact paper id for an explicit region target.' },
		page: { type: 'integer', minimum: 1, description: 'One-based PDF page.' },
		region: regionSchema,
		padding: {
			type: 'number',
			minimum: 0,
			maximum: 0.35,
			default: 0.06,
			description: 'Additional normalized page margin around the target.'
		}
	},
	oneOf: [
		{
			required: ['matchId'],
			not: { anyOf: [{ required: ['paperId'] }, { required: ['page'] }, { required: ['region'] }] }
		},
		{
			required: ['paperId', 'page', 'region'],
			not: { required: ['matchId'] }
		}
	],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const arrangeSchema = {
	type: 'object',
	properties: {
		layout: { type: 'string', enum: ['grid', 'row', 'columns'] },
		paperIds: {
			type: 'array',
			items: { type: 'string' },
			minItems: 1,
			description: 'Optional exact paper subset. Omit to arrange every paper.'
		},
		force: forceSchema
	},
	required: ['layout'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const snapshotSchema = {
	type: 'object',
	properties: {
		paperId: { type: 'string' },
		page: { type: 'integer', minimum: 1 },
		region: regionSchema,
		title: { type: 'string', maxLength: 80 },
		caption: { type: 'string', maxLength: 400 },
		scale: { type: 'number', minimum: 0.75, maximum: 3, default: 2 },
		focus: { type: 'boolean', default: true },
		force: forceSchema
	},
	required: ['paperId', 'page', 'region'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const plotSchema = {
	type: 'object',
	properties: {
		title: { type: 'string', minLength: 1, maxLength: 80 },
		caption: { type: 'string', maxLength: 400 },
		xLabel: { type: 'string', maxLength: 60 },
		yLabel: { type: 'string', maxLength: 60 },
		series: {
			type: 'array',
			minItems: 1,
			maxItems: 8,
			items: {
				type: 'object',
				properties: {
					name: { type: 'string', minLength: 1, maxLength: 40 },
					points: {
						type: 'array',
						minItems: 2,
						maxItems: 2000,
						items: {
							type: 'object',
							properties: { x: { type: 'number' }, y: { type: 'number' } },
							required: ['x', 'y'],
							additionalProperties: false
						}
					}
				},
				required: ['name', 'points'],
				additionalProperties: false
			}
		},
		focus: { type: 'boolean', default: true },
		force: forceSchema
	},
	required: ['title', 'series'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const imageSchema = {
	type: 'object',
	properties: {
		dataUrl: {
			type: 'string',
			minLength: 32,
			pattern: '^data:image\\/(?:png|jpeg|webp);base64,',
			description: 'Base64 data URL for a PNG, JPEG, or WebP image no larger than 5 MB.'
		},
		title: { type: 'string', minLength: 1, maxLength: 80 },
		caption: { type: 'string', maxLength: 400 },
		focus: { type: 'boolean', default: true },
		force: forceSchema
	},
	required: ['dataUrl', 'title'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

const sequenceSchema = {
	type: 'object',
	properties: {
		title: { type: 'string', maxLength: 80 },
		frames: {
			type: 'array',
			minItems: 1,
			maxItems: 20,
			items: {
				type: 'object',
				properties: {
					kind: { type: 'string', enum: ['paper-region', 'artifact'] },
					paperId: { type: 'string' },
					page: { type: 'integer', minimum: 1 },
					region: regionSchema,
					artifactId: { type: 'string' },
					name: { type: 'string', maxLength: 80 },
					caption: { type: 'string', maxLength: 400 }
				},
				required: ['kind'],
				oneOf: [
					{
						properties: { kind: { const: 'paper-region' } },
						required: ['paperId', 'page', 'region'],
						not: { required: ['artifactId'] }
					},
					{
						properties: { kind: { const: 'artifact' } },
						required: ['artifactId'],
						not: {
							anyOf: [{ required: ['paperId'] }, { required: ['page'] }, { required: ['region'] }]
						}
					}
				],
				additionalProperties: false
			}
		},
		startAt: { type: 'integer', minimum: 1, default: 1 },
		save: {
			type: 'boolean',
			default: false,
			description: 'Persist as the saved sequence. Temporary sequences can be kept by the person.'
		}
	},
	required: ['frames'],
	additionalProperties: false
} as const satisfies JsonSchemaForInference;

function paperSummary(workspace: Workspace) {
	return workspace.papers.map((paper) => ({
		id: paper.id,
		title: paper.title,
		author: paper.author,
		filename: paper.filename,
		pageCount: paper.pageCount,
		bounds: (() => {
			const bounds = paperBounds(paper);
			return bounds
				? {
						x: Math.round(bounds.x),
						y: Math.round(bounds.y),
						width: Math.round(bounds.width),
						height: Math.round(bounds.height)
					}
				: null;
		})(),
		pages: [...paper.pages]
			.sort((a, b) => a.pageNumber - b.pageNumber)
			.map((page) => {
				const origin = workspace.sequencePageOrigins.find(
					(entry) => entry.paperId === paper.id && entry.page === page.pageNumber
				);
				return {
					page: page.pageNumber,
					position: { x: Math.round(page.x), y: Math.round(page.y) },
					size: { width: Math.round(page.width), height: Math.round(page.height) },
					staged: Boolean(origin),
					sourceSlot: origin ? { x: Math.round(origin.x), y: Math.round(origin.y) } : undefined
				};
			}),
		textIndex: {
			status: paper.indexStatus,
			indexedPages: paper.indexedPages,
			pageCount: paper.pageCount,
			geometry: paper.indexStatus === 'ready' ? 'top-left normalized regions' : 'unavailable'
		},
		contentBrief: paperContentBrief(paper)
	}));
}

function artifactSummary(workspace: Workspace) {
	return workspace.artifacts.map((artifact) => ({
		id: artifact.id,
		kind: artifact.kind,
		title: artifact.title,
		caption: artifact.caption,
		position: { x: Math.round(artifact.x), y: Math.round(artifact.y) },
		size: { width: Math.round(artifact.width), height: Math.round(artifact.height) },
		source: artifact.kind === 'snapshot' ? artifact.source : undefined
	}));
}

function sequenceFrame(input: {
	kind: 'paper-region' | 'artifact';
	paperId?: string;
	page?: number;
	region?: PageRegion;
	artifactId?: string;
	name?: string;
	caption?: string;
}): SequenceFrameInput {
	let target: FrameTarget;
	if (input.kind === 'paper-region') {
		if (!input.paperId || input.page === undefined || !input.region) {
			throw new Error('A paper-region frame requires paperId, page, and region.');
		}
		target = {
			kind: 'paper-region',
			paperId: input.paperId,
			page: input.page,
			region: input.region
		};
	} else {
		if (!input.artifactId) throw new Error('An artifact frame requires artifactId.');
		target = { kind: 'artifact', artifactId: input.artifactId };
	}
	return { name: input.name, caption: input.caption, target };
}

export async function registerWebMcp(workspace: Workspace): Promise<() => void> {
	if (!('modelContext' in document) || !document.modelContext) {
		workspace.webMcpStatus = 'unavailable';
		return () => {};
	}

	const controller = new AbortController();
	try {
		await document.modelContext.registerTool(
			{
				name: 'inspect_workspace',
				title: 'Inspect the PaperSpace desk',
				description:
					'Call once when a session starts, or again only when briefingRevision changes. Returns progressive indexing readiness, compact sampled page briefs, source cues, unfolded geometry, visuals, sequences, and camera state. Reuse this briefing and batch later paper reads into one broad range instead of repeated small calls. Local filesystem paths are never exposed.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false },
				annotations: { readOnlyHint: true, untrustedContentHint: true },
				execute: () =>
					result({
						workspace: workspace.state.name,
						briefingRevision: briefingRevision(workspace.state),
						readiness: workspaceReadiness(workspace.papers, workspace.importingCount),
						agentProtocol: [
							'Reuse this compact briefing while briefingRevision is unchanged.',
							'When paper text is needed, read the broadest useful range once. Whole-paper reads are allowed; do not split one intended read into repeated page batches.',
							'Use search_papers when only a specific passage or focusable source region is needed.',
							'Visual mutations preflight layout conflicts. Retry with force: true only when covering or crowding source material is intentional.'
						],
						storage: 'Authorized browser-local copies only; original paths are unavailable',
						coordinateSystem: 'PDF regions use top-left normalized x, y, width, and height',
						papers: paperSummary(workspace),
						artifacts: artifactSummary(workspace),
						camera: {
							centerX: Math.round(workspace.camera.centerX),
							centerY: Math.round(workspace.camera.centerY),
							zoom: Number(workspace.camera.zoom.toFixed(3))
						},
						savedSequence: {
							title: workspace.state.sequenceName,
							frames: workspace.frames.map((frame, index) => ({
								id: frame.id,
								frameNumber: index + 1,
								name: frame.name,
								caption: frame.caption,
								target: frame.target
							}))
						},
						activeSequence:
							workspace.presentingIndex === null
								? null
								: {
										frameNumber: workspace.presentingIndex + 1,
										frameCount: workspace.presentationFrames.length,
										organizedPages: workspace.organizedSequencePages
									}
					})
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'search_papers',
				title: 'Search paper text with geometry',
				description:
					'Search every PDF page indexed so far without waiting for the complete paper. Results include matchId, page, quote, text blocks, and a normalized region that focus_region can show precisely.',
				inputSchema: searchSchema,
				annotations: { readOnlyHint: true, untrustedContentHint: true },
				execute: ({ query, paperId, limit }) => {
					const matches = workspace.search(query, limit ?? 8, paperId);
					const searchedPapers = paperId
						? workspace.papers.filter((paper) => paper.id === paperId)
						: workspace.papers;
					const readiness = workspaceReadiness(searchedPapers, workspace.importingCount);
					return result({
						query,
						matches,
						coverage: {
							indexedPages: readiness.indexedPages,
							totalPages: readiness.totalPages,
							complete: readiness.status === 'ready'
						}
					});
				}
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'read_paper_pages',
				title: 'Read local paper pages',
				description:
					'Read one contiguous range from a local paper in a single call. Omit page bounds to return every currently indexed page, including the whole paper once indexing is complete. Normalized text-block geometry is opt-in for precise visual navigation.',
				inputSchema: readSchema,
				annotations: { readOnlyHint: true, untrustedContentHint: true },
				execute: ({ paperId, startPage, endPage, includeBlocks, maxCharacters }) =>
					result({
						paperId,
						...workspace.readPaperPages(
							paperId,
							startPage,
							endPage,
							includeBlocks ?? false,
							maxCharacters
						)
					})
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'focus_region',
				title: 'Focus a precise paper region',
				description:
					'Fly the shared browser view through spatial context to a recent search match or an explicit normalized region on a live PDF page, ensuring the target stays inside the viewport without drawing a focus box.',
				inputSchema: focusSchema,
				annotations: { readOnlyHint: false, untrustedContentHint: false },
				execute: ({ matchId, paperId, page, region, padding }) => {
					if (matchId) {
						const match = workspace.focusMatch(matchId, padding ?? 0.06, 'agent');
						return result({
							focused: { matchId, paperId: match.paperId, page: match.page, region: match.region }
						});
					}
					if (!paperId || page === undefined || !region) {
						throw new Error('Provide matchId, or provide paperId, page, and region.');
					}
					workspace.focusRegion(paperId, page, region, padding ?? 0.06, 'agent');
					return result({ focused: { paperId, page, region } });
				}
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'arrange_papers',
				title: 'Arrange papers on the desk',
				description:
					'Reflow every page in each selected paper into reading-order grids, then lay out the unfolded paper groups as a grid, row, or columns. The app rejects layouts that crowd stationary papers or visuals unless force is true.',
				inputSchema: arrangeSchema,
				annotations: { readOnlyHint: false, untrustedContentHint: false },
				execute: ({ layout, paperIds, force }) => {
					const mutation = workspace.arrange(layout, paperIds, 'agent', force ?? false);
					return result({
						layout,
						arranged: mutation.value.map((paper) => ({
							id: paper.id,
							title: paper.title
						})),
						forced: mutation.forced,
						visualConflicts: mutation.conflicts
					});
				}
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'snapshot_paper_region',
				title: 'Place a paper region snapshot',
				description:
					'Rasterize an exact source region only when a persistent crop or side-by-side comparison is useful. Prefer focus_region or a paper-region sequence frame for ordinary navigation. The app rejects visual overlap or crowding unless force is true.',
				inputSchema: snapshotSchema,
				annotations: { readOnlyHint: false, untrustedContentHint: true },
				execute: async ({ paperId, page, region, title, caption, scale, focus, force }) => {
					const mutation = await workspace.snapshotRegion(
						paperId,
						page,
						region,
						title,
						caption ?? '',
						scale ?? 2,
						force ?? false
					);
					const artifact = mutation.value;
					if (focus !== false) workspace.focusArtifact(artifact.id, 'agent');
					return result({
						artifact: artifactSummary(workspace).find((entry) => entry.id === artifact.id),
						forced: mutation.forced,
						visualConflicts: mutation.conflicts
					});
				}
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'place_plot',
				title: 'Place a derived plot',
				description:
					'Create a safe declarative line plot only for semantically ordered numeric x values. Never invent numeric positions to connect categories, symbolic complexity classes, or table rows. Prefer an adequate source figure or table already identified in the compact briefing. The app rejects visual overlap or crowding unless force is true.',
				inputSchema: plotSchema,
				annotations: { readOnlyHint: false, untrustedContentHint: false },
				execute: ({ title, caption, xLabel, yLabel, series, focus, force }) => {
					const mutation = workspace.placePlot(
						title,
						caption ?? '',
						xLabel ?? '',
						yLabel ?? '',
						series as PlotSeries[],
						force ?? false
					);
					const artifact = mutation.value;
					if (focus !== false) workspace.focusArtifact(artifact.id, 'agent');
					return result({
						artifact: artifactSummary(workspace).find((entry) => entry.id === artifact.id),
						forced: mutation.forced,
						visualConflicts: mutation.conflicts
					});
				}
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'place_image',
				title: 'Place a validated raster image',
				description:
					'Place a generated PNG, JPEG, or WebP only when it resolves a comprehension gap not already answered by the source. Essential labels, legend mappings, and annotations must be visible inside the image; the caption is supplementary. The app rejects visual overlap or crowding unless force is true. Arbitrary HTML and SVG are rejected.',
				inputSchema: imageSchema,
				annotations: { readOnlyHint: false, untrustedContentHint: false },
				execute: async ({ dataUrl, title, caption, focus, force }) => {
					const mutation = await workspace.placeImage(
						dataUrl,
						title,
						caption ?? '',
						force ?? false
					);
					const artifact = mutation.value;
					if (focus !== false) workspace.focusArtifact(artifact.id, 'agent');
					return result({
						artifact: artifactSummary(workspace).find((entry) => entry.id === artifact.id),
						forced: mutation.forced,
						visualConflicts: mutation.conflicts
					});
				}
			},
			{ signal: controller.signal }
		);

		await document.modelContext.registerTool(
			{
				name: 'present_sequence',
				title: 'Present a guided reading sequence',
				description:
					'Atomically present 1 to 20 semantic views. Lead with original paper-region evidence and add derived artifacts only when they resolve a stated comprehension gap. Related original PDF pages are temporarily gathered in first-appearance order, while source slots preserve their place in the paper. Each view may carry a caption. Sequences are temporary by default and can be kept by the person.',
				inputSchema: sequenceSchema,
				annotations: { readOnlyHint: false, untrustedContentHint: true },
				execute: ({ title, frames, startAt, save }) => {
					const created = workspace.presentSequence(
						title ?? 'Guided reading',
						frames.map(sequenceFrame),
						startAt ?? 1,
						save ?? false,
						'agent'
					);
					return result({
						title: title ?? 'Guided reading',
						frameCount: created.length,
						startAt: startAt ?? 1,
						saved: save ?? false,
						organizedPages: workspace.organizedSequencePages
					});
				}
			},
			{ signal: controller.signal }
		);

		workspace.webMcpStatus = 'ready';
		return () => controller.abort();
	} catch (error) {
		controller.abort();
		workspace.webMcpStatus = 'failed';
		console.error('[WebMCP] tool registration failed', error);
		return () => {};
	}
}
