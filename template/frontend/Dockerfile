# syntax=docker/dockerfile:1.7
# Static SPA image: build with pnpm, serve with unprivileged nginx on :8080.
# Vite inlines VITE_* at build time, so build one image per API origin:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 -t web .
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install -g pnpm@9 --no-fund --no-audit
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui-kit/package.json packages/ui-kit/package.json
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_AUTH_MODE=saas
ARG VITE_DEFAULT_LOCALE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_AUTH_MODE=$VITE_AUTH_MODE VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
RUN pnpm --filter "./apps/web" build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
