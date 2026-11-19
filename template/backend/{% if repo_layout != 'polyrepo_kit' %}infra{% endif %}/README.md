# Deploying without Kubernetes

Every service is a plain Docker image with a healthcheck, migrations on start (`RUN_MIGRATIONS=true`)
and JSON logs on stdout. That fits any of these, smallest first:

1. **One VM + Docker Compose**: `docker compose -f compose.yaml -f services/*/compose.service.yaml up -d`
   with `ENV=prod`, real secrets in `.env` files, and a reverse proxy (Caddy/Traefik/nginx) in front.
2. **Managed containers**: Azure Container Apps, AWS ECS Fargate, Google Cloud Run. Push the same image;
   set the same env vars; point health probes at `/health/live` and `/health/ready`.

Production checklist: managed Postgres (one DB per service), `JWKS_URL` instead of `JWT_SECRET`,
`OTEL_ENABLED=true` + collector endpoint, `DOCS_ENABLED=false`, run ≥ 2 replicas (the outbox relay is replica-safe).
