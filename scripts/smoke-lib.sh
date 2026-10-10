#!/bin/bash

compose_service_is_healthy() {
  local container_id health_status
  container_id="$(compose ps -q "$1")" || return 1
  [[ -n "$container_id" ]] || return 1
  health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id")" || return 1
  [[ "$health_status" == "healthy" ]]
}
