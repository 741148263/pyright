/*
 * server.ts
 *
 * Implements pyright language server.
 */

import { isArray } from 'util';
import { CancellationToken, CodeAction, CodeActionParams, Command, ExecuteCommandParams } from 'vscode-languageserver';

import { CommandController } from './commands/commandController';
import { convertUriToPath, getDirectoryPath, normalizeSlashes } from './common/pathUtils';
import { LanguageServerBase, ServerSettings, WorkspaceServiceInstance } from './languageServerBase';
import { CodeActionProvider } from './languageService/codeActionProvider';

class PyrightServer extends LanguageServerBase {
    private _controller: CommandController;

    constructor() {
        super('Pyright', getDirectoryPath(__dirname));

        this._controller = new CommandController(this);
    }

    async getSettings(workspace: WorkspaceServiceInstance): Promise<ServerSettings> {
        const serverSettings: ServerSettings = {};
        try {
            const pythonSection = await this.getConfiguration(workspace, 'python');
            if (pythonSection) {
                serverSettings.pythonPath = normalizeSlashes(pythonSection.pythonPath);
                serverSettings.venvPath = normalizeSlashes(pythonSection.venvPath);
            }

            const pythonAnalysisSection = await this.getConfiguration(workspace, 'python.analysis');
            if (pythonAnalysisSection) {
                const typeshedPaths = pythonAnalysisSection.typeshedPaths;
                if (typeshedPaths && isArray(typeshedPaths) && typeshedPaths.length > 0) {
                    serverSettings.typeshedPath = normalizeSlashes(typeshedPaths[0]);
                }
                serverSettings.autoSearchPaths = !!pythonAnalysisSection.autoSearchPaths;
            } else {
                serverSettings.autoSearchPaths = false;
            }

            const pyrightSection = await this.getConfiguration(workspace, 'pyright');
            if (pyrightSection) {
                serverSettings.openFilesOnly = !!pyrightSection.openFilesOnly;
                serverSettings.useLibraryCodeForTypes = !!pyrightSection.useLibraryCodeForTypes;
                serverSettings.disableLanguageServices = !!pyrightSection.disableLanguageServices;
                serverSettings.disableOrganizeImports = !!pyrightSection.disableOrganizeImports;
                serverSettings.typeCheckingMode = pyrightSection.typeCheckingMode;
            } else {
                serverSettings.openFilesOnly = true;
                serverSettings.useLibraryCodeForTypes = false;
                serverSettings.disableLanguageServices = false;
                serverSettings.disableOrganizeImports = false;
                serverSettings.typeCheckingMode = undefined;
            }
        } catch (error) {
            this.console.log(`Error reading settings: ${error}`);
        }
        return serverSettings;
    }

    protected executeCommand(params: ExecuteCommandParams, token: CancellationToken): Promise<any> {
        return this._controller.execute(params, token);
    }

    protected async executeCodeAction(
        params: CodeActionParams,
        token: CancellationToken
    ): Promise<(Command | CodeAction)[] | undefined | null> {
        this.recordUserInteractionTime();

        const filePath = convertUriToPath(params.textDocument.uri);
        const workspace = this.getWorkspaceForFile(filePath);
        return CodeActionProvider.getCodeActionsForPosition(workspace, filePath, params.range, token);
    }
}

export const server = new PyrightServer();
