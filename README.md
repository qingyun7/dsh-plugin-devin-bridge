# dsh-plugin-devin-bridge

[English](README.md) | [中文](README.zh.md)

A [dsh](https://github.com/deepseek-ai/deepseek-harness) LLM adapter plugin that bridges [Devin](https://devin.ai)'s Connect RPC API into the dsh model provider system, enabling dsh's internal agent loop to use Devin-hosted models (`SWE-2 High`, `GLM-5.3 Max`, and any other model Devin exposes) as backends.

This branch targets **DSH 0.2.2-rc.1** as plugin version `0.3.2`. Host packages are peer dependencies, with tested versions pinned for development.

Open **Settings → Devin Bridge** to sign in through your browser, sign out of the local Devin CLI, read daily and weekly usage limits, and choose which models appear in the chat picker.

## How it works

The plugin registers a `devin` provider route on `ctx.llm` via the dsh LLM seam (`LlmAdapter`). When dsh's agent loop routes a request to `provider: devin`, the adapter:

1. Translates dsh's `GenerateOptions` (messages, tools, system prompt, images) into Devin's `GetChatMessageRequest` protobuf
2. Streams the response from Devin's Connect RPC endpoint
3. Decodes each `GetChatMessageResponse` frame into dsh's `StreamChunk` protocol (text deltas, reasoning deltas, tool-call deltas, usage, finish)

## Installation

Download the archive from [GitHub Releases](https://github.com/qingyun7/dsh-plugin-devin-bridge/releases) and paste its HTTPS download URL or local absolute path into **Plugins → Install third-party plugin → Package name or URL**. Browser sign-in requires Devin Desktop or a Devin CLI with ACP browser authentication. Signing out removes the current user’s local CLI credential. Tools that share it will require sign-in again. The usage panel shows the windows reported by Devin.

## Token resolution

The adapter needs a Devin session token (format: `devin-session-token$<...>`) to authenticate. It resolves the token in priority order:

1. **Settings panel** — set `token` in the dsh settings UI (marked as secret, auto-redacted in wire responses)
2. **Entry config** — `config.token` in the plugin composition
3. **Devin CLI credentials** — automatically read from `credentials.toml` created by `devin auth login`:
   - Windows: `%APPDATA%\devin\credentials.toml`
   - macOS/Linux: `~/.local/share/devin/credentials.toml` (or `$XDG_DATA_HOME/devin/credentials.toml`)
   - Override path with `DEVIN_CREDENTIALS_PATH` environment variable

If no credential is found, open the Devin Bridge settings and sign in.

## Configuration

All fields are optional — the plugin works out of the box once a token is available (via settings panel, entry config, or credentials.toml).

```yaml
- id: devin-bridge
  name: dsh-plugin-devin-bridge
  config:
    token: ""  # optional: explicit token; empty = auto-detect from credentials.toml
    baseUrl: "https://server.codeium.com"  # optional: Devin Connect endpoint
    proxy: ""  # optional: outbound proxy URL (http/https/socks5)
    forceHttp1: true  # optional: force HTTP/1.1 (default true)
    defaultContextWindow: 128000  # optional: fallback context window
    defaultMaxTokens: 16384  # optional: fallback max output tokens
    models:  # optional; defaults to SWE-2 High and GLM-5.3 Max
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
    retryPolicy:  # optional
      mode: normal
      maxRetries: 3
      backoff:
        initialDelayMs: 500
        maxDelayMs: 10000
        jitterRatio: 0.1
```

SettingsForms generates a form for these fields. The complete Config schema is volatile, so saved changes update the running instance and refresh provider registrations and retry policy. The `token` field is marked `role('secret')` so it is automatically redacted in settings descriptors returned to wire surfaces.

## Usage

Once configured, dsh's model selector will show `Devin` as a provider with available models. Select any model in the dsh UI or route to it programmatically with `provider: devin`.

## Features

- **Dynamic model catalog**: The host discovery API fetches available models via `GetCascadeModelConfigs`. The chat picker shows the models selected and saved in Settings → Devin Bridge.
- **Text streaming**: Full text delta streaming with block assembly
- **Reasoning/thinking**: Reasoning content mapped to dsh's `reasoning` block type
- **Tool calls**: Devin tool-call deltas translated to dsh's `tool-call` blocks
- **Image support**: Vision-capable models accept image inputs via dsh's attachment system
- **Token usage**: Input/output token accounting reported to dsh
- **System prompt sanitization**: Identity-agnostic system prompt rewriting for cross-model compatibility
- **Proxy support**: Optional outbound HTTP/HTTPS/SOCKS5 proxy
- **Settings panel integration**: Runtime-adjustable configuration via dsh settings service
- **Credential auto-detection**: Reads `devin auth login` credentials when no explicit token is configured

## Architecture

```
src/
├── index.ts              # Cordis plugin entry: Config schema, settings panel, ctx.llm registration
├── adapter/
│   ├── devin.ts          # DevinAdapter: GenerateOptions → Devin RPC → StreamChunk
│   ├── decoder.ts        # GetChatMessageResponse → StreamChunk translation
│   ├── transport.ts      # Connect transport with auth + proxy injection
│   └── credentials.ts    # Devin CLI credentials.toml auto-detection
└── proto/
    ├── devin.proto       # Trimmed protobuf definitions
    └── gen/              # @bufbuild/protobuf generated code
```

## License

MIT

Based on [Arborsm/dsh-plugin-devin-bridge](https://github.com/Arborsm/dsh-plugin-devin-bridge), under the MIT license.
