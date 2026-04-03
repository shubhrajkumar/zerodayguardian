const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uniqueLines = (lines = [], limit = 4) => {
  const values = [];
  for (const line of lines) {
    const value = String(line || "").trim();
    if (!value || values.includes(value)) continue;
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
};

const noDataFound = "No data found";

export const computeOsintInsight = ({ query, targetType, results = {} }) => {
  let score = 10;
  const highlights = [];
  const recommendations = [];

  const emailData = results.email?.data;
  const domainData = results.domain?.data;
  const ipData = results.ip?.data;
  const dnsData = results.dns?.data;

  if (targetType === "email" && emailData) {
    if (typeof emailData.riskScore === "number") score = Math.max(score, emailData.riskScore);
    if (Array.isArray(emailData.riskReasons)) highlights.push(...emailData.riskReasons);
    if (Array.isArray(emailData.advice)) recommendations.push(...emailData.advice);
    if (emailData.valid === "invalid") {
      score = 90;
      highlights.push("Email format is invalid.");
      recommendations.push("Correct the email address before running enrichment.");
    } else {
      if (emailData.domainStatus === "not_found") {
        score += 50;
        highlights.push("Email domain could not be verified in DNS.");
      }
      if (emailData.domainStatus === "exists_no_mx") {
        score += 25;
        highlights.push("Email domain exists but has no MX records.");
      }
      if (emailData.riskLevel) highlights.push(`Email risk level assessed as ${emailData.riskLevel}.`);
      recommendations.push("Verify the mailbox domain has correct MX and ownership records.");
    }
  }

  if (targetType === "domain" && domainData) {
    if (typeof domainData.riskScore === "number") score = Math.max(score, domainData.riskScore);
    if (Array.isArray(domainData.riskReasons)) highlights.push(...domainData.riskReasons);
    if (Array.isArray(domainData.advice)) recommendations.push(...domainData.advice);
    if (domainData.dnsValidity === "invalid") {
      score += 45;
      highlights.push("No verified A, MX, or NS DNS records were found.");
      recommendations.push("Verify authoritative DNS delegation and published records.");
    } else {
      highlights.push("Verified DNS records were found for the domain.");
    }

    if (typeof domainData.domainAgeDays === "number") {
      if (domainData.domainAgeDays <= 30) {
        score += 20;
        highlights.push("Domain registration appears recent based on WHOIS data.");
      } else {
        highlights.push(`Domain age verified at ${domainData.domainAgeDays} days.`);
      }
    }

    if (domainData.whois?.available === false) {
      highlights.push("WHOIS data was unavailable, so the result fell back to DNS-only evidence.");
    }
  }

  if (targetType === "ip" && ipData) {
    if (typeof ipData.riskScore === "number") score = Math.max(score, ipData.riskScore);
    if (Array.isArray(ipData.riskReasons)) highlights.push(...ipData.riskReasons);
    if (Array.isArray(ipData.advice)) recommendations.push(...ipData.advice);
    if (ipData.basicRegion !== noDataFound) {
      highlights.push(`IP classified as ${ipData.basicRegion}.`);
    }
    if (ipData.hostname !== noDataFound) {
      highlights.push(`Reverse DNS resolved to ${ipData.hostname}.`);
    }
    if (ipData.basicRegion === noDataFound && ipData.hostname === noDataFound) {
      score += 10;
      highlights.push("Only minimal local validation data was available for this IP.");
      recommendations.push("Use a verified offline GeoIP database if public geolocation is required.");
    }
  }

  if (dnsData?.exists) {
    highlights.push("DNS verification succeeded.");
  }

  score = clamp(score, 0, 100);
  const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  if (!recommendations.length) {
    recommendations.push("Continue monitoring and enrich only with verified public data sources.");
  }

  if (!highlights.length) {
    highlights.push("No verified data was available for this target.");
  }

  const cleanReasons = uniqueLines(highlights, 4);
  const cleanAdvice = uniqueLines(recommendations, 4);
  const confidence =
    cleanReasons.length >= 4 ? 0.9
      : cleanReasons.length === 3 ? 0.78
        : cleanReasons.length === 2 ? 0.64
          : 0.44;
  const sourceSummary =
    targetType === "email"
      ? "Verified email intelligence relies on syntax validation plus live DNS and MX evidence."
      : targetType === "ip"
        ? "Verified IP intelligence relies on public IP validation and reverse DNS evidence."
        : "Verified domain intelligence relies on live DNS with RDAP/WHOIS registration evidence when available.";

  return {
    query,
    score,
    level,
    summary:
      level === "HIGH"
        ? "High-confidence issues were found in the verified data."
        : level === "MEDIUM"
          ? "Some verified signals need review."
          : "Only limited low-risk verified signals were found.",
    highlights: cleanReasons,
    keyFindings: cleanReasons,
    recommendations: cleanAdvice,
    confidence,
    sourceSummary,
    executiveSummary:
      level === "HIGH"
        ? `${String(targetType || "target").toUpperCase()} has high-risk verified issues that need remediation.`
        : level === "MEDIUM"
          ? `${String(targetType || "target").toUpperCase()} shows mixed verified signals and needs review.`
          : `${String(targetType || "target").toUpperCase()} shows low-risk verified posture from current local evidence.`,
    cleanOutput: {
      riskLevel: level,
      reasons: cleanReasons,
      advice: cleanAdvice,
    },
  };
};
