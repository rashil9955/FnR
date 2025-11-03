FROM node:20-bullseye
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps || npm install --legacy-peer-deps
COPY . .
CMD ["npm", "run", "dev"]
