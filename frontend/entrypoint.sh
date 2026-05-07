#!/bin/sh
# frontend/entrypoint.sh

# Set environment variables - ADD /v1 to the API URL
REACT_APP_API_URL=http://backend:8000/api/v1

# Find the main.js file
MAIN_JS=$(find /usr/share/nginx/html/static/js -name "main.*.js" | head -n 1)

if [ -n "$MAIN_JS" ]; then
  echo "Replacing environment variables in $MAIN_JS"
  
  # Replace API_URL placeholder
  sed -i "s|__API_URL__|${REACT_APP_API_URL}|g" "$MAIN_JS"
fi

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'