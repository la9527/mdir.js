FROM node:20-bullseye-slim AS node20slim
ENV TERM linux
WORKDIR /opt/mdir.js
COPY mdir.js*.tgz /opt/mdir.js
RUN npm install mdir.js*.tgz

# Legacy images retained for reference
#FROM node:10.22.1 AS node10
#ENV TERM linux
#WORKDIR /opt/mdir.js
#COPY mdir.js*.tgz /opt/mdir.js
#RUN npm install mdir.js*.tgz
