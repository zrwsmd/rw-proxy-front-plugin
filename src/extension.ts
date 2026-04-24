import * as vscode from 'vscode';
import { RwProxySidebarProvider } from './panel/RwProxySidebarProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RwProxySidebarProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(RwProxySidebarProvider.viewType, provider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('rwProxy.focusPanel', async () => {
      await vscode.commands.executeCommand('rwProxy.sidebar.focus');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('rwProxy.clearChat', async () => {
      await provider.clearChat();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('rwProxy.disconnect', async () => {
      await provider.disconnect();
    }),
  );
}

export function deactivate(): void {
  // Nothing to dispose beyond registered subscriptions.
}
