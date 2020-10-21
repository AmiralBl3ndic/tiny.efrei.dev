FROM node:alpine

EXPOSE 8080

RUN mkdir /app
WORKDIR /app/

COPY package.json yarn.lock /app/

RUN yarn

COPY static/ /app/static/
COPY src/ /app/src/

CMD ["yarn", "start"]
