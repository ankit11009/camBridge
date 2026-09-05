FROM node:20-alpine AS base
WORKDIR /app

# FFmpeg required for video processing
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
