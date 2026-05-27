#!/bin/bash
set -euxo pipefail

apt-get update
apt-get install -y ca-certificates curl git

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
