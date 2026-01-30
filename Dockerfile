FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client for linux-musl (Alpine)
RUN npx prisma generate

# Copy built files
COPY dist ./dist

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
