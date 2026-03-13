docker compose logs -f --since 0s | grep -v "packets lost" | grep -v "no route to host" | grep -v "segment duration changed"
