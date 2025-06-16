#!/bin/sh
# frontend/entrypoint.sh

# Set environment variables - ADD /v1 to the API URL
REACT_APP_API_URL=http://backend:8000/api/v1
# ADD THIS LINE to force development mode
export NODE_ENV=development

# Replace environment variables in the nginx configuration
envsubst '${REACT_APP_API_URL}' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf.tmp
mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf

# Find the main.js file
MAIN_JS=$(find /usr/share/nginx/html/static/js -name "main.*.js" | head -n 1)

if [ -n "$MAIN_JS" ]; then
  echo "Replacing environment variables in $MAIN_JS"
  
  # Replace API_URL placeholder
  sed -i "s|__API_URL__|${REACT_APP_API_URL}|g" "$MAIN_JS"
  
  # ADD THESE LINES to force development mode in the bundle
  echo "Enabling React development mode"
  # This replaces production checks with development mode
  sed -i 's/"production"/"development"/g' "$MAIN_JS"
  # Force React DevTools to be enabled
  sed -i 's/\!1&&/1\&\&/g' "$MAIN_JS"
fi

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'