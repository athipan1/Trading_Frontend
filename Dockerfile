FROM node:22.17.0-alpine3.22 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ARG VITE_DATA_SOURCE=manager-api
ARG VITE_MANAGER_API_URL=/api
ARG VITE_DASHBOARD_SNAPSHOT_URL=
ARG VITE_REFRESH_INTERVAL_MS=60000
ENV VITE_DATA_SOURCE=${VITE_DATA_SOURCE} \
    VITE_MANAGER_API_URL=${VITE_MANAGER_API_URL} \
    VITE_DASHBOARD_SNAPSHOT_URL=${VITE_DASHBOARD_SNAPSHOT_URL} \
    VITE_REFRESH_INTERVAL_MS=${VITE_REFRESH_INTERVAL_MS}

RUN npm run build && npm run check:bundle

FROM nginxinc/nginx-unprivileged:1.29.0-alpine3.22 AS runtime

ENV MANAGER_UPSTREAM=http://manager-agent:80

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
