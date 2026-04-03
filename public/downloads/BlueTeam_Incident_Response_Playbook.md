# Blue Team Incident Response Playbook

## 1. Detect
- Validate alert source and confidence.
- Capture timestamp, host, user, and critical indicators.

## 2. Triage
- Classify severity: low, medium, high, critical.
- Confirm business impact and potential blast radius.

## 3. Contain
- Isolate affected endpoint or workload.
- Block IOC domains, hashes, and suspicious IPs.

## 4. Eradicate
- Remove malicious artifacts.
- Patch vulnerable software and rotate credentials.

## 5. Recover
- Restore services in controlled stages.
- Monitor for reinfection for at least 24-72 hours.

## 6. Lessons Learned
- Document root cause, timeline, and control gaps.
- Publish an action backlog with owners and SLAs.