FROM node:20-bullseye

WORKDIR /app

# Copiar archivos de dependencias e instalarlas
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer el puerto del microservicio
EXPOSE 3001

# Comando para ejecutar la aplicación en producción
CMD ["npm", "start"]
