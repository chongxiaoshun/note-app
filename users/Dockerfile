FROM node:14

RUN apt-get update -y \
    && apt-get upgrade -y \
    && apt-get -y install curl python build-essential git ca-certificates

ENV DEBUG="users:*"
ENV PORT="5858"
# todo 我了个大去，这里的错误犯了两次了，每一次都耽误很长时间排查，这里的 connect 又写成了 connet, 导致 connetDB() 找不到加载文件。
ENV SEQUELIZE_CONNECT="sequelize-docker-mysql.yaml"
ENV REST_LISTEN="0.0.0.0"

RUN mkdir -p /userauth
COPY package.json *.yaml *.mjs /userauth/
WORKDIR /userauth
RUN npm install --unsafe-perm

EXPOSE 5858
CMD ["node", "./user-server.mjs"]