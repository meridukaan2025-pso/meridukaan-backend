# Multi-stage build for Railway
FROM node:20-alpine AS base

# Install Chromium dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm config set fetch-retries 3 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --legacy-peer-deps --no-audit --no-optional

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build application with verbose output
RUN echo "Starting build..." && \
    npm run build && \
    echo "Build completed. Checking dist folder..." && \
    ls -la dist/ && \
    echo "Checking for main.js..." && \
    (test -f dist/src/main.js && echo "✓ dist/src/main.js exists") || \
    (test -f dist/main.js && echo "✓ dist/main.js exists") || \
    (echo "✗ ERROR: main.js not found!" && find dist -name "main.js" && ls -la dist/ && exit 1) && \
    echo "Build verification successful!"

# Create storage directory
RUN mkdir -p /app/storage/invoices

# Expose port
EXPOSE ${PORT:-3001}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-3001}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application (check both possible locations)
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; elif [ -f dist/main.js ]; then node dist/main.js; else echo 'ERROR: main.js not found!' && find dist -name 'main.js' && exit 1; fi"]
