/**
 * 这个 superagent 的作用其实和 Command line tool 一样，不同的是将发送请求的 client 从 restify client
 * 更换为 superagent. 做的事情都是一样的：向 user-server 发送请求（get or post），然后 user server 根据
 * 请求的URL向不同的 Router 分发请求。
 * Command line tool 是在 user module 中，而 superagent 是在 notes module 中，从而使得 user server
 * 保持了单一的功能，就是提供从数据库获取数据的 api 以及对应的 router，user server 仅仅是从外界 module 获得
 * 相应的请求，拿到请求之后，1.check authid and authcode 是否和服务器中的一致，2. 通过验证之后，将请求分发到
 * 对应的 Router，然后从数据库拿数据，放到 response body 中返回。
 */
import {default as request} from 'superagent';
import util from 'util';
import url from 'url';
const URL = url.URL;
import DBG from 'debug';
const debug = DBG('notes:users-superagent');
const error = DBG('notes:error-superagent');
import {default as bcrypt} from 'bcrypt';
const saltRounds = 10;

async function hashpass(password) {
    let salt = await bcrypt.genSalt(saltRounds);
    let hashed = await bcrypt.hash(password, salt);
    return hashed;
}

let authid = 'them';
let authcode = 'D4ED43C0-8BD6-4FE2-B358-7C0E230D11EF';

function reqURL(path) {
    const requrl = new URL(process.env.USER_SERVICE_URL);
    requrl.pathname = path;
    return requrl.toString();
}

export async function create(username, password, provider,
                             familyName, givenName, middleName, emails, photos) {
    let res = await request
        .post(reqURL('/create-user'))
        //todo 这种对象的写法还没有见过：匿名对象。当变量名和属性字段名一致的时候，属性名可以省略。
        .send({username, password: await hashpass(password), provider, familyName,
        givenName, middleName, emails, photos})
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .auth(authid, authcode);
    return res.body;
}

export async function update(username, password, provider,
    familyName, givenName, middleName, emails, photos) {
    let res = await request
        .post(reqURL(`/update-user/${username}`))
        .send({username, password: await hashpass(password), provider,
            familyName, givenName, middleName, emails, photos})
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .auth(authid, authcode);
    return res.body;
}

export async function find(username) {
    let res = await request
        .get(reqURL(`/find/${username}`))
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .auth(authid, authcode);
    return res.body;
}

export async function userPasswordCheck(username, password) {
    let res = await request
        //这里有一个注意的点：为什么不像上面的 find 一样把参数加到URL中，这是因为URL是可以被检测并记录的。
        //为了防止用户信息泄露，需要把敏感信息放在 request body 中。其次，如果使用 https 传输，request body 会被加密。
        .post(reqURL('/password-check'))
        .send({username, password})
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .auth(authid, authcode);
    return res.body;
}

export async function findOrCreate(profile) {
    let res = await request
        .post(reqURL('/find-or-create'))
        .send({
            username: profile.id, password: await hashpass(profile.password),
            provider: profile.provider, familyName: profile.familyName,
            givenName: profile.givenName, middleName: profile.middleName,
            emails: profile.emails, photos: profile.photos
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .auth(authid, authcode);
    return res.body;
}

export async function listUsers() {
    let res = await request
        .get(reqURL('/list'))
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .auth(authid, authcode);
    return res.body;
}