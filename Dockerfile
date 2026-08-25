FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com
COPY . .
RUN npx next build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/skills ./skills-seed
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
EXPOSE 3100
CMD ["/bin/sh", "-c", "mkdir -p /app/skills /app/data && if [ ! -f /app/skills/manifest.json ]; then cp -rn /app/skills-seed/. /app/skills/ 2>/dev/null || true; fi && exec node server.js"]
