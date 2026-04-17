# ═══════════════════════════════════════════════════════
#  STAGE 1 — Build Angular app
# ═══════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy all source files
COPY . .

# Build for production
RUN npm run build -- --configuration production

# ═══════════════════════════════════════════════════════
#  STAGE 2 — Serve with Nginx
# ═══════════════════════════════════════════════════════
FROM nginx:1.25-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/app.conf

# ✅ Project name is analytics-chatbot
COPY --from=builder /app/dist/analytics-chatbot/browser /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]