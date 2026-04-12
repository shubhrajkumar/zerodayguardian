import { env } from "../backend/src/config/env.mjs";

const appBase = String(env.appBaseUrl || "");
const isProd = env.nodeEnv === "production";
const googleConfigured = !!(env.googleOauthClientId && env.googleOauthClientSecret);
const githubConfigured = !!(env.githubOauthClientId && env.githubOauthClientSecret);
const httpsEnforced = isProd ? appBase.startsWith("https://") : true;
const callbackUrls = [
  `${appBase.replace(/\/+$/, "")}/api/auth/oauth/google/callback`,
  `${appBase.replace(/\/+$/, "")}/api/auth/oauth/github/callback`,
];
const callbackValid = callbackUrls.every((u) => (isProd ? /^https:\/\//.test(u) : /^https?:\/\//.test(u)));
const requiredSecretsConfigured = !!(env.sessionSecret && env.jwtSecret);
const oauthConfigured = googleConfigured && githubConfigured;
const deploymentReady = oauthConfigured && callbackValid && httpsEnforced && requiredSecretsConfigured;

const report = {
  oauthConfigured,
  callbackValid,
  environment: env.nodeEnv,
  deploymentReady,
  checks: {
    googleClientConfigured: googleConfigured,
    githubClientConfigured: githubConfigured,
    httpsEnforced,
    requiredSecretsConfigured,
    callbackUrls,
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!deploymentReady) process.exit(1);
