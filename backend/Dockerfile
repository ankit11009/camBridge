FROM node:20-alpine AS base
WORKDIR /app

# FFmpeg required for video processing, openssl and libc6-compat for Prisma on Alpine
RUN apk add --no-cache ffmpeg openssl libc6-compat

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
