# GO-API Frontend - Dockerfile Otimizado
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
