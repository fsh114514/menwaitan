FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY skills ./skills-init
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
EXPOSE 3100
CMD ["/bin/sh", "/app/docker-entrypoint.sh"]
