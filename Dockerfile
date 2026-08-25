# ==========================================
# 🐳 Dockerfile für VereinsManager
# Multi-Stage Build: Node.js Builder + Alpine Nginx
# ==========================================

# 1. Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# 2. Production Stage
FROM nginx:alpine

# Copy custom Nginx configuration with SPA fallback & security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
