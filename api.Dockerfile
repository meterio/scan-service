#Build stage
FROM node:22.23.4-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

#Production stage
FROM node:22.23.4-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist


ENV API_NETWORK main
ENV API_PORT 4000
ENV API_STANDBY no

ENTRYPOINT ["/usr/local/bin/node", "dist/src/main.js"]
CMD ["api"]
