window.__ModuleLoader__.load({
	id: "dsh-plugin-devin-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/styles.ts
		const styles = `
.devin-bridge { color: inherit; font: inherit; padding-bottom: 12px; }
.devin-bridge h2 { font-size: 21px; line-height: 1.3; margin: 0 0 18px; font-weight: 650; }
.devin-bridge h3 { font-size: 15px; line-height: 1.35; margin: 0; font-weight: 650; }
.devin-bridge p { margin: 6px 0 0; line-height: 1.45; }
.devin-section { border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); padding: 16px 0; }
.devin-heading, .devin-filter, .devin-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.devin-heading { justify-content: space-between; }
.devin-heading > div:first-child { min-width: 0; }
.devin-bridge button, .devin-bridge input[type=search] { font: inherit; font-size: 13px; color: inherit; border: 1px solid color-mix(in srgb, currentColor 24%, transparent); border-radius: 8px; padding: 7px 10px; background: transparent; }
.devin-bridge button { cursor: pointer; min-height: 34px; }
.devin-bridge button:not(:disabled):hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.devin-bridge button.devin-primary { background: #244ba8; border-color: #244ba8; color: white; }
.devin-bridge button.devin-primary:not(:disabled):hover { background: #1c3d8f; }
.devin-bridge button:disabled { opacity: .48; cursor: default; }
.devin-bridge :focus-visible { outline: 2px solid #567eeb; outline-offset: 2px; }
.devin-bridge a { color: inherit; display: inline-block; margin-top: 9px; text-underline-offset: 3px; font-size: 13px; }
.devin-bridge .devin-note:empty, .devin-bridge .devin-result:empty { display: none; }
.devin-usage { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 16px; margin-top: 12px; font-variant-numeric: tabular-nums; }
.devin-usage progress { width: 100%; height: 9px; accent-color: #446bcb; }
.devin-filter { margin: 12px 0 6px; }
.devin-filter input[type=search] { flex: 1; min-width: 150px; }
.devin-filter label, .devin-model { display: flex; align-items: center; gap: 9px; }
.devin-bridge input[type=checkbox] { accent-color: #446bcb; width: 15px; height: 15px; flex: 0 0 auto; }
.devin-models { max-height: 245px; overflow: auto; overscroll-behavior: contain; }
.devin-model { min-height: 42px; padding: 6px 8px; cursor: pointer; }
.devin-model:hover { background: color-mix(in srgb, currentColor 6%, transparent); }
.devin-model small { display: block; font-size: 11px; opacity: .72; overflow-wrap: anywhere; }
.devin-save { margin-top: 12px; font-size: 13px; }
.devin-error { border-inline-start: 3px solid #bc542a; padding-inline-start: 9px; }
`;
		//#endregion
		//#region src/client/index.tsx
		const zh = navigator.language.toLowerCase().startsWith("zh");
		const copy = {
			title: zh ? "Devin 桥" : "Devin Bridge",
			account: zh ? "登录管理" : "Account",
			signedIn: zh ? "已登录 Devin" : "Signed in to Devin",
			signedOut: zh ? "未登录 Devin" : "Signed out of Devin",
			token: zh ? "正在使用配置里的凭据" : "Using the configured credential",
			login: zh ? "在浏览器登录" : "Sign in with browser",
			logout: zh ? "退出登录" : "Sign out",
			cancel: zh ? "取消登录" : "Cancel sign-in",
			waiting: zh ? "请在浏览器完成登录，完成后这里会自动更新。" : "Finish signing in in your browser. This page updates automatically.",
			cli: zh ? "请安装 Devin CLI 或 Devin 桌面版，然后重开此页。" : "Install Devin CLI or Devin Desktop, then reopen this page.",
			desktop: zh ? "请在 DSH 桌面版管理 Devin 登录。" : "Manage Devin sign-in from DSH Desktop.",
			usage: zh ? "用量限制" : "Usage limits",
			day: zh ? "每日" : "Daily",
			week: zh ? "每周" : "Weekly",
			remaining: zh ? "剩余" : "remaining",
			reset: zh ? "重置" : "Resets",
			noUsage: zh ? "Devin 未返回这个周期的额度。" : "Devin did not report a limit for this window.",
			openUsage: zh ? "在 Devin 查看用量 ↗" : "View usage in Devin ↗",
			checkUsage: zh ? "刷新用量" : "Refresh usage",
			models: zh ? "聊天模型" : "Chat models",
			modelsHelp: zh ? "勾选要显示在 DSH 聊天模型列表里的模型，然后保存。" : "Select the models to show in the DSH chat picker, then save.",
			refresh: zh ? "从 Devin 拉取模型" : "Fetch models from Devin",
			search: zh ? "搜索模型" : "Search models",
			shown: zh ? "只看已选" : "Show selected only",
			save: zh ? "保存模型列表" : "Save model list",
			empty: zh ? "没有匹配的模型。" : "No matching models.",
			clear: zh ? "清空选择" : "Clear selection",
			saved: zh ? "聊天模型列表已保存。" : "Chat model list saved.",
			busy: zh ? "正在处理…" : "Working…",
			loading: zh ? "正在读取 Devin 桥设置…" : "Loading Devin Bridge settings…",
			retry: zh ? "重试" : "Retry",
			failed: zh ? "操作未完成。请检查 Devin 登录或网络后重试。" : "The operation failed. Check your Devin sign-in or connection and retry."
		};
		function Settings({ call }) {
			const [state, setState] = (0, react.useState)();
			const [catalog, setCatalog] = (0, react.useState)([]);
			const [selection, setSelection] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [query, setQuery] = (0, react.useState)("");
			const [selectedOnly, setSelectedOnly] = (0, react.useState)(false);
			const [usage, setUsage] = (0, react.useState)();
			const [action, setAction] = (0, react.useState)();
			const [error, setError] = (0, react.useState)("");
			const [notice, setNotice] = (0, react.useState)("");
			const authenticated = state?.account.authenticated || state?.configuredToken;
			const loginPending = state?.account.loginInProgress;
			function initialize(next) {
				setState(next);
				setSelection(new Set(next.models.map((model) => model.id)));
			}
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				call("status", void 0, controller.signal).then(initialize, () => {
					if (!controller.signal.aborted) setError(copy.failed);
				});
				return () => controller.abort();
			}, [call]);
			(0, react.useEffect)(() => {
				if (!loginPending || action) return;
				const controller = new AbortController();
				const poll = async () => {
					try {
						const next = await call("status", void 0, controller.signal);
						if (controller.signal.aborted) return;
						setState(next);
						if (next.account.loginInProgress) timer = setTimeout(poll, 900);
					} catch {
						if (!controller.signal.aborted) setError(copy.failed);
					}
				};
				let timer = setTimeout(poll, 900);
				return () => {
					clearTimeout(timer);
					controller.abort();
				};
			}, [
				call,
				loginPending,
				action
			]);
			async function run(operation, onResult, payload) {
				setAction(operation);
				setNotice("");
				setError("");
				try {
					onResult(await call(operation, payload));
				} catch {
					setError(copy.failed);
				} finally {
					setAction(void 0);
				}
			}
			if (!state) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "devin-bridge",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					children: error || copy.loading
				}), error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					onClick: () => {
						setError("");
						call("status").then(initialize, () => setError(copy.failed));
					},
					children: copy.retry
				})]
			});
			const available = new Map(state.models.map((model) => [model.id, model]));
			for (const model of catalog) available.set(model.id, model);
			const search = query.trim().toLowerCase();
			const results = [...available.values()].filter((model) => (!selectedOnly || selection.has(model.id)) && `${model.name ?? ""} ${model.id} ${model.family ?? ""}`.toLowerCase().includes(search));
			const dirty = selection.size !== state.models.length || state.models.some((model) => !selection.has(model.id));
			const disabled = Boolean(action || state.account.logoutInProgress);
			const canLogin = state.desktop && state.account.cliAvailable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "devin-bridge",
				"aria-label": copy.title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: copy.title }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "devin-section",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "devin-heading",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: copy.account }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: state.configuredToken ? copy.token : authenticated ? copy.signedIn : copy.signedOut })] }), state.desktop && (loginPending ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled,
								onClick: () => void run("cancel", setState),
								children: copy.cancel
							}) : authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: disabled || !canLogin && !state.configuredToken,
								onClick: () => void run("logout", (next) => {
									setState(next);
									if (!next.account.authenticated && !next.configuredToken) {
										setCatalog([]);
										setUsage(void 0);
									}
								}),
								children: copy.logout
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "devin-primary",
								disabled: disabled || !canLogin,
								onClick: () => void run("login", setState),
								children: copy.login
							}))]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "devin-note",
							role: "status",
							children: loginPending ? copy.waiting : state.account.error || (!state.desktop ? copy.desktop : !canLogin ? copy.cli : "")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "devin-section",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "devin-heading",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: copy.usage }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: disabled || !authenticated,
									onClick: () => void run("usage", setUsage),
									children: copy.checkUsage
								})]
							}),
							usage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "devin-usage",
								children: ["daily", "weekly"].map((window) => {
									const limit = usage[window];
									const label = window === "daily" ? copy.day : copy.week;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: label }),
										limit?.remainingPercent != null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
											limit.remainingPercent,
											"% ",
											copy.remaining
										] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("progress", {
											"aria-label": label,
											max: 100,
											value: limit.remainingPercent
										})] }),
										limit?.resetAt && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
											copy.reset,
											" ",
											new Date(limit.resetAt).toLocaleString()
										] }),
										limit?.remainingPercent == null && !limit?.resetAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: copy.noUsage })
									] }, window);
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href: "https://app.devin.ai/settings/usage",
								target: "_blank",
								rel: "noreferrer",
								children: copy.openUsage
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "devin-section",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "devin-heading",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: copy.models }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: copy.modelsHelp })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: disabled || !authenticated,
									onClick: () => void run("catalog", setCatalog),
									children: copy.refresh
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "devin-filter",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": copy.search,
									placeholder: copy.search,
									type: "search",
									value: query,
									onChange: (event) => setQuery(event.target.value)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: selectedOnly,
									onChange: (event) => setSelectedOnly(event.target.checked)
								}), copy.shown] })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "devin-models",
								children: [results.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: copy.empty }), results.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "devin-model",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: selection.has(model.id),
										disabled,
										onChange: (event) => {
											const next = new Set(selection);
											if (event.target.checked) next.add(model.id);
											else next.delete(model.id);
											setSelection(next);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [model.name || model.id, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: model.id })] })]
								}, model.id))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "devin-heading devin-save",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-live": "polite",
									children: zh ? `已选 ${selection.size} 个模型` : `${selection.size} models selected`
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "devin-actions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: disabled || selection.size === 0,
										onClick: () => setSelection(/* @__PURE__ */ new Set()),
										children: copy.clear
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "devin-primary",
										disabled: disabled || !dirty,
										onClick: () => void run("save", (next) => {
											initialize(next);
											setNotice(copy.saved);
										}, [...selection]),
										children: copy.save
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "devin-result",
						role: "status",
						children: action ? copy.busy : notice
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "devin-error",
						role: "alert",
						children: error
					})
				]
			});
		}
		const inject = ["slots", "connection"];
		function apply(ctx) {
			const rpc = ctx.get("connection").rpc;
			const call = async (endpoint, payload, signal) => {
				const response = await rpc.call("/api", `devin-bridge/${endpoint}`, payload ?? null, signal);
				if (!response?.ok) throw new Error(copy.failed);
				return response.value;
			};
			ctx.effect(() => {
				const style = document.createElement("style");
				style.textContent = styles;
				document.head.append(style);
				return () => style.remove();
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "devin-bridge",
				label: () => copy.title,
				order: 16,
				inject: () => ({ call })
			}, Settings));
			ctx.slots.inject("settings.section.icon", () => ctx.slots.register({
				name: "settings.section.icon",
				id: "devin-bridge"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				"aria-hidden": "true",
				width: "20",
				height: "20",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.7",
				strokeLinecap: "round",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 17h18M5 17v-4m14 4v-4M5 13a7 7 0 0 0 14 0M8 17v-2m8 2v-2" })
			})));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map