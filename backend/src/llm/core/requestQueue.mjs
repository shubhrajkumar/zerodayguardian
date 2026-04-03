const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.floor(parsed));
};

export class LlmRequestQueue {
  constructor({ concurrency = 4, maxQueueSize = 200, maxWaitMs = 15000 } = {}) {
    this.concurrency = toPositiveInt(concurrency, 4);
    this.maxQueueSize = toPositiveInt(maxQueueSize, 200);
    this.maxWaitMs = toPositiveInt(maxWaitMs, 15000);
    this.active = 0;
    this.queue = [];
  }

  snapshot() {
    return {
      active: this.active,
      queued: this.queue.length,
      concurrency: this.concurrency,
      maxQueueSize: this.maxQueueSize,
      maxWaitMs: this.maxWaitMs,
    };
  }

  enqueue(task, { correlationId = "", label = "llm.request", waitMs = this.maxWaitMs } = {}) {
    if (typeof task !== "function") {
      const error = new Error("LLM request task must be a function");
      error.code = "invalid_queue_task";
      return Promise.reject(error);
    }
    if (this.queue.length >= this.maxQueueSize) {
      const error = new Error("LLM request queue is full");
      error.code = "queue_overflow";
      error.statusCode = 503;
      error.retryAfterSec = 1;
      error.correlationId = correlationId;
      error.label = label;
      return Promise.reject(error);
    }

    const normalizedWaitMs = Math.max(250, Number(waitMs || this.maxWaitMs));
    return new Promise((resolve, reject) => {
      const item = {
        task,
        resolve,
        reject,
        correlationId,
        label,
        enqueuedAt: Date.now(),
        timer: null,
      };

      item.timer = setTimeout(() => {
        const index = this.queue.indexOf(item);
        if (index < 0) return;
        this.queue.splice(index, 1);
        const error = new Error("LLM request queue wait timeout");
        error.code = "queue_timeout";
        error.statusCode = 503;
        error.retryAfterSec = 1;
        error.correlationId = correlationId;
        error.label = label;
        reject(error);
      }, normalizedWaitMs);
      item.timer?.unref?.();

      this.queue.push(item);
      this.drain();
    });
  }

  drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;
      clearTimeout(item.timer);
      this.active += 1;
      Promise.resolve()
        .then(() => item.task())
        .then((result) => item.resolve(result))
        .catch((error) => item.reject(error))
        .finally(() => {
          this.active -= 1;
          setImmediate(() => this.drain());
        });
    }
  }
}

