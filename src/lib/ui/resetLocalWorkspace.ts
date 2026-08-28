import type { Workspace } from '$lib/workspace/workspace.svelte';

export const RESET_LOCAL_WORKSPACE_MESSAGE =
	'Reset PaperSpace and remove every local paper, visual, page index, and saved sequence from this browser? This cannot be undone.';

export async function requestLocalWorkspaceReset(workspace: Workspace): Promise<boolean> {
	if (!window.confirm(RESET_LOCAL_WORKSPACE_MESSAGE)) return false;

	try {
		await workspace.resetLocalData();
		return true;
	} catch (error) {
		workspace.showToast(
			error instanceof Error ? error.message : 'Local data could not be cleared.',
			'danger'
		);
		return false;
	}
}
