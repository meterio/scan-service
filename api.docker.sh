#!/bin/bash

docker build -t meterio/scan-api:latest -f api.Dockerfile .
docker push meterio/scan-api:latest
