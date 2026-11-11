import z from "@deepseek-ai/schemastery";
import { LlmAdapter, LlmError, ReasoningEffortId, RetryPolicySchema, ToolCallId, projectToolUpdates, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { randomBytes, randomUUID } from "node:crypto";
import { fileDesc, messageDesc, serviceDesc } from "@bufbuild/protobuf/codegenv2";
import { createConnectTransport } from "@connectrpc/connect-node";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";
//#region src/proto/gen/devin_pb.ts
/**
* Describes the file devin.proto.
*/
const file_devin = /*@__PURE__*/ fileDesc("CgtkZXZpbi5wcm90bxIRZXhhLmFwaV9zZXJ2ZXJfcGIiOgoYR29vZ2xlUHJvdG9idWZfVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAUirwEKG0V4YUNvZGVpdW1Db21tb25QYl9NZXRhZGF0YRIQCghpZGVfbmFtZRgBIAEoCRIZChFleHRlbnNpb25fdmVyc2lvbhgCIAEoCRIPCgdhcGlfa2V5GAMgASgJEg4KBmxvY2FsZRgEIAEoCRIKCgJvcxgFIAEoCRITCgtpZGVfdmVyc2lvbhgHIAEoCRIWCg5leHRlbnNpb25fbmFtZRgMIAEoCRIJCgFmGB8gASgJIqIBCipFeGFDb2RlaXVtQ29tbW9uUGJfQ29tcGxldGlvbkNvbmZpZ3VyYXRpb24SFwoPbnVtX2NvbXBsZXRpb25zGAEgASgEEhIKCm1heF90b2tlbnMYAiABKAQSFAoMbWF4X25ld2xpbmVzGAMgASgEEhMKC3RlbXBlcmF0dXJlGAUgASgBEg0KBXRvcF9rGAcgASgEEg0KBXRvcF9wGAggASgBIkYKHEV4YUNvZGVpdW1Db21tb25QYl9JbWFnZURhdGESEwoLYmFzZTY0X2RhdGEYASABKAkSEQoJbWltZV90eXBlGAIgASgJIlMKH0V4YUNvZGVpdW1Db21tb25QYl9DaGF0VG9vbENhbGwSCgoCaWQYASABKAkSDAoEbmFtZRgCIAEoCRIWCg5hcmd1bWVudHNfanNvbhgDIAEoCSJdChxFeGFDaGF0UGJfQ2hhdFRvb2xEZWZpbml0aW9uEgwKBG5hbWUYASABKAkSEwoLZGVzY3JpcHRpb24YAiABKAkSGgoSanNvbl9zY2hlbWFfc3RyaW5nGAMgASgJIocDChtFeGFDaGF0UGJfQ2hhdE1lc3NhZ2VQcm9tcHQSEgoKbWVzc2FnZV9pZBgBIAEoCRJHCgZzb3VyY2UYAiABKA4yNy5leGEuYXBpX3NlcnZlcl9wYi5FeGFDb2RlaXVtQ29tbW9uUGJfQ2hhdE1lc3NhZ2VTb3VyY2USDgoGcHJvbXB0GAMgASgJEkYKCnRvb2xfY2FsbHMYBiADKAsyMi5leGEuYXBpX3NlcnZlcl9wYi5FeGFDb2RlaXVtQ29tbW9uUGJfQ2hhdFRvb2xDYWxsEhQKDHRvb2xfY2FsbF9pZBgHIAEoCRIcChR0b29sX3Jlc3VsdF9pc19lcnJvchgJIAEoCBI/CgZpbWFnZXMYCiADKAsyLy5leGEuYXBpX3NlcnZlcl9wYi5FeGFDb2RlaXVtQ29tbW9uUGJfSW1hZ2VEYXRhEhAKCHRoaW5raW5nGAsgASgJEhEKCXNpZ25hdHVyZRgMIAEoCRIZChF0aGlua2luZ19yZWRhY3RlZBgNIAEoCCLOAQolRXhhQ29ydGV4UGJfQ29ydGV4VHJhamVjdG9yeVJlZmVyZW5jZRIVCg10cmFqZWN0b3J5X2lkGAEgASgJEkwKD3RyYWplY3RvcnlfdHlwZRgDIAEoDjIzLmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvcnRleFBiX0NvcnRleFRyYWplY3RvcnlUeXBlEkAKCXN0ZXBfdHlwZRgEIAEoDjItLmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvcnRleFBiX0NvcnRleFN0ZXBUeXBlIpsBCiJFeGFDb2RlaXVtQ29tbW9uUGJfTW9kZWxVc2FnZVN0YXRzEhQKDGlucHV0X3Rva2VucxgCIAEoBBIVCg1vdXRwdXRfdG9rZW5zGAMgASgEEhoKEmNhY2hlX3dyaXRlX3Rva2VucxgEIAEoBBIZChFjYWNoZV9yZWFkX3Rva2VucxgFIAEoBBIRCgltb2RlbF91aWQYCSABKAkigQEKHkV4YUNvZGVpdW1Db21tb25QYl9Qcm9tb1N0YXR1cxIRCglpc19hY3RpdmUYASABKAgSPQoIZW5kX2RhdGUYAiABKAsyKy5leGEuYXBpX3NlcnZlcl9wYi5Hb29nbGVQcm90b2J1Zl9UaW1lc3RhbXASDQoFbGFiZWwYAyABKAkiaAomRXhhQ29kZWl1bUNvbW1vblBiX01vZGVsRmFtaWx5TWV0YWRhdGESGgoSbW9kZWxfZmFtaWx5X2xhYmVsGAEgASgJEiIKGmlzX2RlZmF1bHRfbW9kZWxfaW5fZmFtaWx5GAMgASgIIosECiRFeGFDb2RlaXVtQ29tbW9uUGJfQ2xpZW50TW9kZWxDb25maWcSDQoFbGFiZWwYASABKAkSEAoIZGlzYWJsZWQYBCABKAgSFwoPc3VwcG9ydHNfaW1hZ2VzGAUgASgIEhIKCmlzX3ByZW1pdW0YByABKAgSDwoHaXNfYmV0YRgJIAEoCBJFCghwcm92aWRlchgKIAEoDjIzLmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvZGVpdW1Db21tb25QYl9Nb2RlbFByb3ZpZGVyEhYKDmlzX3JlY29tbWVuZGVkGAsgASgIEg4KBmlzX25ldxgPIAEoCBIbChNpc19jYXBhY2l0eV9saW1pdGVkGBQgASgIEhIKCm1heF90b2tlbnMYEiABKAUSEQoJbW9kZWxfdWlkGBYgASgJEhMKC2Rlc2NyaXB0aW9uGBsgASgJEhkKEWNyZWRpdF9tdWx0aXBsaWVyGAMgASgCEkcKDHByb21vX3N0YXR1cxgTIAEoCzIxLmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvZGVpdW1Db21tb25QYl9Qcm9tb1N0YXR1cxJYChVtb2RlbF9mYW1pbHlfbWV0YWRhdGEYHiABKAsyOS5leGEuYXBpX3NlcnZlcl9wYi5FeGFDb2RlaXVtQ29tbW9uUGJfTW9kZWxGYW1pbHlNZXRhZGF0YSL/BAoVR2V0Q2hhdE1lc3NhZ2VSZXF1ZXN0EkAKCG1ldGFkYXRhGAEgASgLMi4uZXhhLmFwaV9zZXJ2ZXJfcGIuRXhhQ29kZWl1bUNvbW1vblBiX01ldGFkYXRhEg4KBnByb21wdBgCIAEoCRJMChRjaGF0X21lc3NhZ2VfcHJvbXB0cxgDIAMoCzIuLmV4YS5hcGlfc2VydmVyX3BiLkV4YUNoYXRQYl9DaGF0TWVzc2FnZVByb21wdBI/CgxyZXF1ZXN0X3R5cGUYByABKA4yKS5leGEuYXBpX3NlcnZlcl9wYi5DaGF0TWVzc2FnZVJlcXVlc3RUeXBlElQKDWNvbmZpZ3VyYXRpb24YCCABKAsyPS5leGEuYXBpX3NlcnZlcl9wYi5FeGFDb2RlaXVtQ29tbW9uUGJfQ29tcGxldGlvbkNvbmZpZ3VyYXRpb24SPgoFdG9vbHMYCiADKAsyLy5leGEuYXBpX3NlcnZlcl9wYi5FeGFDaGF0UGJfQ2hhdFRvb2xEZWZpbml0aW9uElYKFHRyYWplY3RvcnlfcmVmZXJlbmNlGA8gASgLMjguZXhhLmFwaV9zZXJ2ZXJfcGIuRXhhQ29ydGV4UGJfQ29ydGV4VHJhamVjdG9yeVJlZmVyZW5jZRISCgpjYXNjYWRlX2lkGBAgASgJElUKDHBsYW5uZXJfbW9kZRgUIAEoDjI/LmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvZGVpdW1Db21tb25QYl9Db252ZXJzYXRpb25hbFBsYW5uZXJNb2RlEhYKDmNoYXRfbW9kZWxfdWlkGBUgASgJEhQKDGV4ZWN1dGlvbl9pZBgWIAEoCSLBAwoWR2V0Q2hhdE1lc3NhZ2VSZXNwb25zZRISCgptZXNzYWdlX2lkGAEgASgJEj4KCXRpbWVzdGFtcBgCIAEoCzIrLmV4YS5hcGlfc2VydmVyX3BiLkdvb2dsZVByb3RvYnVmX1RpbWVzdGFtcBISCgpkZWx0YV90ZXh0GAMgASgJEkUKC3N0b3BfcmVhc29uGAUgASgOMjAuZXhhLmFwaV9zZXJ2ZXJfcGIuRXhhQ29kZWl1bUNvbW1vblBiX1N0b3BSZWFzb24STAoQZGVsdGFfdG9vbF9jYWxscxgGIAMoCzIyLmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvZGVpdW1Db21tb25QYl9DaGF0VG9vbENhbGwSRAoFdXNhZ2UYByABKAsyNS5leGEuYXBpX3NlcnZlcl9wYi5FeGFDb2RlaXVtQ29tbW9uUGJfTW9kZWxVc2FnZVN0YXRzEhYKDmRlbHRhX3RoaW5raW5nGAkgASgJEhcKD2RlbHRhX3NpZ25hdHVyZRgKIAEoCRIZChF0aGlua2luZ19yZWRhY3RlZBgLIAEoCBIYChBhY3R1YWxfbW9kZWxfdWlkGBcgASgJImEKHUdldENhc2NhZGVNb2RlbENvbmZpZ3NSZXF1ZXN0EkAKCG1ldGFkYXRhGAEgASgLMi4uZXhhLmFwaV9zZXJ2ZXJfcGIuRXhhQ29kZWl1bUNvbW1vblBiX01ldGFkYXRhIncKHkdldENhc2NhZGVNb2RlbENvbmZpZ3NSZXNwb25zZRJVChRjbGllbnRfbW9kZWxfY29uZmlncxgBIAMoCzI3LmV4YS5hcGlfc2VydmVyX3BiLkV4YUNvZGVpdW1Db21tb25QYl9DbGllbnRNb2RlbENvbmZpZypqChZDaGF0TWVzc2FnZVJlcXVlc3RUeXBlEikKJUNIQVRfTUVTU0FHRV9SRVFVRVNUX1RZUEVfVU5TUEVDSUZJRUQQABIlCiFDSEFUX01FU1NBR0VfUkVRVUVTVF9UWVBFX0NBU0NBREUQBSq7AgokRXhhQ29kZWl1bUNvbW1vblBiX0NoYXRNZXNzYWdlU291cmNlEkgKREV4YUNvZGVpdW1Db21tb25QYl9DaGF0TWVzc2FnZVNvdXJjZV9DSEFUX01FU1NBR0VfU09VUkNFX1VOU1BFQ0lGSUVEEAASQQo9RXhhQ29kZWl1bUNvbW1vblBiX0NoYXRNZXNzYWdlU291cmNlX0NIQVRfTUVTU0FHRV9TT1VSQ0VfVVNFUhABEkMKP0V4YUNvZGVpdW1Db21tb25QYl9DaGF0TWVzc2FnZVNvdXJjZV9DSEFUX01FU1NBR0VfU09VUkNFX1NZU1RFTRACEkEKPUV4YUNvZGVpdW1Db21tb25QYl9DaGF0TWVzc2FnZVNvdXJjZV9DSEFUX01FU1NBR0VfU09VUkNFX1RPT0wQBCreAQosRXhhQ29kZWl1bUNvbW1vblBiX0NvbnZlcnNhdGlvbmFsUGxhbm5lck1vZGUSWApURXhhQ29kZWl1bUNvbW1vblBiX0NvbnZlcnNhdGlvbmFsUGxhbm5lck1vZGVfQ09OVkVSU0FUSU9OQUxfUExBTk5FUl9NT0RFX1VOU1BFQ0lGSUVEEAASVApQRXhhQ29kZWl1bUNvbW1vblBiX0NvbnZlcnNhdGlvbmFsUGxhbm5lck1vZGVfQ09OVkVSU0FUSU9OQUxfUExBTk5FUl9NT0RFX0RFRkFVTFQQASqwAQogRXhhQ29ydGV4UGJfQ29ydGV4VHJhamVjdG9yeVR5cGUSRwpDRXhhQ29ydGV4UGJfQ29ydGV4VHJhamVjdG9yeVR5cGVfQ09SVEVYX1RSQUpFQ1RPUllfVFlQRV9VTlNQRUNJRklFRBAAEkMKP0V4YUNvcnRleFBiX0NvcnRleFRyYWplY3RvcnlUeXBlX0NPUlRFWF9UUkFKRUNUT1JZX1RZUEVfQ0FTQ0FERRAEKpUBChpFeGFDb3J0ZXhQYl9Db3J0ZXhTdGVwVHlwZRI7CjdFeGFDb3J0ZXhQYl9Db3J0ZXhTdGVwVHlwZV9DT1JURVhfU1RFUF9UWVBFX1VOU1BFQ0lGSUVEEAASOgo2RXhhQ29ydGV4UGJfQ29ydGV4U3RlcFR5cGVfQ09SVEVYX1NURVBfVFlQRV9VU0VSX0lOUFVUEA4q9wIKHUV4YUNvZGVpdW1Db21tb25QYl9TdG9wUmVhc29uEjkKNUV4YUNvZGVpdW1Db21tb25QYl9TdG9wUmVhc29uX1NUT1BfUkVBU09OX1VOU1BFQ0lGSUVEEAASOAo0RXhhQ29kZWl1bUNvbW1vblBiX1N0b3BSZWFzb25fU1RPUF9SRUFTT05fSU5DT01QTEVURRABEjgKNEV4YUNvZGVpdW1Db21tb25QYl9TdG9wUmVhc29uX1NUT1BfUkVBU09OX01BWF9UT0tFTlMQAxI1CjFFeGFDb2RlaXVtQ29tbW9uUGJfU3RvcFJlYXNvbl9TVE9QX1JFQVNPTl9QQVJUSUFMEAkSOwo3RXhhQ29kZWl1bUNvbW1vblBiX1N0b3BSZWFzb25fU1RPUF9SRUFTT05fRlVOQ1RJT05fQ0FMTBAKEjMKL0V4YUNvZGVpdW1Db21tb25QYl9TdG9wUmVhc29uX1NUT1BfUkVBU09OX0VSUk9SEA0qnAIKIEV4YUNvZGVpdW1Db21tb25QYl9Nb2RlbFByb3ZpZGVyEj8KO0V4YUNvZGVpdW1Db21tb25QYl9Nb2RlbFByb3ZpZGVyX01PREVMX1BST1ZJREVSX1VOU1BFQ0lGSUVEEAASPAo4RXhhQ29kZWl1bUNvbW1vblBiX01vZGVsUHJvdmlkZXJfTU9ERUxfUFJPVklERVJfV0lORFNVUkYQARI6CjZFeGFDb2RlaXVtQ29tbW9uUGJfTW9kZWxQcm92aWRlcl9NT0RFTF9QUk9WSURFUl9PUEVOQUkQAhI9CjlFeGFDb2RlaXVtQ29tbW9uUGJfTW9kZWxQcm92aWRlcl9NT0RFTF9QUk9WSURFUl9BTlRIUk9QSUMQAzL6AQoQQXBpU2VydmVyU2VydmljZRJnCg5HZXRDaGF0TWVzc2FnZRIoLmV4YS5hcGlfc2VydmVyX3BiLkdldENoYXRNZXNzYWdlUmVxdWVzdBopLmV4YS5hcGlfc2VydmVyX3BiLkdldENoYXRNZXNzYWdlUmVzcG9uc2UwARJ9ChZHZXRDYXNjYWRlTW9kZWxDb25maWdzEjAuZXhhLmFwaV9zZXJ2ZXJfcGIuR2V0Q2FzY2FkZU1vZGVsQ29uZmlnc1JlcXVlc3QaMS5leGEuYXBpX3NlcnZlcl9wYi5HZXRDYXNjYWRlTW9kZWxDb25maWdzUmVzcG9uc2U");
/**
* Describes the message exa.api_server_pb.ExaCodeiumCommonPb_Metadata.
* Use `create(ExaCodeiumCommonPb_MetadataSchema)` to create a new message.
*/
const ExaCodeiumCommonPb_MetadataSchema = /*@__PURE__*/ messageDesc(file_devin, 1);
/**
* Describes the message exa.api_server_pb.ExaCodeiumCommonPb_CompletionConfiguration.
* Use `create(ExaCodeiumCommonPb_CompletionConfigurationSchema)` to create a new message.
*/
const ExaCodeiumCommonPb_CompletionConfigurationSchema = /*@__PURE__*/ messageDesc(file_devin, 2);
/**
* Describes the message exa.api_server_pb.ExaCodeiumCommonPb_ChatToolCall.
* Use `create(ExaCodeiumCommonPb_ChatToolCallSchema)` to create a new message.
*/
const ExaCodeiumCommonPb_ChatToolCallSchema = /*@__PURE__*/ messageDesc(file_devin, 4);
/**
* Describes the message exa.api_server_pb.ExaChatPb_ChatToolDefinition.
* Use `create(ExaChatPb_ChatToolDefinitionSchema)` to create a new message.
*/
const ExaChatPb_ChatToolDefinitionSchema = /*@__PURE__*/ messageDesc(file_devin, 5);
/**
* Describes the message exa.api_server_pb.ExaChatPb_ChatMessagePrompt.
* Use `create(ExaChatPb_ChatMessagePromptSchema)` to create a new message.
*/
const ExaChatPb_ChatMessagePromptSchema = /*@__PURE__*/ messageDesc(file_devin, 6);
/**
* Describes the message exa.api_server_pb.ExaCortexPb_CortexTrajectoryReference.
* Use `create(ExaCortexPb_CortexTrajectoryReferenceSchema)` to create a new message.
*/
const ExaCortexPb_CortexTrajectoryReferenceSchema = /*@__PURE__*/ messageDesc(file_devin, 7);
/**
* Describes the message exa.api_server_pb.GetChatMessageRequest.
* Use `create(GetChatMessageRequestSchema)` to create a new message.
*/
const GetChatMessageRequestSchema = /*@__PURE__*/ messageDesc(file_devin, 12);
/**
* Describes the message exa.api_server_pb.GetCascadeModelConfigsRequest.
* Use `create(GetCascadeModelConfigsRequestSchema)` to create a new message.
*/
const GetCascadeModelConfigsRequestSchema = /*@__PURE__*/ messageDesc(file_devin, 14);
/**
* @generated from service exa.api_server_pb.ApiServerService
*/
const ApiServerService = /*@__PURE__*/ serviceDesc(file_devin, 0);
//#endregion
//#region src/proto/gen/seat_pb.ts
/**
* Describes the file seat.proto.
*/
const file_seat = /*@__PURE__*/ fileDesc("CgpzZWF0LnByb3RvEhZleGEuc2VhdF9tYW5hZ2VtZW50X3BiIlgKFEdldFVzZXJTdGF0dXNSZXF1ZXN0EkAKCG1ldGFkYXRhGAEgASgLMi4uZXhhLmFwaV9zZXJ2ZXJfcGIuRXhhQ29kZWl1bUNvbW1vblBiX01ldGFkYXRhIoUBChVHZXRVc2VyU3RhdHVzUmVzcG9uc2USNwoLdXNlcl9zdGF0dXMYASABKAsyIi5leGEuc2VhdF9tYW5hZ2VtZW50X3BiLlVzZXJTdGF0dXMSMwoJcGxhbl9pbmZvGAIgASgLMiAuZXhhLnNlYXRfbWFuYWdlbWVudF9wYi5QbGFuSW5mbyJFCgpVc2VyU3RhdHVzEjcKC3BsYW5fc3RhdHVzGA0gASgLMiIuZXhhLnNlYXRfbWFuYWdlbWVudF9wYi5QbGFuU3RhdHVzItcBCgpQbGFuU3RhdHVzEjMKCXBsYW5faW5mbxgBIAEoCzIgLmV4YS5zZWF0X21hbmFnZW1lbnRfcGIuUGxhbkluZm8SJQodZGFpbHlfcXVvdGFfcmVtYWluaW5nX3BlcmNlbnQYDiABKAUSJgoed2Vla2x5X3F1b3RhX3JlbWFpbmluZ19wZXJjZW50GA8gASgFEiEKGWRhaWx5X3F1b3RhX3Jlc2V0X2F0X3VuaXgYESABKAMSIgoad2Vla2x5X3F1b3RhX3Jlc2V0X2F0X3VuaXgYEiABKAMiggEKCFBsYW5JbmZvEkEKEGJpbGxpbmdfc3RyYXRlZ3kYIyABKA4yJy5leGEuc2VhdF9tYW5hZ2VtZW50X3BiLkJpbGxpbmdTdHJhdGVneRIYChBoaWRlX2RhaWx5X3F1b3RhGCQgASgIEhkKEWhpZGVfd2Vla2x5X3F1b3RhGCUgASgIKocBCg9CaWxsaW5nU3RyYXRlZ3kSIAocQklMTElOR19TVFJBVEVHWV9VTlNQRUNJRklFRBAAEhwKGEJJTExJTkdfU1RSQVRFR1lfQ1JFRElUUxABEhoKFkJJTExJTkdfU1RSQVRFR1lfUVVPVEEQAhIYChRCSUxMSU5HX1NUUkFURUdZX0FDVRADMoUBChVTZWF0TWFuYWdlbWVudFNlcnZpY2USbAoNR2V0VXNlclN0YXR1cxIsLmV4YS5zZWF0X21hbmFnZW1lbnRfcGIuR2V0VXNlclN0YXR1c1JlcXVlc3QaLS5leGEuc2VhdF9tYW5hZ2VtZW50X3BiLkdldFVzZXJTdGF0dXNSZXNwb25zZWIGcHJvdG8z", [file_devin]);
/**
* Describes the message exa.seat_management_pb.GetUserStatusRequest.
* Use `create(GetUserStatusRequestSchema)` to create a new message.
*/
const GetUserStatusRequestSchema = /*@__PURE__*/ messageDesc(file_seat, 0);
/**
* @generated from service exa.seat_management_pb.SeatManagementService
*/
const SeatManagementService = /*@__PURE__*/ serviceDesc(file_seat, 0);
//#endregion
//#region src/adapter/transport.ts
/**
* 创建 Connect transport，注入 Devin Basic auth header 并支持代理。
*/
function createDevinTransport(config) {
	const agent = createProxyAgent(config.proxy, config.baseUrl);
	const interceptors = [authInterceptor(config.token)];
	const transportOptions = {
		baseUrl: config.baseUrl,
		interceptors,
		nodeOptions: agent ? { agent } : void 0
	};
	if (config.forceHttp1) transportOptions.httpVersion = "1.1";
	else transportOptions.httpVersion = "2";
	return createConnectTransport(transportOptions);
}
/**
* Auth 拦截器：注入 Authorization: Basic <token>-<token>。
* 与 Go authTransport 行为一致。
*/
function authInterceptor(token) {
	return (next) => async (req) => {
		req.header.set("Authorization", `Basic ${token}-${token}`);
		return next(req);
	};
}
/**
* 根据代理 URL 创建合适的 Agent。
* 支持 http://, https://, socks5://, socks5h:// 协议。
*/
function createProxyAgent(proxyUrl, baseUrl) {
	if (!proxyUrl) return void 0;
	baseUrl.startsWith("https://");
	const protocol = new URL(proxyUrl).protocol;
	if (protocol === "http:" || protocol === "https:") return new HttpsProxyAgent(proxyUrl);
	if (protocol === "socks5:" || protocol === "socks5h:") return new SocksProxyAgent(proxyUrl);
	throw new Error(`unsupported proxy protocol: ${protocol}`);
}
//#endregion
//#region src/adapter/decoder.ts
var DevinStreamDecoder = class {
	nextIndex = 0;
	textIndex = -1;
	textStarted = false;
	textBuilder = "";
	reasoningIndex = -1;
	reasoningStarted = false;
	reasoningBuilder = "";
	tools = [];
	currentUsage = null;
	stopReason = 0;
	finished = false;
	decode(response) {
		const chunks = [];
		if (!response || this.finished) return chunks;
		const usage = response.usage;
		if (usage) {
			const u = {
				inputTokens: Number(usage.inputTokens),
				outputTokens: Number(usage.outputTokens)
			};
			if (usage.cacheReadTokens) u.cacheReadTokens = Number(usage.cacheReadTokens);
			if (usage.cacheWriteTokens) u.cacheWriteTokens = Number(usage.cacheWriteTokens);
			this.currentUsage = u;
		}
		if (response.deltaThinking || response.deltaSignature || response.thinkingRedacted) {
			if (!this.reasoningStarted) {
				this.reasoningIndex = this.nextIndex++;
				this.reasoningStarted = true;
				this.reasoningBuilder = "";
				chunks.push({
					type: "block-start",
					index: this.reasoningIndex,
					blockType: "reasoning"
				});
			}
			if (response.deltaThinking) {
				this.reasoningBuilder += response.deltaThinking;
				chunks.push({
					type: "reasoning-delta",
					index: this.reasoningIndex,
					text: response.deltaThinking
				});
			}
		}
		if (response.deltaText) {
			if (this.reasoningStarted) {
				chunks.push({
					type: "block-end",
					index: this.reasoningIndex,
					block: {
						type: "reasoning",
						text: this.reasoningBuilder
					}
				});
				this.reasoningStarted = false;
			}
			if (!this.textStarted) {
				this.textIndex = this.nextIndex++;
				this.textStarted = true;
				this.textBuilder = "";
				chunks.push({
					type: "block-start",
					index: this.textIndex,
					blockType: "text"
				});
			}
			this.textBuilder += response.deltaText;
			chunks.push({
				type: "text-delta",
				index: this.textIndex,
				text: response.deltaText
			});
		}
		for (const delta of response.deltaToolCalls) {
			if (this.reasoningStarted) {
				chunks.push({
					type: "block-end",
					index: this.reasoningIndex,
					block: {
						type: "reasoning",
						text: this.reasoningBuilder
					}
				});
				this.reasoningStarted = false;
			}
			if (this.textStarted) {
				chunks.push({
					type: "block-end",
					index: this.textIndex,
					block: {
						type: "text",
						text: this.textBuilder
					}
				});
				this.textStarted = false;
			}
			let state = this.findTool(delta.id);
			if (!state) {
				state = {
					callId: ToolCallId(delta.id || `call_${this.tools.length}`),
					name: delta.name || "",
					arguments: "",
					blockIndex: this.nextIndex++,
					started: false,
					ended: false
				};
				this.tools.push(state);
			}
			if (delta.id) state.callId = ToolCallId(delta.id);
			if (delta.name) state.name = delta.name;
			if (!state.started) {
				state.started = true;
				chunks.push({
					type: "block-start",
					index: state.blockIndex,
					blockType: "tool-call"
				});
				chunks.push({
					type: "tool-call-delta",
					index: state.blockIndex,
					id: state.callId,
					name: state.name,
					argumentsDelta: ""
				});
			}
			if (delta.argumentsJson) {
				state.arguments += delta.argumentsJson;
				chunks.push({
					type: "tool-call-delta",
					index: state.blockIndex,
					id: state.callId,
					argumentsDelta: delta.argumentsJson
				});
			}
		}
		if (response.stopReason !== 0) this.stopReason = response.stopReason;
		return chunks;
	}
	finish(upstreamError) {
		const chunks = [];
		if (this.finished) return chunks;
		this.finished = true;
		if (upstreamError) {
			chunks.push({
				type: "finish",
				reason: {
					kind: "error",
					failure: {
						message: upstreamError.message || String(upstreamError),
						code: "TRANSPORT"
					}
				}
			});
			return chunks;
		}
		if (this.reasoningStarted) chunks.push({
			type: "block-end",
			index: this.reasoningIndex,
			block: {
				type: "reasoning",
				text: this.reasoningBuilder
			}
		});
		if (this.textStarted) chunks.push({
			type: "block-end",
			index: this.textIndex,
			block: {
				type: "text",
				text: this.textBuilder
			}
		});
		for (const state of this.tools) if (!state.ended) {
			state.ended = true;
			const block = {
				type: "tool-call",
				id: state.callId,
				name: state.name,
				arguments: isJSONObject(state.arguments) ? state.arguments : "{}"
			};
			chunks.push({
				type: "block-end",
				index: state.blockIndex,
				block
			});
		}
		if (this.currentUsage) chunks.push({
			type: "usage",
			usage: this.currentUsage
		});
		chunks.push({
			type: "finish",
			reason: mapFinishReason(this.stopReason)
		});
		return chunks;
	}
	findTool(id) {
		if (id) return this.tools.find((t) => t.callId === id);
		if (this.tools.length > 0) return this.tools[this.tools.length - 1];
	}
};
function isJSONObject(value) {
	try {
		const parsed = JSON.parse(value);
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
	} catch {
		return false;
	}
}
function mapFinishReason(reason) {
	switch (reason) {
		case 3:
		case 1:
		case 9: return { kind: "max-tokens" };
		case 10: return { kind: "tool-calls" };
		case 13: return {
			kind: "error",
			failure: {
				message: "Devin stopped with an error",
				code: "SERVER"
			}
		};
		default: return { kind: "stop" };
	}
}
function connectErrorCode(message) {
	const colonIdx = message.indexOf(":");
	if (colonIdx >= 0) {
		const code = message.slice(0, colonIdx).trim();
		const known = {
			invalid_argument: "INVALID_REQUEST",
			failed_precondition: "INVALID_REQUEST",
			out_of_range: "INVALID_REQUEST",
			unimplemented: "INVALID_REQUEST",
			unauthenticated: "AUTH",
			permission_denied: "AUTH",
			not_found: "NOT_FOUND",
			resource_exhausted: "RATE_LIMIT",
			deadline_exceeded: "TIMEOUT",
			unavailable: "SERVER",
			internal: "SERVER",
			unknown: "SERVER"
		};
		if (known[code]) return known[code];
	}
	return "TRANSPORT";
}
function wrapConnectError(err) {
	if (err instanceof LlmError) return err;
	const message = err instanceof Error ? err.message : String(err);
	return new LlmError(`Devin API: ${message}`, connectErrorCode(message), { cause: err });
}
//#endregion
//#region src/adapter/devin.ts
const CLIENT_NAME = "chisel";
const CLIENT_VERSION = "3000.2.17";
function devinMetadata(token, fingerprint) {
	return create(ExaCodeiumCommonPb_MetadataSchema, {
		apiKey: token,
		extensionName: CLIENT_NAME,
		extensionVersion: CLIENT_VERSION,
		ideName: CLIENT_NAME,
		ideVersion: CLIENT_VERSION,
		locale: "en",
		os: "win",
		f: fingerprint
	});
}
function usageWindow(remainingPercent, resetAtUnix) {
	if (resetAtUnix <= 0n || !Number.isInteger(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) return;
	const resetAt = /* @__PURE__ */ new Date(Number(resetAtUnix) * 1e3);
	if (!Number.isFinite(resetAt.valueOf())) return void 0;
	return {
		remainingPercent,
		resetAt: resetAt.toISOString()
	};
}
const PROVIDER$1 = "devin";
/** dsh effort id → Devin model_uid 后缀。 */
const EFFORT_SUFFIX = {
	high: "",
	medium: "-medium",
	max: "-max",
	none: "-none"
};
/** dsh reasoning effort 列表（供 resolveModel 返回给 dsh 显示滑块）。 */
const REASONING_EFFORTS = [
	{
		id: ReasoningEffortId("high"),
		name: "High"
	},
	{
		id: ReasoningEffortId("medium"),
		name: "Medium"
	},
	{
		id: ReasoningEffortId("max"),
		name: "Max"
	},
	{
		id: ReasoningEffortId("none"),
		name: "No Thinking"
	}
];
/**
* 把 base model id + reasoningEffort 映射到 Devin 实际 model_uid。
* 如 glm-5-2 + max → glm-5-2-max，swe-1-7 + medium → swe-1-7-medium。
* 如果映射后的 uid 不在已知模型列表里，回退到 base id。
*/
function resolveModelUid(baseId, effort, knownIds) {
	if (!effort) return baseId;
	const suffix = EFFORT_SUFFIX[effort];
	if (suffix === void 0) return baseId;
	const mapped = suffix ? `${baseId}${suffix}` : baseId;
	return knownIds.has(mapped) ? mapped : baseId;
}
/** 格式化发现结果的名称和 Devin 返回的额度倍率。 */
function formatDiscoveredName(m) {
	const parts = [m.name ?? m.id];
	if (m.isPromo) parts.push("[Promo]");
	else if (m.isPremium) parts.push("[Premium]");
	if (m.creditMultiplier && m.creditMultiplier > 0) parts.push(`(${m.creditMultiplier}x)`);
	return parts.join(" ");
}
var DevinAdapter = class extends LlmAdapter {
	config;
	cachedClients = null;
	cachedClientKey = "";
	constructor(options) {
		super();
		this.config = options;
	}
	/** 当前连接配置（每次调用读取最新值）。 */
	conn() {
		return this.config.options();
	}
	/** 根据同一套连接参数创建聊天和账号客户端。 */
	clients(c) {
		const key = `${c.baseUrl}\0${c.token}\0${c.proxy ?? ""}\0${c.forceHttp1}`;
		if (this.cachedClients !== null && this.cachedClientKey === key) return this.cachedClients;
		const transport = createDevinTransport({
			baseUrl: c.baseUrl,
			token: c.token,
			proxy: c.proxy,
			forceHttp1: c.forceHttp1
		});
		this.cachedClients = {
			apiServer: createClient(ApiServerService, transport),
			seatManagement: createClient(SeatManagementService, transport)
		};
		this.cachedClientKey = key;
		return this.cachedClients;
	}
	client(c = this.conn()) {
		return this.clients(c).apiServer;
	}
	seatClient(c) {
		return this.clients(c).seatManagement;
	}
	providerInfo(_provider) {
		return {
			id: PROVIDER$1,
			name: "Devin"
		};
	}
	async listModels(_provider) {
		return this.conn().models.map((m) => ({
			provider: PROVIDER$1,
			id: m.id,
			name: m.name ?? m.id,
			...m.description ? { description: m.description } : {},
			...m.supportsImages ? { inputModalities: ["text", "image"] } : { inputModalities: ["text"] }
		}));
	}
	async resolveModel(_provider, model, _signal) {
		const c = this.conn();
		const configured = c.models.find((m) => m.id === model);
		const contextWindow = configured?.contextWindow ?? c.defaultContextWindow;
		return {
			provider: PROVIDER$1,
			id: model,
			name: configured?.name ?? model,
			...configured?.description ? { description: configured.description } : {},
			...configured?.supportsImages ? { inputModalities: ["text", "image"] } : { inputModalities: ["text"] },
			context: { contextWindow },
			defaultMaxTokens: configured?.maxTokens ?? c.defaultMaxTokens,
			reasoning: {
				efforts: REASONING_EFFORTS,
				defaultEffort: ReasoningEffortId("high")
			}
		};
	}
	/** 将当前可用模型投影为 DSH 的模型发现格式。 */
	async discoverModels(signal) {
		return (await this.fetchModelCatalog(signal)).map((m) => ({
			id: m.id,
			name: formatDiscoveredName(m),
			...m.contextWindow ? { contextWindow: m.contextWindow } : {},
			...m.maxTokens ? { maxTokens: m.maxTokens } : {}
		}));
	}
	/**
	* 读取当前账号的目录。每个系列保留一个可选变体及其真实模型 ID，
	* 优先选择 Devin 指定的默认或推荐变体。
	*/
	async fetchModelCatalog(signal) {
		const c = this.conn();
		const request = create(GetCascadeModelConfigsRequestSchema, { metadata: devinMetadata(c.token) });
		const response = await this.client(c).getCascadeModelConfigs(request, {
			signal,
			timeoutMs: 15e3
		});
		const families = /* @__PURE__ */ new Map();
		const seen = /* @__PURE__ */ new Set();
		for (const config of response.clientModelConfigs) {
			if (config.disabled) continue;
			const uid = config.modelUid;
			if (!uid || seen.has(uid)) continue;
			seen.add(uid);
			const family = config.modelFamilyMetadata?.modelFamilyLabel || void 0;
			const key = family ? `family:${family}` : `id:${uid}`;
			const isDefault = config.modelFamilyMetadata?.isDefaultModelInFamily === true;
			const rank = Number(isDefault) * 4 + Number(config.isRecommended === true) * 2 - Number(config.isCapacityLimited === true) * 8;
			const current = families.get(key);
			if (current && current.rank >= rank) continue;
			const model = {
				id: uid,
				...config.label ? { name: config.label } : {},
				...config.description ? { description: config.description } : {},
				...config.maxTokens > 0 ? {
					contextWindow: config.maxTokens,
					maxTokens: Math.min(config.maxTokens, c.defaultMaxTokens)
				} : {},
				supportsImages: config.supportsImages,
				...family ? { family } : {},
				isDefault,
				isRecommended: config.isRecommended,
				isNew: config.isNew,
				isPremium: config.isPremium,
				isPromo: config.promoStatus?.isActive === true,
				...config.creditMultiplier > 0 ? { creditMultiplier: config.creditMultiplier } : {}
			};
			families.set(key, {
				model,
				rank
			});
		}
		return [...families.values()].map(({ model }) => model);
	}
	/** 返回该账号可见的额度窗口。没有日／周额度的计划返回空对象。 */
	async fetchUsage(signal) {
		const c = this.conn();
		const request = create(GetUserStatusRequestSchema, { metadata: devinMetadata(c.token) });
		const response = await this.seatClient(c).getUserStatus(request, {
			signal,
			timeoutMs: 15e3
		});
		const status = response.userStatus?.planStatus;
		const plan = response.planInfo ?? status?.planInfo;
		if (!status || plan?.billingStrategy !== 2) return {};
		const daily = plan.hideDailyQuota ? void 0 : usageWindow(status.dailyQuotaRemainingPercent, status.dailyQuotaResetAtUnix);
		const weekly = plan.hideWeeklyQuota ? void 0 : usageWindow(status.weeklyQuotaRemainingPercent, status.weeklyQuotaResetAtUnix);
		return {
			...daily ? { daily } : {},
			...weekly ? { weekly } : {}
		};
	}
	async *stream(options) {
		let protoRequest;
		try {
			protoRequest = await this.buildRequest(options);
		} catch (err) {
			throw new LlmError(`Devin request build failed: ${err instanceof Error ? err.message : String(err)}`, "INVALID_REQUEST", { cause: err });
		}
		let serverStream;
		try {
			serverStream = await this.client().getChatMessage(protoRequest);
		} catch (err) {
			throw wrapConnectError(err);
		}
		const decoder = new DevinStreamDecoder();
		const iterator = serverStream[Symbol.asyncIterator]();
		let upstreamError = null;
		try {
			while (true) {
				let result;
				try {
					result = await iterator.next();
				} catch (err) {
					upstreamError = err instanceof Error ? err : new Error(String(err));
					break;
				}
				if (result.done) break;
				if (result.value) yield* decoder.decode(result.value);
			}
		} finally {
			if (typeof iterator.return === "function") try {
				await iterator.return();
			} catch {}
		}
		yield* decoder.finish(upstreamError);
	}
	async buildRequest(options) {
		const c = this.conn();
		const { messages, tools } = projectToolUpdates(options.messages, options.tools, void 0, options.toolHistory);
		const system = [options.system, ...messages.filter((message) => message.role === "system").map((message) => message.content.filter((block) => block.type === "text").map((block) => block.text).join(""))].filter(Boolean).join("\n\n");
		const fingerprint = randomHex(366);
		const trajectoryID = randomUUID();
		const cascadeID = randomUUID();
		const executionID = randomUUID();
		const metadata = devinMetadata(c.token, fingerprint);
		const knownIds = new Set(c.models.map((m) => m.id));
		const effortId = options.reasoningEffort;
		const actualModelUid = resolveModelUid(options.model, effortId, knownIds);
		const result = create(GetChatMessageRequestSchema, {
			metadata,
			prompt: sanitizeSystemPrompt(withToolDescriptions(system, tools)),
			chatModelUid: actualModelUid,
			requestType: 5,
			configuration: create(ExaCodeiumCommonPb_CompletionConfigurationSchema, {
				numCompletions: 1n,
				maxTokens: BigInt(options.maxTokens ?? c.defaultMaxTokens),
				maxNewlines: 400n,
				temperature: options.temperature ?? 1,
				topK: 40n,
				topP: .95
			}),
			trajectoryReference: create(ExaCortexPb_CortexTrajectoryReferenceSchema, {
				trajectoryId: trajectoryID,
				trajectoryType: 4,
				stepType: 14
			}),
			cascadeId: cascadeID,
			plannerMode: 1,
			executionId: executionID
		});
		let lastAssistantIndex = -1;
		for (let i = 0; i < messages.length; i++) if (messages[i].role === "assistant") lastAssistantIndex = i;
		for (let i = 0; i < messages.length; i++) {
			const message = messages[i];
			if (message.role === "system") continue;
			const converted = await this.convertMessage(message, i > lastAssistantIndex, options.signal);
			result.chatMessagePrompts.push(...converted);
		}
		if (tools) for (const tool of tools) result.tools.push(convertToolDefinition(tool));
		return result;
	}
	async convertMessage(message, attachImages, signal) {
		if (message.role === "tool") {
			const prompt = await this.promptForContent(4, message.content, attachImages, signal);
			prompt.toolCallId = message.toolCallId;
			prompt.toolResultIsError = message.isError ?? false;
			return [prompt];
		}
		if (message.role === "assistant") {
			const prompt = await this.promptForContent(2, message.content, false, signal);
			for (const block of message.content) if (block.type === "tool-call") prompt.toolCalls.push(create(ExaCodeiumCommonPb_ChatToolCallSchema, {
				id: block.id,
				name: block.name,
				argumentsJson: block.arguments
			}));
			return [prompt];
		}
		return [await this.promptForContent(1, message.content, attachImages, signal)];
	}
	async promptForContent(source, content, attachImages, signal) {
		const prompt = create(ExaChatPb_ChatMessagePromptSchema, {
			messageId: randomUUID(),
			source
		});
		let text = "";
		for (const block of content) switch (block.type) {
			case "text":
				text += block.text;
				break;
			case "reasoning":
				prompt.thinking = block.text;
				prompt.thinkingRedacted = false;
				break;
			case "image":
				if (!attachImages) {
					if (text.length > 0) text += "\n";
					text += "[Image omitted from history]";
					break;
				}
				const readImage = this.conn().readImage;
				if (!readImage) throw new LlmError("Devin adapter received an image but no attachment store is available", "INVALID_REQUEST");
				try {
					const stored = await readImage(block.attachment, signal);
					const base64 = Buffer.from(stored.data).toString("base64");
					const mimeType = stored.ref.mediaType;
					prompt.images.push({
						base64Data: base64,
						mimeType
					});
				} catch (err) {
					throw new LlmError(`Failed to read image attachment: ${err instanceof Error ? err.message : String(err)}`, "INVALID_REQUEST", { cause: err });
				}
		}
		prompt.prompt = text;
		return prompt;
	}
};
function convertToolDefinition(tool) {
	const schema = stripSchemaAnnotations(tool.parameters);
	return create(ExaChatPb_ChatToolDefinitionSchema, {
		name: tool.name,
		description: tool.description || tool.name,
		jsonSchemaString: schema
	});
}
function stripSchemaAnnotations(schema) {
	try {
		const cleaned = stripSchemaValueAnnotations(schema, false);
		return JSON.stringify(cleaned);
	} catch {
		return JSON.stringify(schema);
	}
}
function stripSchemaValueAnnotations(value, propertyNames) {
	if (Array.isArray(value)) return value.map((item) => stripSchemaValueAnnotations(item, false));
	if (value !== null && typeof value === "object") {
		const cleaned = {};
		for (const [key, child] of Object.entries(value)) {
			if (isNaturalLanguageAnnotation(key) && !propertyNames) continue;
			if (isSchemaLiteral(key) && !propertyNames) {
				cleaned[key] = child;
				continue;
			}
			cleaned[key] = stripSchemaValueAnnotations(child, key === "properties");
		}
		return cleaned;
	}
	return value;
}
function isSchemaLiteral(key) {
	return [
		"const",
		"default",
		"enum",
		"example",
		"examples"
	].includes(key);
}
function isNaturalLanguageAnnotation(key) {
	if ([
		"description",
		"title",
		"$comment"
	].includes(key)) return true;
	return key.toLowerCase().startsWith("x-");
}
const IDENTITY_REPLACEMENTS = [
	{
		pattern: /You are Claude Code, Anthropic's official CLI for Claude/gi,
		replace: "You are an AI coding assistant"
	},
	{
		pattern: /Claude Code is available as a CLI in the terminal, desktop app/gi,
		replace: "The assistant is available as a CLI in the terminal, desktop tool"
	},
	{
		pattern: /Fast mode for Claude Code uses Claude Opus/gi,
		replace: "Fast mode uses the faster output model"
	},
	{
		pattern: /The most recent Claude models are the Claude 5 family/gi,
		replace: "The most recent models are the latest family"
	},
	{
		pattern: /default to the latest and most capable Claude models/gi,
		replace: "default to the latest and most capable models"
	},
	{
		pattern: /IMPORTANT: Assist with authorized security testing[\s\S]*?defensive use cases/g,
		replace: "IMPORTANT: Assist with authorized security testing and educational contexts. Refuse harmful requests. Dual-use tools require clear authorization context"
	}
];
function sanitizeSystemPrompt(prompt) {
	for (const { pattern, replace } of IDENTITY_REPLACEMENTS) prompt = prompt.replace(pattern, replace);
	return prompt;
}
function withToolDescriptions(systemPrompt, tools) {
	if (!tools || tools.length === 0) return systemPrompt;
	let section = "";
	for (const tool of tools) {
		const description = tool.description.trim();
		if (!description) continue;
		if (!section) section = "# tools descriptions";
		section += `\n<tool name="${escapeXMLAttribute(tool.name)}">\n`;
		section += escapeXMLText(description);
		section += "\n</tool>";
	}
	if (!section) return systemPrompt;
	const trimmed = systemPrompt.replace(/[\r\n]+$/, "");
	if (!trimmed.trim()) return section;
	return `${trimmed}\n\n${section}`;
}
function escapeXMLAttribute(value) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function escapeXMLText(value) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function randomHex(size) {
	return randomBytes(size).toString("hex");
}
/**
* Devin CLI credentials.toml 的平台相关路径。
* 支持环境变量 DEVIN_CREDENTIALS_PATH 覆盖。
*/
function devinCredentialsPath() {
	if (process.env.DEVIN_CREDENTIALS_PATH) return process.env.DEVIN_CREDENTIALS_PATH;
	if (platform() === "win32") {
		const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
		return join(appData, "devin", "credentials.toml");
	}
	const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
	return join(dataHome, "devin", "credentials.toml");
}
/**
* 从 credentials.toml 解析 Devin session。
* 使用轻量 TOML 扫描器而非完整 TOML 库，避免引入额外依赖。
* 只读取顶层 string key，拒绝重复 key 和多行值。
*/
function devinSessionEntry(contents) {
	const table = scanTomlTopLevel(contents);
	const apiKey = table["windsurf_api_key"];
	if (typeof apiKey !== "string" || !apiKey) return void 0;
	return {
		apiKey,
		apiServerUrl: table["api_server_url"] || "https://server.codeium.com",
		...table["devin_api_url"] ? { devinApiUrl: table["devin_api_url"] } : {}
	};
}
/**
* 尝试从 Devin CLI 的 credentials.toml 读取 session。
* 文件不存在或格式无效时返回 undefined，不抛异常。
*/
function readDevinSession(options) {
	const path = options?.credentialsPath ?? devinCredentialsPath();
	if (!existsSync(path)) return void 0;
	let contents;
	try {
		contents = readFileSync(path, "utf8");
	} catch {
		return;
	}
	try {
		return devinSessionEntry(contents);
	} catch {
		return;
	}
}
/**
* 扫描 TOML 文件的顶层 string key=value 对。
* 只支持 `key = "value"` 形式，不支持 table、array、多行字符串等复杂结构。
* 重复 key 抛异常（fail-closed）。
*/
function scanTomlTopLevel(contents) {
	const result = {};
	const lines = contents.split("\n");
	let inTable = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line === "" || line.startsWith("#")) continue;
		if (line.startsWith("[")) {
			inTable = true;
			continue;
		}
		if (inTable) continue;
		const eqIdx = line.indexOf("=");
		if (eqIdx < 0) continue;
		const key = line.slice(0, eqIdx).trim();
		const valuePart = line.slice(eqIdx + 1).trim();
		if (!valuePart.startsWith("\"")) continue;
		const closing = valuePart.indexOf("\"", 1);
		if (closing < 0) throw new Error(`unterminated string at line ${i + 1}`);
		const value = valuePart.slice(1, closing);
		if (key in result) throw new Error(`duplicate key "${key}" at line ${i + 1}`);
		result[key] = value;
	}
	return result;
}
//#endregion
//#region src/account.ts
const BUNDLED_MAC_CLI = "/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin";
const BROWSER_AUTH = "devin-browser";
const LOGIN_TIMEOUT = 3e5;
const LOGOUT_TIMEOUT = 15e3;
const MAX_RESPONSE_BYTES = 1048576;
function findDevinCli() {
	const executable = process.platform === "win32" ? "devin.exe" : "devin";
	const configured = process.env.DEVIN_CLI_PATH;
	return (configured ? [configured] : [
		...(process.env.PATH ?? "").split(delimiter).filter(isAbsolute).map((dir) => join(dir, executable)),
		join(homedir(), ".local", "bin", executable),
		...process.platform === "darwin" ? [BUNDLED_MAC_CLI] : []
	]).find((path) => {
		if (!isAbsolute(path)) return false;
		try {
			accessSync(path, constants.X_OK);
			return statSync(path).isFile();
		} catch {
			return false;
		}
	});
}
function hasCustomCredentialsPath() {
	if (!process.env.DEVIN_CREDENTIALS_PATH) return false;
	const defaultPath = process.platform === "win32" ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "devin", "credentials.toml") : join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "devin", "credentials.toml");
	return resolve(devinCredentialsPath()) !== resolve(defaultPath);
}
function watchCli(child, timeout, defaultOutcome) {
	let outcome;
	let forceKill;
	const finish = (value) => {
		if (outcome !== void 0) return;
		outcome = value;
		if (child.exitCode !== null || child.signalCode !== null || child.pid === void 0) return;
		child.kill("SIGTERM");
		forceKill = setTimeout(() => child.kill("SIGKILL"), 1e3);
		forceKill.unref();
	};
	const deadline = setTimeout(() => finish("timeout"), timeout);
	deadline.unref();
	return {
		finish,
		finished: new Promise((settle) => {
			child.on("error", () => finish("failed"));
			child.once("close", (code) => {
				clearTimeout(deadline);
				clearTimeout(forceKill);
				settle(outcome ?? defaultOutcome(code));
			});
		}),
		isFinishing: () => outcome !== void 0,
		cancel: () => finish("cancelled")
	};
}
function startBrowserLogin(cli) {
	const child = spawn(cli, ["acp"], {
		stdio: [
			"pipe",
			"pipe",
			"ignore"
		],
		windowsHide: true
	});
	const job = watchCli(child, LOGIN_TIMEOUT, () => "failed");
	child.stdin.on("error", () => job.finish("failed"));
	child.stdout.on("error", () => job.finish("failed"));
	const request = (id, method, params) => {
		child.stdin.write(JSON.stringify({
			jsonrpc: "2.0",
			id,
			method,
			params
		}) + "\n");
	};
	let buffer = "";
	let authenticating = false;
	child.stdout.setEncoding("utf8").on("data", (chunk) => {
		if (job.isFinishing()) return;
		buffer += chunk;
		if (Buffer.byteLength(buffer, "utf8") > MAX_RESPONSE_BYTES) {
			job.finish("failed");
			return;
		}
		const lines = buffer.split("\n");
		buffer = lines.pop();
		for (const line of lines) {
			let message;
			try {
				message = JSON.parse(line);
			} catch {
				continue;
			}
			if (!message || typeof message !== "object" || !("id" in message) || "method" in message) continue;
			if (message.id === 1 && !authenticating) {
				const result = "result" in message ? message.result : void 0;
				const methods = result && typeof result === "object" && "authMethods" in result ? result.authMethods : [];
				if (!Array.isArray(methods) || !methods.some((method) => method?.id === BROWSER_AUTH)) {
					job.finish("unsupported");
					return;
				}
				authenticating = true;
				request(2, "authenticate", { methodId: BROWSER_AUTH });
			} else if (message.id === 2 && authenticating) {
				job.finish("result" in message && !("error" in message) ? "success" : "failed");
				return;
			}
		}
	});
	request(1, "initialize", {
		protocolVersion: 1,
		clientCapabilities: {}
	});
	return job;
}
const CUSTOM_PATH_ERROR = "This profile uses a custom Devin credentials path. Manage that login in your terminal.";
const NO_CLI_ERROR = "Devin CLI was not found. Install Devin Desktop or add the Devin CLI to the host PATH.";
function createDevinAccount({ onCredentialsChanged } = {}) {
	let loginJob;
	let logoutJob;
	let error;
	let disposed = false;
	const notifyCredentialsChanged = () => {
		try {
			onCredentialsChanged?.();
		} catch {
			error = "Devin credentials changed, but DSH could not refresh the models. Restart DSH to apply the change.";
		}
	};
	const status = () => ({
		cliAvailable: findDevinCli() !== void 0,
		authenticated: readDevinSession() !== void 0,
		loginInProgress: loginJob !== void 0,
		logoutInProgress: logoutJob !== void 0,
		...error ? { error } : {}
	});
	const login = () => {
		if (disposed || loginJob || logoutJob) return status();
		error = void 0;
		if (hasCustomCredentialsPath()) {
			error = CUSTOM_PATH_ERROR;
			return status();
		}
		if (readDevinSession()) return status();
		const cli = findDevinCli();
		if (!cli) {
			error = NO_CLI_ERROR;
			return status();
		}
		const job = startBrowserLogin(cli);
		loginJob = job;
		job.finished.then((result) => {
			loginJob = void 0;
			if (disposed) return;
			if (readDevinSession()) notifyCredentialsChanged();
			else if (result === "timeout") error = "Devin browser login timed out. Try again.";
			else if (result === "unsupported") error = "This Devin CLI does not support browser login from DSH. Run devin auth login in a terminal.";
			else if (result !== "cancelled") error = "Devin browser login failed. Try again or run devin auth login in a terminal.";
		});
		return status();
	};
	const cancelLogin = async () => {
		const job = loginJob;
		job?.cancel();
		await job?.finished;
		return status();
	};
	const logout = async () => {
		if (disposed || logoutJob) return status();
		error = void 0;
		if (hasCustomCredentialsPath()) {
			error = CUSTOM_PATH_ERROR;
			return status();
		}
		const cli = findDevinCli();
		if (!cli) {
			error = NO_CLI_ERROR;
			return status();
		}
		const pendingLogin = loginJob;
		let cancelLogout = () => pendingLogin?.cancel();
		const finished = Promise.resolve().then(async () => {
			pendingLogin?.cancel();
			await pendingLogin?.finished;
			if (disposed) return "cancelled";
			if (!readDevinSession()) return "success";
			const job = watchCli(spawn(cli, ["auth", "logout"], {
				stdio: "ignore",
				windowsHide: true
			}), LOGOUT_TIMEOUT, (code) => code === 0 ? "success" : "failed");
			cancelLogout = job.cancel;
			return job.finished;
		});
		logoutJob = {
			finished,
			cancel: () => cancelLogout()
		};
		try {
			const result = await finished;
			if (!disposed) {
				if (!readDevinSession()) notifyCredentialsChanged();
				else if (result === "timeout") error = "Devin logout timed out. Try again.";
				else error = "Devin logout failed. Run devin auth logout in a terminal.";
			}
		} finally {
			logoutJob = void 0;
		}
		return status();
	};
	const dispose = async () => {
		disposed = true;
		loginJob?.cancel();
		logoutJob?.cancel();
		await Promise.allSettled([loginJob?.finished, logoutJob?.finished]);
	};
	return {
		status,
		login,
		cancelLogin,
		logout,
		dispose
	};
}
//#endregion
//#region src/settings-rpc.ts
const namespace = "devin-bridge";
const endpoints = [
	"status",
	"login",
	"cancel",
	"logout",
	"catalog",
	"save",
	"usage"
];
function registerSettingsRoutes(connection, handle) {
	const disposers = [];
	try {
		for (const endpoint of endpoints) {
			const method = `${namespace}/${endpoint}`;
			disposers.push(connection.fetch.register({
				path: `/api/${method}`,
				methods: ["POST"],
				requestBody: "buffered",
				async fetch(request) {
					if (endpoint === "login" || endpoint === "cancel" || endpoint === "logout") {
						const authority = request.headers.get("host") ?? "";
						const origin = request.headers.get("origin");
						if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/u.test(authority) || origin && origin !== `http://${authority}` && origin !== `https://${authority}`) return new Response(null, { status: 403 });
					}
					if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return new Response("JSON required", { status: 415 });
					const envelope = await request.json().catch(() => null);
					if (!envelope || envelope.method !== method || typeof envelope.rpcId !== "string") return new Response("Invalid request", { status: 400 });
					const result = await handle(endpoint, envelope.payload, request.signal).then((value) => ({
						ok: true,
						value
					}), () => ({ ok: false }));
					return Response.json({
						type: "server-response",
						rpcId: envelope.rpcId,
						result
					});
				}
			}));
		}
	} catch (error) {
		disposers.reverse().forEach((dispose) => dispose());
		throw error;
	}
	return () => disposers.reverse().forEach((dispose) => dispose());
}
//#endregion
//#region src/index.ts
const name = "dsh-plugin-devin-bridge";
const inject = ["llm", "settings"];
const PROVIDER = "devin";
const DEFAULT_MODELS = [{
	id: "swe-2-high",
	name: "SWE-2 High",
	family: "SWE-2",
	contextWindow: 262e3,
	maxTokens: 16384,
	supportsImages: true
}, {
	id: "glm-5-3-max",
	name: "GLM-5.3 Max",
	family: "GLM-5.3",
	contextWindow: 1048576,
	maxTokens: 16384,
	supportsImages: false
}];
const catalogModel = z.object({
	id: z.string().required(),
	name: z.string(),
	description: z.string(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	supportsImages: z.boolean(),
	family: z.string(),
	isPremium: z.boolean(),
	isPromo: z.boolean(),
	creditMultiplier: z.number().step(.01)
});
const Config = z.object({
	token: z.string().role("secret").default(""),
	baseUrl: z.string().default("https://server.codeium.com"),
	proxy: z.string().default(""),
	forceHttp1: z.boolean().default(true),
	defaultContextWindow: z.number().step(1).min(1).default(128e3),
	defaultMaxTokens: z.number().step(1).min(1).default(16384),
	models: z.array(catalogModel).default(DEFAULT_MODELS),
	retryPolicy: RetryPolicySchema
}).volatile();
function apply(ctx, config) {
	const attachments = ctx.get("attachments");
	const readImage = attachments ? (ref, signal) => attachments.readImage(ref, signal) : void 0;
	const settingsNs = ctx.fiber.entry?.options.id;
	if (!settingsNs) throw new Error("devin-bridge: DSH settings entry is unavailable");
	ctx.effect(() => ctx.settings.configure({ auto: true }));
	const source = () => (ctx.fiber.effectiveConfig ?? config).get();
	const resolveConn = () => {
		const c = source();
		if (c.token) return {
			token: c.token,
			baseUrl: c.baseUrl
		};
		const session = readDevinSession();
		if (session) {
			const baseUrl = c.baseUrl === "https://server.codeium.com" ? session.apiServerUrl : c.baseUrl;
			return {
				token: session.apiKey,
				baseUrl
			};
		}
		const hint = process.platform === "win32" ? "%APPDATA%\\devin\\credentials.toml" : "~/.local/share/devin/credentials.toml";
		throw new Error(`devin-bridge: no Devin session token found. Either:
  1. Set token in the settings panel to a "devin-session-token\$..." value, or
  2. Run "devin auth login" to create ${hint}, or\n  3. Set DEVIN_CREDENTIALS_PATH to a custom credentials.toml path`);
	};
	const adapter = new DevinAdapter({ options: () => {
		const c = source();
		const { token, baseUrl } = resolveConn();
		return {
			token,
			baseUrl,
			proxy: c.proxy || void 0,
			forceHttp1: c.forceHttp1,
			models: c.models,
			defaultContextWindow: c.defaultContextWindow,
			defaultMaxTokens: c.defaultMaxTokens,
			...readImage ? { readImage } : {}
		};
	} });
	let directoryHandle = null;
	let adapterHandle = null;
	let discoveryHandle = null;
	const register = () => {
		const retryPolicy = resolveRetryPolicy(structuredClone(source().retryPolicy), `llm: provider "${PROVIDER}" retryPolicy`);
		adapter.providerRetryPolicy = () => retryPolicy;
		if (!directoryHandle) directoryHandle = ctx.llm.registerConfigurableProviders([{
			provider: PROVIDER,
			displayName: "Devin",
			settingsNs,
			settingsPath: []
		}]);
		if (!adapterHandle) adapterHandle = ctx.llm.registerAdapter([PROVIDER], adapter);
		if (!discoveryHandle) discoveryHandle = ctx.llm.registerModelDiscovery(settingsNs, (_request, signal) => adapter.discoverModels(signal));
	};
	const unregister = () => {
		if (discoveryHandle) {
			try {
				discoveryHandle();
			} catch {}
			discoveryHandle = null;
		}
		if (adapterHandle) {
			try {
				adapterHandle();
			} catch {}
			adapterHandle = null;
		}
		if (directoryHandle) {
			try {
				directoryHandle();
			} catch {}
			directoryHandle = null;
		}
	};
	const refreshRoutes = () => {
		unregister();
		register();
	};
	ctx.on("loader/volatile-update", refreshRoutes);
	ctx.effect(() => () => unregister());
	register();
	const account = createDevinAccount({ onCredentialsChanged: refreshRoutes });
	ctx.effect(() => () => account.dispose());
	let catalog = [];
	let catalogAccount;
	const currentCredential = () => source().token || readDevinSession()?.apiKey;
	const desktop = () => ctx.get("profileContext")?.name === "desktop";
	const status = () => ({
		account: account.status(),
		desktop: desktop(),
		configuredToken: Boolean(source().token),
		models: source().models
	});
	ctx.inject(["connection"], (scope) => scope.effect(() => registerSettingsRoutes(scope.get("connection"), async (endpoint, payload, signal) => {
		if (endpoint === "status") return status();
		if (endpoint === "usage") return adapter.fetchUsage(AbortSignal.any([signal, AbortSignal.timeout(15e3)]));
		if (endpoint === "catalog") {
			const credential = currentCredential();
			const models = await adapter.fetchModelCatalog(AbortSignal.any([signal, AbortSignal.timeout(2e4)]));
			if (credential !== currentCredential()) throw new Error("Account changed");
			catalog = models;
			catalogAccount = credential;
			return models;
		}
		if (endpoint === "save") {
			if (!Array.isArray(payload) || payload.length > 300 || !payload.every((id) => typeof id === "string")) throw new Error("Invalid model selection");
			const available = new Map(source().models.map((model) => [model.id, model]));
			if (catalogAccount === currentCredential()) for (const model of catalog) available.set(model.id, model);
			const models = [...new Set(payload)].map((id) => available.get(id));
			if (models.some((model) => !model)) throw new Error("Refresh the catalog first");
			await ctx.settings.update(settingsNs, { models });
			return status();
		}
		if (!desktop()) throw new Error("Account controls require DSH Desktop");
		if (endpoint === "login") account.login();
		if (endpoint === "cancel") await account.cancelLogin();
		if (endpoint === "logout") {
			if (account.status().authenticated) {
				const next = await account.logout();
				if (next.authenticated || next.error) return status();
			}
			if (source().token) await ctx.settings.update(settingsNs, { token: "" });
			catalog = [];
			catalogAccount = void 0;
		}
		return status();
	})));
}
//#endregion
export { Config, DevinAdapter, apply, devinCredentialsPath, inject, name, readDevinSession };

//# sourceMappingURL=index.js.map