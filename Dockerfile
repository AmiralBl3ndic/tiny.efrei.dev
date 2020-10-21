FROM node:alpine

EXPOSE 8080

WORKDIR /app/

COPY package.json yarn.lock /app/

RUN yarn

COPY src/ /app/

CMD ["yarn", "start"]
