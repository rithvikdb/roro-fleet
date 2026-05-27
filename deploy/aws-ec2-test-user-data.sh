#!/bin/bash
set -euxo pipefail

apt-get update
apt-get install -y ca-certificates curl git

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

mkdir -p /opt/roro-fleet
if [ ! -d /opt/roro-fleet/.git ]; then
  git clone https://github.com/rithvikdb/roro-fleet.git /opt/roro-fleet
else
  git -C /opt/roro-fleet pull --ff-only
fi

cd /opt/roro-fleet
git checkout main

if [ ! -f .env ]; then
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -base64 32 | tr -d '\n')" > .env
  chmod 600 .env
fi

docker compose -f docker-compose.aws-test.yml up -d --build

sleep 30
docker compose -f docker-compose.aws-test.yml ps || true
docker ps -a || true
ss -ltnp || true
curl -v --max-time 10 http://127.0.0.1/api/health || true
curl -v --max-time 10 http://127.0.0.1:8000/api/health || true
docker compose -f docker-compose.aws-test.yml logs --no-color --tail=200 || true
