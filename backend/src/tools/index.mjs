import {
  analyzeHeaders,
  analyzeHeadersFromUrl,
  analyzeMetadata,
  analyzeMetadataFile,
  analyzePasswordStrength,
  getDorkTemplates,
  identifyHash,
  runDorkBuilder,
  simulateSubdomainRecon,
} from "../services/intelligenceService.mjs";

export const listToolTemplates = () => getDorkTemplates();
export const runToolDorkBuilder = async (actor, payload) => runDorkBuilder(actor, payload);
export const runToolHashIdentify = async (actor, hash) => identifyHash(actor, hash);
export const runToolPasswordStrength = async (actor, password) => analyzePasswordStrength(actor, password);
export const runToolHeadersAnalyze = async (actor, headers) => analyzeHeaders(actor, headers);
export const runToolHeadersFromUrl = async (actor, url) => analyzeHeadersFromUrl(actor, url);
export const runToolMetadataAnalyze = async (actor, input) => analyzeMetadata(actor, input);
export const runToolMetadataUploadAnalyze = async (actor, payload) => analyzeMetadataFile(actor, payload);
export const runToolSubdomainRecon = async (actor, target) => simulateSubdomainRecon(actor, target);

