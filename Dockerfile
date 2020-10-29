FROM node:12.19.0-buster-slim AS node12slim
ENV TERM linux
WORKDIR /opt/mdir.js
COPY mdir.js*.tgz /opt/mdir.js
RUN npm install mdir.js*.tgz

#FROM node:10.22.1 AS node10
#ENV TERM linux
#WORKDIR /opt/mdir.js
#COPY mdir.js*.tgz /opt/mdir.js
#RUN npm install mdir.js*.tgz
