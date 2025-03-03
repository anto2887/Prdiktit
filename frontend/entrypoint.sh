#!/bin/sh
# frontend/entrypoint.sh

# Replace environment variables in the nginx configuration
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf.tmp
mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf

# Replace environment variables in the JavaScript files
# Find the main.js file (with hash) in the static/js directory
MAIN_JS=$(find /usr/share/nginx/html/static/js -name "main.*.js" | head -n 1)

if [ -n "$MAIN_JS" ]; then
  echo "Replacing environment variables in $MAIN_JS"
  
  # Replace API_URL placeholder
  sed -i "s|__API_URL__|${API_URL}|g" "$MAIN_JS"
  
  # Replace other environment variables as needed
  # sed -i "s|__ENV_VAR_NAME__|${ENV_VAR_VALUE}|g" "$MAIN_JS"
fi

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'