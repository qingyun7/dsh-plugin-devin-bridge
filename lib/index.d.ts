import z from "@deepseek-ai/schemastery";
import { GenerateOptions, LlmAdapter, LlmDiscoveredModel, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, RetryPolicyConfig, StreamChunk } from "@deepseek-ai/dsh-llm";
import { Context, Volatile } from "@deepseek-ai/cordis";
import { ImageAttachmentRef, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
//#region src/adapter/devin.d.ts
interface DevinCatalogModel {
  id: string;
  name?: string;
  description?: string;
  contextWindow?: number;
  maxTokens?: number;
  supportsImages?: boolean;
  /** 模型系列标签（如 "GLM-5.2", "SWE-1.7"），从 model_family_metadata 提取。 */
  family?: string;
  /** 是否需要付费 plan。 */
  isPremium?: boolean;
  /** 是否当前处于促销期（promo_status.is_active）。 */
  isPromo?: boolean;
  /** 信用倍率，用于排序和展示。 */
  creditMultiplier?: number;
  /** Devin 标为该系列的默认变体。 */
  isDefault?: boolean;
  isRecommended?: boolean;
  isNew?: boolean;
}
interface DevinConnectionOptions {
  baseUrl: string;
  token: string;
  proxy?: string;
  forceHttp1: boolean;
  models: readonly DevinCatalogModel[];
  defaultContextWindow: number;
  defaultMaxTokens: number;
  /** 可选的 attachment 读取器，用于获取图片字节 */
  readImage?: (ref: ImageAttachmentRef, signal?: AbortSignal) => Promise<StoredImageAttachment>;
}
interface DevinAdapterOptions {
  /** 当前连接配置；每次操作时调用以获取最新值。 */
  options: () => DevinConnectionOptions;
}
interface DevinUsageWindow {
  remainingPercent: number;
  resetAt: string;
}
interface DevinUsage {
  daily?: DevinUsageWindow;
  weekly?: DevinUsageWindow;
}
declare class DevinAdapter extends LlmAdapter {
  private readonly config;
  private cachedClients;
  private cachedClientKey;
  constructor(options: DevinAdapterOptions);
  /** 当前连接配置（每次调用读取最新值）。 */
  private conn;
  /** 根据同一套连接参数创建聊天和账号客户端。 */
  private clients;
  private client;
  private seatClient;
  providerInfo(_provider: string): LlmProviderInfo;
  listModels(_provider: string): Promise<readonly LlmModelInfo[]>;
  resolveModel(_provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
  /** 将当前可用模型投影为 DSH 的模型发现格式。 */
  discoverModels(signal?: AbortSignal): Promise<LlmDiscoveredModel[]>;
  /**
   * 读取当前账号的目录。每个系列保留一个可选变体及其真实模型 ID，
   * 优先选择 Devin 指定的默认或推荐变体。
   */
  fetchModelCatalog(signal?: AbortSignal): Promise<DevinCatalogModel[]>;
  /** 返回该账号可见的额度窗口。没有日／周额度的计划返回空对象。 */
  fetchUsage(signal?: AbortSignal): Promise<DevinUsage>;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  private buildRequest;
  private convertMessage;
  private promptForContent;
}
//#endregion
//#region src/adapter/credentials.d.ts
/**
 * Devin CLI credentials.toml 的平台相关路径。
 * 支持环境变量 DEVIN_CREDENTIALS_PATH 覆盖。
 */
declare function devinCredentialsPath(): string;
interface DevinSession {
  /** windsurf_api_key，格式 devin-session-token$... */
  apiKey: string;
  /** api_server_url，默认 https://server.codeium.com */
  apiServerUrl: string;
  /** devin_api_url，可选 */
  devinApiUrl?: string;
}
/**
 * 尝试从 Devin CLI 的 credentials.toml 读取 session。
 * 文件不存在或格式无效时返回 undefined，不抛异常。
 */
declare function readDevinSession(options?: {
  credentialsPath?: string;
}): DevinSession | undefined;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-devin-bridge";
declare const inject: string[];
interface Config {
  /**
   * Devin session token，格式 devin-session-token$<...>。
   * 留空时自动从 Devin CLI 的 credentials.toml 读取（`devin auth login` 写入）。
   */
  token: string;
  /** Devin Connect 端点，默认 https://server.codeium.com。 */
  baseUrl: string;
  /** 可选出站代理 URL（http/https/socks5）。 */
  proxy: string;
  /** 强制 HTTP/1.1 连接 Devin，默认 true。 */
  forceHttp1: boolean;
  /** 默认上下文窗口，默认 128000。 */
  defaultContextWindow: number;
  /** 默认最大输出 token，默认 16384。 */
  defaultMaxTokens: number;
  /** 可用模型列表。 */
  models: DevinCatalogModel[];
  /** 重试策略。 */
  retryPolicy: RetryPolicyConfig;
}
declare const Config: z<NoInfer<Schemastery.ObjectS<NoInfer<{
  token: z<string, string, "defined">;
  baseUrl: z<string, string, "defined">;
  proxy: z<string, string, "defined">;
  forceHttp1: z<boolean, boolean, "defined">;
  defaultContextWindow: z<number, number, "defined">;
  defaultMaxTokens: z<number, number, "defined">;
  models: z<DevinCatalogModel[], DevinCatalogModel[], "defined">;
  retryPolicy: z<RetryPolicyConfig>;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
  token: z<string, string, "defined">;
  baseUrl: z<string, string, "defined">;
  proxy: z<string, string, "defined">;
  forceHttp1: z<boolean, boolean, "defined">;
  defaultContextWindow: z<number, number, "defined">;
  defaultMaxTokens: z<number, number, "defined">;
  models: z<DevinCatalogModel[], DevinCatalogModel[], "defined">;
  retryPolicy: z<RetryPolicyConfig>;
}>>>, "volatile">;
declare function apply(ctx: Context, config: Volatile<Config>): void;
//#endregion
export { Config, DevinAdapter, type DevinAdapterOptions, type DevinCatalogModel, type DevinConnectionOptions, type DevinSession, apply, devinCredentialsPath, inject, name, readDevinSession };
//# sourceMappingURL=index.d.ts.map