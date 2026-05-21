import { z } from "zod";

const modules = ["whois", "dns", "rdns", "asn", "tls", "geoip", "breach", "social", "news"];

export const osintResolveSchema = z.object({
  query: z.string().min(2).max(2048),
  modules: z.array(z.enum(modules)).optional(),
  options: z
    .object({
      dnsTypes: z.array(z.enum(["A", "AAAA", "MX", "NS", "TXT", "CNAME"])).optional(),
      includeCertificateHistory: z.boolean().optional(),
      maxSocialChecks: z.number().min(1).max(20).optional(),
      newsLimit: z.number().min(1).max(50).optional(),
    })
    .optional(),
});

export const osintProvidersSchema = z.object({
  includeStatus: z.boolean().optional().default(true),
});

export const osintCaseCreateSchema = z.object({
  title: z.string().min(2).max(120),
  target: z.string().min(2).max(2048),
  summary: z.string().max(1200).optional(),
  notes: z.string().max(4000).optional(),
  folder: z.string().max(120).optional(),
  tags: z.array(z.string().max(32)).optional(),
  entities: z.array(z.string().max(200)).optional(),
  modules: z.array(z.string().max(24)).optional(),
  results: z.record(z.any()).optional(),
});

export const osintCaseUpdateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  summary: z.string().max(1200).optional(),
  notes: z.string().max(4000).optional(),
  folder: z.string().max(120).optional(),
  tags: z.array(z.string().max(32)).optional(),
  entities: z.array(z.string().max(200)).optional(),
});

export const osintCaseListSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const osintWatchlistCreateSchema = z.object({
  label: z.string().min(2).max(120),
  target: z.string().min(2).max(2048),
  modules: z.array(z.string().max(24)).optional(),
  intervalMinutes: z.number().min(5).max(1440).optional(),
  rules: z
    .object({
      minRiskScore: z.number().min(0).max(100).optional(),
      breachThreshold: z.number().min(0).max(999).optional(),
      alertOnNoDns: z.boolean().optional(),
      alertOnMissingTls: z.boolean().optional(),
    })
    .optional(),
  routing: z
    .object({
      minSeverity: z.enum(["low", "medium", "high"]).optional(),
      email: z.boolean().optional(),
      webhook: z.boolean().optional(),
      slack: z.boolean().optional(),
      mode: z.enum(["all", "severity"]).optional(),
      severityMap: z
        .object({
          low: z.object({ email: z.boolean().optional(), webhook: z.boolean().optional(), slack: z.boolean().optional() }).optional(),
          medium: z.object({ email: z.boolean().optional(), webhook: z.boolean().optional(), slack: z.boolean().optional() }).optional(),
          high: z.object({ email: z.boolean().optional(), webhook: z.boolean().optional(), slack: z.boolean().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const osintWatchlistUpdateSchema = z.object({
  label: z.string().min(2).max(120).optional(),
  target: z.string().min(2).max(2048).optional(),
  modules: z.array(z.string().max(24)).optional(),
  intervalMinutes: z.number().min(5).max(1440).optional(),
  active: z.boolean().optional(),
  rules: z
    .object({
      minRiskScore: z.number().min(0).max(100).optional(),
      breachThreshold: z.number().min(0).max(999).optional(),
      alertOnNoDns: z.boolean().optional(),
      alertOnMissingTls: z.boolean().optional(),
    })
    .optional(),
  routing: z
    .object({
      minSeverity: z.enum(["low", "medium", "high"]).optional(),
      email: z.boolean().optional(),
      webhook: z.boolean().optional(),
      slack: z.boolean().optional(),
      mode: z.enum(["all", "severity"]).optional(),
      severityMap: z
        .object({
          low: z.object({ email: z.boolean().optional(), webhook: z.boolean().optional(), slack: z.boolean().optional() }).optional(),
          medium: z.object({ email: z.boolean().optional(), webhook: z.boolean().optional(), slack: z.boolean().optional() }).optional(),
          high: z.object({ email: z.boolean().optional(), webhook: z.boolean().optional(), slack: z.boolean().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const osintAlertListSchema = z.object({
  limit: z.coerce.number().min(1).max(200).optional(),
});
