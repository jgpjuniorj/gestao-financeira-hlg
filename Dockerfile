FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
	&& npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
