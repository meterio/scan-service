#Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

#Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json .
RUN npm ci --only=production
COPY --from=build /app/dist ./dist


ENV API_NETWORK main
ENV API_PORT 4000
ENV API_STANDBY no

ENTRYPOINT ["/usr/local/bin/node", "dist/src/main.js", "api"]