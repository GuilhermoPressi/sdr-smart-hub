FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Declara os ARGs para receber as variáveis do EasyPanel em build time
ARG VITE_BACKEND_URL
ARG VITE_INTERNAL_API_KEY

# Passa para o ambiente do Vite durante o build
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_INTERNAL_API_KEY=$VITE_INTERNAL_API_KEY

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
