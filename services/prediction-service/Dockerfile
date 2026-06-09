FROM node:20-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3002
CMD ["node", "src/app.js"]
