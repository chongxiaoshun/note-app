//the inline function in app.mjs were included in this appsupport.mjs file to keep project clear and clean.
import { port, server } from './app.mjs';
import {default as DBG} from 'debug';
import * as util from 'util';

import {NotesStore} from "./models/notes-store.mjs";

//按照默认的规则，identifer:identifier 前面那个是 app name.
const dbgerror = DBG('notes:error');
const debug = DBG('notes:debug');

export function normalizePort(val) {
    //this port is not the one imported.
    //namespace: look for variable declearation in this function, if there isn't one, then find this variable in this module namespace.
    const port = parseInt(val, 10);

    //isNaN test is used to handle named pipe.
    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}

//server.on('error', onError);
export function onError(error) {
    dbgerror(error);
    if (error.syscall != 'listen') {
        throw error;
    }
    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        case 'ENOTESSTORE':
            //注意 error 参数是一个对象，里面有 error 属性。
            console.error(`Notes data store initialization failure because `, error.error);
            break;
        default:
            throw error;
    }
}

export function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    // console.log(`lcs: listening on ${bind}`);
    debug(`Listening on ${bind}`);
}

export function handler404(req, res, next) {
    const err = new Error("Not Found");
    err.status = 404;
    next(err);
}

export function basicErrorHandler(err, req, res, next) {

    //如果已经返回了 response，那么就将 err 传递给默认 error handler，关闭连接。
    //这里大致知道啥意思。
    if (res.headersSent) {
        return next(err);
    }

    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ?
        err : {};

    res.status(err.status || 500);
    res.render('error');
}

//capturing uncaught exceptions and unhandled rejected Promises;
//both are emitted from the process object.
process.on('uncaughtException', function (err) {
    console.log(`I've crashed, - ${(err.stack || err)}`);
});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection at: ${util.inspect(p)} reason: ${reason}`);
});

//关闭 database，关闭 server.
async function catchProcessDeath() {
    debug('urk...');
    await NotesStore.close();
    await server.close();
    process.exit(0);
}

//当检测到需要停止的时候，就会调用 catchProcessDeath() 方法
process.on('SIGTERM', catchProcessDeath);
process.on('SIGINT', catchProcessDeath);
process.on('SIGHUP', catchProcessDeath);

process.on('exit', () => {debug('exiting...');});
