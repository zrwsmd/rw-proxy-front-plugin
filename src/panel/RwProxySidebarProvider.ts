import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { getWebviewHtml } from './getWebviewHtml';

type ConnectionStatus = 'disconnected' | 'loading' | 'connected' | 'error';

interface WebviewInboundMessage {
  type: string;
  apiKey?: string;
  serviceUrl?: string;
  model?: string;
  prompt?: string;
  requestId?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

interface RecentTaskRecord {
  id: string;
  title: string;
  prompt: string;
  model: string;
  createdAt: string;
}

interface ModelOption {
  id: string;
  label: string;
  badge?: string;
  subtitle?: string;
}

const API_KEY_SECRET = 'rwProxy.apiKey';
const SERVICE_URL_STATE_KEY = 'rwProxy.serviceUrl';
const SELECTED_MODEL_STATE_KEY = 'rwProxy.selectedModel';
const RECENT_TASKS_STATE_KEY = 'rwProxy.recentTasks';
const MAX_RECENT_TASKS = 8;

export class RwProxySidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rwProxy.sidebar';

  private view?: vscode.WebviewView;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private connectionError = '';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.getNonce());
    webviewView.webview.onDidReceiveMessage((message: WebviewInboundMessage) => {
      void this.handleMessage(message);
    });
    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
    void this.pushBootstrapState();
  }

  public async clearChat(): Promise<void> {
    this.postMessage({ type: 'clear_chat' });
  }

  public async disconnect(): Promise<void> {
    await this.context.secrets.delete(API_KEY_SECRET);
    await this.context.globalState.update(SELECTED_MODEL_STATE_KEY, undefined);
    this.connectionStatus = 'disconnected';
    this.connectionError = '';
    this.postConnectionState([], '', this.getServiceUrl());
  }

  private async handleMessage(message: WebviewInboundMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.pushBootstrapState();
        break;
      case 'save_connection':
        await this.saveConnection(message.apiKey || '', message.serviceUrl || '');
        break;
      case 'refresh_connection':
        await this.refreshConnection();
        break;
      case 'disconnect':
        await this.disconnect();
        break;
      case 'visit_gateway':
        await vscode.env.openExternal(vscode.Uri.parse(this.getServiceUrl()));
        break;
      case 'select_model':
        if (message.model) {
          await this.context.globalState.update(SELECTED_MODEL_STATE_KEY, message.model);
        }
        break;
      case 'chat_request':
        await this.handleChatRequest(message);
        break;
      default:
        break;
    }
  }

  private async pushBootstrapState(): Promise<void> {
    const serviceUrl = this.getServiceUrl();
    const hasApiKey = !!(await this.context.secrets.get(API_KEY_SECRET));
    const recentTasks = this.getRecentTasks();
    const selectedModel = this.context.globalState.get<string>(SELECTED_MODEL_STATE_KEY) || '';

    this.postMessage({
      type: 'bootstrap',
      payload: {
        role: 'Architect',
        hasApiKey,
        serviceUrl,
        recentTasks,
        selectedModel,
        connectionStatus: hasApiKey ? 'loading' : 'disconnected',
      },
    });

    if (hasApiKey) {
      await this.refreshConnection();
    }
  }

  private async saveConnection(apiKey: string, serviceUrl: string): Promise<void> {
    const trimmedApiKey = apiKey.trim();
    const normalizedServiceUrl = this.normalizeServiceUrl(serviceUrl || this.getServiceUrl());

    if (!trimmedApiKey) {
      this.postError('Please enter an API key.');
      return;
    }

    this.connectionStatus = 'loading';
    this.connectionError = '';
    this.postConnectionState([], '', normalizedServiceUrl);

    try {
      const models = await this.fetchModels(trimmedApiKey, normalizedServiceUrl);
      await this.context.secrets.store(API_KEY_SECRET, trimmedApiKey);
      await this.context.globalState.update(SERVICE_URL_STATE_KEY, normalizedServiceUrl);

      const selectedModel = this.chooseSelectedModel(models);
      if (selectedModel) {
        await this.context.globalState.update(SELECTED_MODEL_STATE_KEY, selectedModel);
      }

      this.connectionStatus = 'connected';
      this.connectionError = '';
      this.postConnectionState(models, selectedModel, normalizedServiceUrl);
    } catch (error) {
      this.connectionStatus = 'error';
      this.connectionError = this.getErrorMessage(error, 'Failed to connect to rw-proxy.');
      this.postConnectionState([], '', normalizedServiceUrl);
    }
  }

  private async refreshConnection(): Promise<void> {
    const apiKey = await this.context.secrets.get(API_KEY_SECRET);
    const serviceUrl = this.getServiceUrl();

    if (!apiKey) {
      this.connectionStatus = 'disconnected';
      this.connectionError = '';
      this.postConnectionState([], '', serviceUrl);
      return;
    }

    this.connectionStatus = 'loading';
    this.connectionError = '';
    this.postConnectionState([], '', serviceUrl);

    try {
      const models = await this.fetchModels(apiKey, serviceUrl);
      const selectedModel = this.chooseSelectedModel(models);
      if (selectedModel) {
        await this.context.globalState.update(SELECTED_MODEL_STATE_KEY, selectedModel);
      }

      this.connectionStatus = 'connected';
      this.connectionError = '';
      this.postConnectionState(models, selectedModel, serviceUrl);
    } catch (error) {
      this.connectionStatus = 'error';
      this.connectionError = this.getErrorMessage(error, 'Failed to refresh the model list.');
      this.postConnectionState([], '', serviceUrl);
    }
  }

  private async handleChatRequest(message: WebviewInboundMessage): Promise<void> {
    const apiKey = await this.context.secrets.get(API_KEY_SECRET);
    if (!apiKey) {
      this.postMessage({
        type: 'chat_error',
        payload: { requestId: message.requestId, error: 'Connect your rw-proxy API key first.' },
      });
      return;
    }

    const serviceUrl = this.getServiceUrl();
    const model = (message.model || '').trim();
    const messages = Array.isArray(message.messages) ? message.messages : [];

    if (!model) {
      this.postMessage({
        type: 'chat_error',
        payload: { requestId: message.requestId, error: 'Choose a model first.' },
      });
      return;
    }

    if (messages.length === 0) {
      this.postMessage({
        type: 'chat_error',
        payload: { requestId: message.requestId, error: 'Type a task before sending.' },
      });
      return;
    }

    try {
      const content = await this.createChatCompletion(apiKey, serviceUrl, model, messages);
      const recentTask = await this.recordRecentTask(message.prompt || '', model);

      this.postMessage({
        type: 'chat_response',
        payload: {
          requestId: message.requestId,
          content,
          recentTask,
        },
      });
    } catch (error) {
      this.postMessage({
        type: 'chat_error',
        payload: { requestId: message.requestId, error: this.getErrorMessage(error, 'The model request failed.') },
      });
    }
  }

  private async fetchModels(apiKey: string, serviceUrl: string): Promise<ModelOption[]> {
    const payload = await this.requestJson(`${serviceUrl}/v1/models`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const rawModels = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

    const options = rawModels
      .map((entry) => this.toModelOption(entry))
      .filter((entry): entry is ModelOption => !!entry)
      .sort((left, right) => left.label.localeCompare(right.label));

    if (options.length === 0) {
      throw new Error('No models are available for this API key.');
    }

    return options;
  }

  private toModelOption(entry: unknown): ModelOption | null {
    if (typeof entry === 'string') {
      return {
        id: entry,
        label: entry,
        badge: entry.toLowerCase().includes('free') ? 'Free' : undefined,
      };
    }

    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string'
      ? record.id.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : '';

    if (!id) {
      return null;
    }

    const owner = typeof record.owned_by === 'string' ? record.owned_by.trim() : '';
    return {
      id,
      label: id,
      subtitle: owner || undefined,
      badge: id.toLowerCase().includes('free') ? 'Free' : undefined,
    };
  }

  private async createChatCompletion(
    apiKey: string,
    serviceUrl: string,
    model: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): Promise<string> {
    const payload = await this.requestJson(`${serviceUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.7,
        messages,
      }),
    }, 90000);

    const record = payload as Record<string, unknown>;
    const choices = Array.isArray(record.choices) ? record.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const choiceMessage = first?.message as Record<string, unknown> | undefined;
    const content = this.extractMessageContent(choiceMessage?.content);

    if (!content.trim()) {
      throw new Error('The model returned an empty response.');
    }

    return content;
  }

  private extractMessageContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return '';
          }

          const record = entry as Record<string, unknown>;
          return typeof record.text === 'string' ? record.text : '';
        })
        .filter(Boolean)
        .join('\n');
    }

    return '';
  }

  private async recordRecentTask(prompt: string, model: string): Promise<RecentTaskRecord | null> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return null;
    }

    const nextTask: RecentTaskRecord = {
      id: crypto.randomUUID(),
      title: trimmedPrompt.length > 42 ? `${trimmedPrompt.slice(0, 42)}...` : trimmedPrompt,
      prompt: trimmedPrompt,
      model,
      createdAt: new Date().toISOString(),
    };

    const existing = this.getRecentTasks().filter((item) => item.prompt !== trimmedPrompt);
    const recentTasks = [nextTask, ...existing].slice(0, MAX_RECENT_TASKS);
    await this.context.globalState.update(RECENT_TASKS_STATE_KEY, recentTasks);

    return nextTask;
  }

  private getRecentTasks(): RecentTaskRecord[] {
    const tasks = this.context.globalState.get<RecentTaskRecord[]>(RECENT_TASKS_STATE_KEY);
    return Array.isArray(tasks) ? tasks : [];
  }

  private postConnectionState(models: ModelOption[], selectedModel: string, serviceUrl: string): void {
    this.postMessage({
      type: 'connection_state',
      payload: {
        status: this.connectionStatus,
        error: this.connectionError,
        models,
        selectedModel,
        serviceUrl,
        recentTasks: this.getRecentTasks(),
      },
    });
  }

  private chooseSelectedModel(models: ModelOption[]): string {
    const stored = this.context.globalState.get<string>(SELECTED_MODEL_STATE_KEY);
    if (stored && models.some((model) => model.id === stored)) {
      return stored;
    }

    const auto = models.find((model) => model.id.toLowerCase() === 'auto');
    if (auto) {
      return auto.id;
    }

    const autoFree = models.find((model) => model.id.toLowerCase() === 'auto-free');
    if (autoFree) {
      return autoFree.id;
    }

    return models[0]?.id || '';
  }

  private getServiceUrl(): string {
    const configured = this.context.globalState.get<string>(SERVICE_URL_STATE_KEY);
    if (configured && configured.trim()) {
      return this.normalizeServiceUrl(configured);
    }

    const configValue = vscode.workspace.getConfiguration().get<string>('rwProxy.defaultServiceUrl');
    return this.normalizeServiceUrl(configValue || 'http://127.0.0.1:3000');
  }

  private normalizeServiceUrl(serviceUrl: string): string {
    return serviceUrl.trim().replace(/\/+$/, '');
  }

  private async requestJson(
    url: string,
    init: RequestInit,
    timeoutMs = 15000,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: unknown = {};
      if (text) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          payload = { message: text };
        }
      }

      if (!response.ok) {
        throw new Error(this.extractErrorMessage(payload) || `HTTP ${response.status}`);
      }

      if (
        payload &&
        typeof payload === 'object' &&
        (payload as Record<string, unknown>).success === false
      ) {
        throw new Error(this.extractErrorMessage(payload) || 'The request failed.');
      }

      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('The request timed out.');
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private extractErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }

    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }

    if (record.error && typeof record.error === 'object') {
      const errorRecord = record.error as Record<string, unknown>;
      if (typeof errorRecord.message === 'string' && errorRecord.message.trim()) {
        return errorRecord.message.trim();
      }
    }

    return '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return fallback;
  }

  private postError(message: string): void {
    this.postMessage({
      type: 'toast',
      payload: { kind: 'error', message },
    });
  }

  private postMessage(message: unknown): void {
    if (this.view) {
      void this.view.webview.postMessage(message);
    }
  }

  private getNonce(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let index = 0; index < 32; index += 1) {
      text += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return text;
  }
}
