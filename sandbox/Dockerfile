FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 postgresql bash && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/runtime
RUN npm install --omit=dev --ignore-scripts typescript@5.9.3 react@19.2.6 react-dom@19.2.6
COPY sql.py /opt/runtime/sql.py
USER 1000:1000
