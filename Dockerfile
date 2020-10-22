FROM node:10.22.1 AS node10
ENV TERM linux
WORKDIR /opt/mdir.js
RUN npm install mdir.js

FROM node:12.19.0-buster-slim AS node12slim
ENV TERM linux
WORKDIR /opt/mdir.js
RUN npm install mdir.js
