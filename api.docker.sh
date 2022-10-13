#!/bin/bash

docker build -t meterio/scan-api:latest .
docker push meterio/scan-api:latest