FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node server.js delivery.js config.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node skills ./skills
COPY --chown=node:node skill ./skill
ENV PORT=5123 POSTCARD_DATA_DIR=/data POSTCARD_OPEN_BROWSER=0
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 5123
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:5123/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
