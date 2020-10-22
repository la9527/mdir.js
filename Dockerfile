FROM node:10.22.1 AS base

ENV TERM linux
WORKDIR /opt/mdir.js
COPY mdir.js-*.tgz .
RUN npm install mdir*.tgz
