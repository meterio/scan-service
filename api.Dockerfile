FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates wget && wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem && apt-get autoremove -y wget
RUN npm install -g pm2
RUN pm2 install --docker typescript

# Bundle APP files
COPY src ./src
COPY package.json .
COPY pm2.json .
COPY tsconfig.json .

# Install app dependencies
RUN npm install --productin
ENV NPM_CONFIG_LOGLEVEL warn

ENV API_NETWORK main
ENV API_PORT 4000
ENV API_STANDBY no

ENTRYPOINT [ "pm2-runtime", "start", "pm2.json" ]