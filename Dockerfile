FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
COPY frontend ./frontend
COPY admin ./admin
RUN mkdir -p backend/uploads && chown -R node:node backend/uploads
USER node
EXPOSE 3000
CMD ["node", "backend/server.js"]
