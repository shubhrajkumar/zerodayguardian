# Threat Hunting Query Cheatsheet

## Windows
- Suspicious process tree: parent-child anomalies for Office -> Script host -> PowerShell.
- Lateral movement indicators: remote service creation, unusual logon types.

## Linux
- Privilege escalation checks: sudo abuse, unexpected setuid binaries.
- Persistence checks: cron/systemd changes by non-admin users.

## Network
- Beaconing detection: repetitive outbound connections with fixed intervals.
- DNS anomalies: high-entropy domain lookups.

## Workflow
1. Hypothesis
2. Query
3. Validate context
4. Escalate or close