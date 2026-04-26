FROM node:20-bookworm-slim
 
WORKDIR /app
 
# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
 
# Copy app code
COPY . .
 
 
EXPOSE 3000
 
CMD ["node", "start.js"]
