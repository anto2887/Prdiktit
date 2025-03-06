# frontend/Dockerfile

# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom entrypoint script
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 80

# Start nginx with custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]