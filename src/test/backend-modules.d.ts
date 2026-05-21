declare module "../../backend/src/services/fileAnalyzer.js" {
  export const analyzeAttachment: (...args: unknown[]) => unknown;
  export const analyzeAttachments: (...args: unknown[]) => unknown;
}

declare module "../../backend/src/services/osintUtils.mjs" {
  export const calculateEmailRisk: (...args: unknown[]) => unknown;
  export const computeDomainAgeDays: (...args: unknown[]) => unknown;
  export const detectIpRegion: (...args: unknown[]) => unknown;
  export const extractDomainFromEmail: (...args: unknown[]) => unknown;
  export const normalizeDomain: (...args: unknown[]) => unknown;
  export const parseWhoisText: (...args: unknown[]) => unknown;
  export const validateEmailFormat: (...args: unknown[]) => unknown;
}
