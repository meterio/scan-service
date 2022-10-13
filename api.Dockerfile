FROM node:18-bullseye

RUN npm install -g pm2
RUN pm2 install typescript

# Bundle APP files
WORKDIR /app
COPY src ./src
COPY package.json .
COPY pm2.json .
COPY tsconfig.json .

# Install app dependencies
RUN npm install --productin
ENV NPM_CONFIG_LOGLEVEL warn
RUN apt install -y wget && wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem && apt autoremove -y wget

ENV API_NETWORK main
ENV API_PORT 4000
ENV API_STANDBY no

ENTRYPOINT [ "pm2-runtime", "start", "pm2.json" ]