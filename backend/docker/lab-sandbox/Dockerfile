FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    curl \
    dnsutils \
    whois \
    traceroute \
    iputils-ping \
    netcat-openbsd \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 10001 sandbox
USER sandbox
WORKDIR /home/sandbox

ENTRYPOINT ["/bin/sh", "-lc"]
