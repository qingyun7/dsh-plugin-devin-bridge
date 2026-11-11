# dsh-plugin-devin-bridge

[English](README.en.md) | [中文简介](README.md)

一个 [dsh](https://github.com/deepseek-ai/deepseek-harness) LLM 适配器插件，将 [Devin](https://devin.ai) 的 Connect RPC API 桥接到 dsh 模型提供者系统，让 dsh 内部的 agent loop 能够使用 Devin 托管的模型（`SWE-2 High`、`GLM-5.3 Max` 及 Devin 暴露的其他模型）作为后端。

此分支已移植到 **DSH 0.2.2-rc.1**，插件版本为 `0.3.4`。宿主包只作为 peer 依赖，开发依赖固定使用已验证的版本。

打开 **设置 → Devin 桥**，可以在浏览器登录、退出本机 Devin CLI 授权、刷新日／周用量、拉取当前账号的模型并勾选要显示在聊天框里的选项。

## 工作原理

插件通过 dsh LLM seam（`LlmAdapter`）在 `ctx.llm` 上注册 `devin` provider route。当 dsh 的 agent loop 把请求路由到 `provider: devin` 时，适配器会：

1. 把 dsh 的 `GenerateOptions`（消息、工具、系统提示词、图片）翻译成 Devin 的 `GetChatMessageRequest` protobuf
2. 从 Devin 的 Connect RPC 端点流式获取响应
3. 把每个 `GetChatMessageResponse` 帧解码为 dsh 的 `StreamChunk` 协议（文本增量、推理增量、工具调用增量、token 用量、结束原因）

## 安装

从 [GitHub Releases](https://github.com/qingyun7/dsh-plugin-devin-bridge/releases) 下载安装包，在 DSH 的「插件 → 安装第三方插件」中把安装包的 HTTPS 下载地址或本机绝对路径填入「包名或地址」，安装后启用。登录功能需要本机安装支持 ACP 浏览器登录的 Devin CLI 或 Devin 桌面版。退出会移除当前用户的本机 CLI 凭据，使用同一凭据的工具也需重新登录。用量仅展示 Devin 返回的窗口数据。

## Token 解析

适配器需要 Devin session token（格式：`devin-session-token$<...>`）进行认证。按以下优先级解析：

1. **设置面板** — 在 dsh 设置 UI 中填写 `token`（标记为 secret，wire 响应自动脱敏）
2. **Entry config** — 插件组合层的 `config.token`
3. **Devin CLI 凭证** — 自动从 `devin auth login` 创建的 `credentials.toml` 读取：
   - Windows：`%APPDATA%\devin\credentials.toml`
   - macOS/Linux：`~/.local/share/devin/credentials.toml`（或 `$XDG_DATA_HOME/devin/credentials.toml`）
   - 通过 `DEVIN_CREDENTIALS_PATH` 环境变量覆盖路径

如果都没找到，插件会在需要访问 Devin 时给出明确指引；你仍可先打开设置页填写 token。

## 配置

所有字段均可选——只要有 token（通过设置面板、entry config 或 credentials.toml），插件即可开箱即用。

```yaml
- id: devin-bridge
  name: dsh-plugin-devin-bridge
  config:
    token: ""  # 可选：显式 token；留空则从 credentials.toml 自动检测
    baseUrl: "https://server.codeium.com"  # 可选：Devin Connect 端点
    proxy: ""  # 可选：出站代理 URL（http/https/socks5）
    forceHttp1: true  # 可选：强制 HTTP/1.1（默认 true）
    defaultContextWindow: 128000  # 可选：默认上下文窗口
    defaultMaxTokens: 16384  # 可选：默认最大输出 token
    models:  # 可选；默认包含 SWE-2 High 和 GLM-5.3 Max
      - id: "glm-5-3-max"
        name: "GLM-5.3 Max"
        contextWindow: 128000
        maxTokens: 16384
        supportsImages: false
      - id: "swe-2-high"
        name: "SWE-2 High"
        contextWindow: 128000
        maxTokens: 16384
        supportsImages: true
    retryPolicy:  # 可选
      mode: normal
      maxRetries: 3
      backoff:
        initialDelayMs: 500
        maxDelayMs: 10000
        jitterRatio: 0.1
```

以上字段由新版 SettingsForms 自动生成表单。Config 整体声明为 volatile，保存后实时更新，并重新注册模型目录及重试策略。`token` 字段标记为 `role('secret')`，在返回给 wire surface 的 settings descriptor 中自动脱敏。

## 使用方式

配置完成后，dsh 的模型选择器会显示 `Devin` provider 及可用模型。在 dsh UI 中选择任一模型，或通过 `provider: devin` 编程式路由。

## 功能特性

- **动态模型目录**：宿主模型发现接口通过 `GetCascadeModelConfigs` RPC 拉取可用模型。模型选择器显示在「设置 → Devin 桥」勾选并保存的模型。
- **文本流式输出**：完整的文本增量流式传输与 block 组装
- **推理/思考**：推理内容映射到 dsh 的 `reasoning` block 类型
- **工具调用**：Devin 工具调用增量翻译为 dsh 的 `tool-call` block
- **图片支持**：有视觉能力的模型通过 dsh 的 attachment 系统接受图片输入
- **Token 用量**：输入/输出 token 计量上报给 dsh
- **系统提示词清洗**：跨模型兼容的身份无关系统提示词重写
- **代理支持**：可选的出站 HTTP/HTTPS/SOCKS5 代理
- **设置面板集成**：通过 dsh settings 服务在运行时动态调整配置
- **凭证自动检测**：未显式配置 token 时自动读取 `devin auth login` 的凭证

## 架构

```
src/
├── index.ts              # Cordis 插件入口：Config schema、设置面板接入、ctx.llm 注册
├── adapter/
│   ├── devin.ts          # DevinAdapter：GenerateOptions → Devin RPC → StreamChunk
│   ├── decoder.ts        # GetChatMessageResponse → StreamChunk 转换
│   ├── transport.ts      # Connect transport，注入 auth + proxy
│   └── credentials.ts    # Devin CLI credentials.toml 自动检测
└── proto/
    ├── devin.proto       # 裁剪后的 protobuf 定义
    └── gen/              # @bufbuild/protobuf 生成代码
```

## 许可证

MIT

上游项目为 [Arborsm/dsh-plugin-devin-bridge](https://github.com/Arborsm/dsh-plugin-devin-bridge)，保留 MIT 许可。
