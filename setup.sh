#!/bin/bash

export NODE_EXTRA_CA_CERTS="$CODEX_PROXY_CERT"

node -v
npm -v

npm install

npm install -g vite web-ext
