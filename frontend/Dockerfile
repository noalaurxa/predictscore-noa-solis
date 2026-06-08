# Etapa 1: Compilación de la aplicación de React con Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias e instalarlas
COPY package*.json ./
RUN npm install

# Copiar el código fuente y construir el proyecto
COPY . .
RUN npm run build

# Etapa 2: Servidor web ligero en producción para archivos estáticos
FROM nginx:stable-alpine

# Copiar los archivos construidos de la etapa anterior al directorio público de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Reemplazar la configuración por defecto de Nginx con nuestra configuración de SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer el puerto por defecto de Nginx
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
