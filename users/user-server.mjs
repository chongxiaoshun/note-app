import restify from 'restify';
import * as util from 'util';
import {SQUser, connectDB, userParams, findOneUser,
    createUser, sanitizedUser} from "./users-sequelize.mjs";
import DBG from 'debug';
const log = DBG('users:service');
const error = DBG('users:error');
import {default as bcrypt} from 'bcrypt';

//set up the rest server
//这里注意，restify 在创建 server 的时候，有一个 version 属性。
//因为在写 REST API 的时候，总是会有版本变动，所以这里也支持版本号。
//这个版本号和 HTTP 头部信息 Accept-Version 是匹配的。
let server = restify.createServer({
    name: "User-Auth-Service",
    version: "0.0.1"
});

//在 express 里面是 middleware, 在 Restify 里面是 handlers，
//作用都是一样的，都是处理 req and res，处理完传到下一个处理。
server.use(restify.plugins.authorizationParser());
server.use(check);
server.use(restify.plugins.queryParser());
//todo 注意这里，先前这里写成了 plugins.queryParser); 没有写括号，导致这个方法一直没有被调用，一直卡在这里等待调用。
server.use(restify.plugins.bodyParser({
    mapParams: true
}));

server.listen(process.env.PORT, process.env.REST_LISTEN ? process.env.REST_LISTEN : "localhost", function() {
    log(server.name + ' listening at ' + server.url);
});

process.on('uncaughtException', function (err) {
    console.error("UNCAUGHT EXCEPTION - " + (err.stack || err));
});

process.on('unhandledRejection', ((reason, promise) => {
    console.error(`UNHANDLED PROMISE REJECTION: ${util.inspect(promise)} reason: ${reason}`);
    process.exit(1);
}));

//mimic api key authentication.
let apiKeys = [{
    user: 'them', key: 'D4ED43C0-8BD6-4FE2-B358-7C0E230D11EF'
}];

//这里的 check 就是前面的 server.use(check)
//意思就是对于所有的请求都需要 check。check 这个中间件一样有三个参数，req, res, next。
//这里注意， HTTP Basic Auth 是很不安全的，这里只是示范以下，
//对于 token-based 验证做了个 hander 的模拟。
function check(req, res, next) {
    log(`check ${util.inspect(req.authorization)}`);
    log(`req ${util.inspect(req)}`)
    if (req.authorization && req.authorization.basic) {
        let found = false;
        for (let auth of apiKeys) {
            if (auth.key === req.authorization.basic.password
            && auth.user === req.authorization.basic.username) {
                found = true;
                log('check success!');
                break;
            }
        }
        if (found) next(); //这里就是验证通过的话，就将 req 传递到下一个 handler.
        else {
            res.send(401, new Error("Not authenticated"));
            error('Failed authentication check ' + util.inspect(req.authorization));
            //对于 restify 来说，和 express 不同的就是这里，express 的中间件函数都需要
            //在处理完 req 的时候调用 next()，除非中间件在链的末端，即，中间件调用 res.send 将
            //response 发送给 caller。
            //而 restify 来说，每一个 handler 函数都需要调用 next(), 如果 handler 处于末端，那么
            //就会调用 next(false).
            next(false);
        }
    } else {
        res.send(500, new Error('No Authorization Key'));
        error('No authorization');
        next(false);
    }
}

//route handler

//对 /create-user 的 POST 请求处理。
server.post( '/create-user', async (req, res, next) =>{
    try {
        log('create-user params ' + util.inspect(req.params));
        await connectDB();
        let result = await createUser(req);
        res.contentType = 'json';
        res.send(result); //注意这里直接发送一个 user 对象。
        next(false);
    } catch(err) {
        res.send(500, err);
        error(`/create-user ${err.stack}`);
        next(false);
    }
});

server.post('/find-or-create', async (req, res, next) => {
    try {
        await connectDB();
        let user = await findOneUser(req.params.username);
        if (!user) {
            user = await createUser(req);
            if (!user) throw new Error('No user created');
        }
        res.contentType = 'json';
        res.send(user);
        return next(false);
    } catch(err) {
        res.send(500, err);
        next(false);
    }
});

//这个时候不能使用浏览器测试，因为加了 Auth,浏览器发出的请求不能通过验证。
/**todo: server.get or post('path', function(req, res, obj)) without err parameter. node 不知道如何处理 async 回调函数的错误的，因此，async 回调函数的参数中没有 err 参数。但是对于 restify client 来说，因为回调函数不是异步函数，所以有err参数。
 * 这里的一个耽误很长时间的 bug：对于 restify client 来说，callback 有四个参数：err, req, res, obj,但是对于
 * restify server 来说，server.get or post('path', callback) 中的回调函数有三个参数：req, res, next. 多写一个 err 就会导致
 * 一直卡在一个地方，连错误都不报。
 * 这里一定要注意，对于node 来说，non-async 回调函数会包含一个 err 参数，而 async 回调函数来说，node 是不会知道如何处理异步函数的
 * 错误，所以对于异步函数来说，回调函数的参数中是没有 err 参数的。
 */
server.get('/find/:username', async (req, res, next) => {
    try {
        await connectDB();
        //注意这里的 findoneuser 不是 SQUser 的方法。这里的 findOneUser 会调用 SQUser 的静态方法 findOne()
        const user = await findOneUser(req.params.username);
        log(`findOneUser ${req.params.username}`);
        if (!user) {
            res.send(404, new Error("not found" + req.params.username));
            next(false);
        } else {
            res.contentType = 'json';
            res.send(user);
        }
        next(false);
    } catch(err) {
        res.send(500, err);
        next(false);
    }
});

server.get('/list', async (req, res, next) => {
    try {
        log('list...');
        await connectDB();
        //注意这里使用的是 SQUser 继承于 Model 的静态方法 findAll();
        let userlist = await SQUser.findAll({});

        //findAll() 返回的是一个复杂的对象，需要将它剥离
        userlist = userlist.map(user => sanitizedUser(user));
        if (!userlist) {
            userlist = [];
        }
        res.contentType = 'json';
        res.send(userlist);
        next(false);
    } catch (err) {
        res.send(500, err);
        next(false);
    }
});

server.post('/update-user/:username', async (req, res, next) => {
    try {
        await connectDB();
        let toupate = userParams(req);
        await SQUser.update(toupate, {where: {username: req.params.username}});
        const result = await findOneUser(req.params.username);
        res.send(result);
        next(false);
    } catch(err) {
        res.send(500, err);
        next(false);
    }
});

server.del('/destroy/:username', async (req, res, next) => {
    try {
        await connectDB();
        //这里使用 Model.findOne() 是因为它返回一个 Promise<Model>，这里返回的是一个 Model 对象，
        //Model 对象就是一个表，这个表中只有一行结果。
        const user = await SQUser.findOne({where: {username: req.params.username}});
        if (!user) {
            res.send(404, new Error(`Did not find requested ${req.params.username} to delete`));
        } else {
            //因为 Model.findOne() 返回的是 Model，所以就有 Model 的静态方法 destroy()
            user.destroy();
            res.contentType = 'json';
            res.send({});
        }
        next(false);
    } catch(err) {
        res.send(500, err);
        next(false);
    }
});

server.post('/password-check', async (req, res, next) => {
    try {
        await connectDB();
        const user = await SQUser.findOne({where: {username: req.params.username}});
        let checked;
        if (!user) {
            checked = {
                check: false, username: req.params.username,
                message: "Can not find user"
            };
        } else {
            let pwcheck = false;
            if (user.username === req.params.username) {
                //将请求中用户输入密码(plain text) 和数据库中该用户名密码(encrypted) 比较。
                pwcheck = await bcrypt.compare(req.params.password, user.password);
            }
            if (pwcheck) {
                checked = {check: true, username: user.username};
            } else {
                checked = {
                    check: false, username: req.params.username,
                    message: "Incorrect username or passwrod"
                };
            }
        }
        res.contentType = 'json';
        res.send(checked);
        next(false);
    } catch(err) {
        res.send(500, err);
        next(false);
    }
});



















