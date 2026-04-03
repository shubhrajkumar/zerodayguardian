# Lab Sandbox (Docker Execution)

This project supports a **containerized sandbox** for lab commands. It keeps execution isolated while allowing real tool output.

## Build the sandbox image
From the project root:

```bash
docker build -t zeroday-lab-sandbox:latest -f backend/docker/lab-sandbox/Dockerfile .
```

## Configure the backend
Add these to your `.env` (see `.env.example`):

```
LAB_DOCKER_ENABLED=true
LAB_DOCKER_IMAGE=zeroday-lab-sandbox:latest
LAB_DOCKER_NETWORK=bridge
LAB_DOCKER_TIMEOUT_MS=20000
LAB_DOCKER_CPUS=0.5
LAB_DOCKER_MEMORY=256m
LAB_DOCKER_PIDS_LIMIT=128
LAB_ALLOWLIST_HOSTS=target.local,scanme.nmap.org
LAB_ALLOWLIST_CIDRS=
LAB_ALLOWED_BINS=nmap,curl,dig,nslookup,whois,traceroute,ping,openssl,nc,host,wget
```

## Safety model
- **Allowlist enforced** in the backend.
- **No shell operators** are accepted (e.g. `;`, `&&`, `|`, redirects).
- **Containers are read-only** with dropped capabilities and timeouts.

If you need more tools, add them to the Dockerfile and update `LAB_ALLOWED_BINS`.
