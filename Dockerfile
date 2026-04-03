FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 8080 8787

CMD ["sh", "-c", "node server.js & npm run preview -- --host 0.0.0.0 --port 8080"]
