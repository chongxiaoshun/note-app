import { default as jsyaml } from 'js-yaml';
import { promises as fs } from 'fs';
import * as util from 'util';
import DBG from 'debug';
import Sequelize from "sequelize";
const log = DBG('users:model-users');
const error = DBG('users:error');

//数据库连接
let sequlz;

//表
export class SQUser extends Sequelize.Model { }

//如果数据库没有初始化连接，那么就连接数据库，建表 shema，创建表。
export async function connectDB() {
    if (sequlz) return sequlz;
    //todo 这里之前 SEQUELIZE_CONNECT 写为了 SEQUELIZE_CONNET 从而导致 fs 一直提示 path 是 undefined。。
    //todo 问题是我一口气写了很多的代码，一步一步排查没有发现。
    const yamltext = await fs.readFile(process.env.SEQUELIZE_CONNECT, 'utf8');
    const params = await jsyaml.load(yamltext, 'utf8'); // todo 现在 jsyaml 已经没有 safeLoad 方法，load 默认就很 safe 了。否则会报错。

    if (typeof process.env.SEQUELIZE_DBNAME !== 'undefined' && process.env.SEQUELIZE_DBNAME !== '') {
        params.dbname = process.env.SEQUELIZE_DBNAME;
    }
    if (typeof process.env.SEQUELIZE_DBUSER !== 'undefined' && process.env.SEQUELIZE_DBUSER !== '') {
        params.username = process.env.SEQUELIZE_DBUSER;
    }
    if (typeof process.env.SEQUELIZE_DBPASSWD !== 'undefined' && process.env.SEQUELIZE_DBPASSWD !== '') {
        params.password = process.env.SEQUELIZE_DBPASSWD;
    }
    if (typeof process.env.SEQUELIZE_DBHOST !== 'undefined' && process.env.SEQUELIZE_DBHOST !== '') {
        params.host = process.env.SEQUELIZE_DBHOST;
    }
    if (typeof process.env.SEQUELIZE_DBPORT !== 'undefined' && process.env.SEQUELIZE_DBPORT !== '') {
        params.port = process.env.SEQUELIZE_DBPORT;
    }
    if (typeof process.env.SEQUELIZE_DBDIALECT !== 'undefined' && process.env.SEQUELIZE_DBDIALECT !== '') {
        params.dialect = process.env.SEQUELIZE_DBDIALECT;
    }

    log('Sequelize params ' + util.inspect(params));

    sequlz = new Sequelize(params.dbname, params.username, params.password, {
        host: params.host, port: params.port, dialect: params.dialect
    }
    );

    //创建表 schema，可以的玩法很多。
    SQUser.init({
        username: { type: Sequelize.STRING, unique: true },
        password: Sequelize.STRING,
        provider: Sequelize.STRING,
        familyName: Sequelize.STRING,
        givenName: Sequelize.STRING,
        middleName: Sequelize.STRING,
        emails: Sequelize.STRING(2048),
        photos: Sequelize.STRING(2048)
    }, {
        sequelize: sequlz,
        modelName: "SQUser"
    });
    await SQUser.sync();
}

//这个函数是为了方便的使用 req 对象构造一个 user 对象。
export function userParams(req) {
    return {
        username: req.params.username,
        password: req.params.password,
        provider: req.params.provider,
        familyName: req.params.familyName,
        givenName: req.params.givenName,
        middleName: req.params.middleName, //todo 注意这里，因为没有提供 middlename，所以 middlename: undefined, 导致数据库报错。
        emails: JSON.stringify(req.params.emails), //注意这里是 emails
        photos: JSON.stringify(req.params.photos)
    };
}

//这个方法的参数是一个 Model instance，因为 Model instance 代表的是一行数据，
//但是另外还有一些其他的方法等等，这个方法的作用就是把 Model isntance 中我们想要的数据提取出
//来，给我们一个干干净净的 user 数据。
export function sanitizedUser(user) {
    let ret = {
        id: user.username,
        username: user.username,
        provider: user.provider,
        familyName: user.familyName,
        givenName: user.givenName,
        middleName: user.middleName
    };//s todo 这里因为经常使用 ctrl + s 保存，导致经常会莫名其妙打出来一个 s 。。。
    try {
        ret.emails = JSON.parse(user.emails);
    } catch (e) { ret.emails = []; }
    try {
        ret.photos = JSON.parse(user.photos);
    } catch (e) { ret.photos = []; }
    return ret;
}

export async function findOneUser(username) {
    try {
        let user = await SQUser.findOne({ where: { username: username } });
        user ? sanitizedUser(user) : undefined;
        return user;
    } catch (err) {
        console.error(err.req.params);
    }
}

export async function createUser(req) {
    let tocreate = userParams(req);
    console.log(`create tocreate ${util.inspect(tocreate)}`);
    // await SQUser.create(tocreate); //todo 这里的 create 是 Model 的静态方法，也就是 SOUser 的 static method， 它创建一个 Model instance and save it.
    // todo 今天在 stackoverflow 上面学到了，因为 create 返回一个 Promise,所以如果这里出错了，就使用 try catch 看一下具体哪里错了
    // todo 今天这里一直包 validation error，但是不知道具体是什么错误。后来发现是因为 username 是 unique，数据库中已经保存了一个 me, 但是我在终端中一直执行 me，所以会报错，因为 me 已经存在了。
    try {
        const user = await SQUser.create((tocreate));
        console.log('success', user.toJSON());
    } catch (err) {
        console.error(err, req.params);
    }
    const result = await findOneUser(req.params.username); //注意这里不是简单的返回 tocreate, 而是从数据库中查找之后返回。
    return result;
}


























