import { default as express } from 'express';
import { default as hbs } from 'hbs';
import * as path from 'path';
//import * as favicon from 'server-favicon';
import { default as logger } from 'morgan';
import { Server } from 'socket.io';
import passportSocketIo from 'passport.socketio';
import { default as cookieParser } from 'cookie-parser';
import { default as bodyParser } from 'body-parser';
import * as http from 'http';
import { approotdir } from './approotdir.mjs';
const __dirname = approotdir;
import {
    normalizePort, onError, onListening, handler404, basicErrorHandler
} from './appsupport.mjs';
import { router as indexRouter, init as homeInit } from './routes/index.mjs';
import { router as notesRouter, init as notesInit } from './routes/notes.mjs';
import { default as rfs } from 'rotating-file-stream';

import { router as usersRouter, initPassport } from "./routes/users.mjs";

//################################## Session Config ############################
//根据环境变量看是使用 session-file-store 还是使用 redisStore，最后赋值给 sessionStore，传入 app.use(session({}))中。
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import ConnetRedis from 'connect-redis';
import redis from 'redis';
let sessionStore;
if (typeof process.env.REDIS_ENDPOINT !== undefined
    && process.env.REDIS_ENDPOINT !== '') {
    const RedisStore = ConnetRedis(session);
    const redisClient = redis.createClient({
        host: process.env.REDIS_ENDPOINT
    });
    sessionStore = new RedisStore({ client: redisClient });
} else {
    const FileStore = sessionFileStore(session);
    const sessionStore = new FileStore({ path: "session" });
}

export const sessionCookieName = 'notescookie.sid';
//global seesion properties, Express, Passport, Socket.io share these properties.
const sessionSecret = 'keyboard mouse';

//###############################################################################

import { default as DBG } from 'debug';
const debug = DBG('notes:debug');
const dbgerror = DBG('notes:error');


//creates and configures Express application instance.
//in this file, we export three object, 1. app; 2. port; 3. server; for the usage of other modules.
export const app = express();

//############################## setup server ####################################
//if has a given PORT use it, if not use 3000;
export const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

//to make it a complete running server:
//wrap the Express application in an HTTP server and gets it listening to HTTP requests.
export const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

server.on('request', (req, res) => {
    debug(`${new Date().toISOString()} request ${req.method} ${req.url}`);
});

//by invoking socketio, we have given Socket.IO access to the HTTP server.
//it listens from incoming requests on the URLs through which SocketIO does its work.
export const io = new Server(server);

io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: sessionCookieName,
    secret: sessionSecret,
    store: sessionStore
}));

import redisIO from 'socket.io-redis';
if (typeof process.env.REDIS_ENDPOINT !== 'undefined'
    && process.env.REDIS_ENDPOINT !== '') {
    io.adapter(redisIO({
        host: process.env.REDIS_ENDPOINT, port: 6379
    }));
}

//##################################################################################


//############################### initialize NoteStore ##################################
// create and export a NotesStore instance, which perform CRUD operation for the database. For now, the database is a in memory array.
// import { InMemoryNotesStore } from './models/notes-memory.mjs'
// export const NotesStore = new InMemoryNotesStore();
import { useModel as useNotesModel } from "./models/notes-store.mjs";

//initialize NoteStore.
useNotesModel(process.env.NOTES_MODEL ? process.env.NOTES_MODEL : "memory")
    .then(store => {
        //these two init method must be called after NoteStore is completely initialized.
        //calling the .on function to register an event listener must happen after NoteStore is initilized.
        homeInit();
        notesInit();
    })
    .catch(error => { onError({ code: 'ENOTESSTORE', error }); });

//############################################################################################


//view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
hbs.registerPartials(path.join(__dirname, 'partials'));

//uncomment after placing favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
// app.use(logger('dev'));

//logger format 与 REQUEST_LOG_FORMATE 环境变量一致，如果没有 REQUEST_LOG_FORMATE 环境变量，那么就使用默认的
// dev 模式。为 morgan logger 添加了 options，有 stream 属性，使用 rfs 的 createSteam，设定日志轮换的大小属性以及格式。
//如果没有 REQUEST_LOG_FILE 环境变量的设定，就是用默认的 stdout 作为输出流。
//createSteam() 第一个参数是 log 文件的名字，第二个参数是一系列的 options，这里是在 log 文件达到 10M 或者一天之后轮换。
app.use(logger(process.env.REQUEST_LOG_FORMATE || 'dev', {
    stream: process.env.REQUEST_LOG_FILE ?
        rfs.createStream(process.env.REQUEST_LOG_FILE, {
            size: '10M',
            interval: '1d',
            compress: 'gzip'
        })
        : process.stdout
}));
if (process.env.REQUEST_LOG_FILE) {
    app.use(logger(process.env.REQUEST_LOG_FORMATE || 'dev'));
} //如果存在 log 文件，那么不仅要记录在 log 文件中，也需要同时打印在 terminal 中。


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
//initialize the session support.
//这里注意一下 app.use() 放位：
// cookieParser
// session
// passport.initialize
// passport.session
// app.router
app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true,
    name: sessionCookieName
}));
initPassport(app);

//注意这里，express.static 是告诉 express 静态文件的目录在哪里。
//在 html 页面中，表示静态文件的位置的 link 中就不用写 public/...， 而是直接写相对于 public 的相对路径。
app.use(express.static(path.join(__dirname, 'public')));

//添加第三方包位置
app.use('/assets/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use('/assets/vendor/jquery', express.static(path.join(__dirname, "node_modules", "jquery", "dist")));
app.use('/assets/vendor/popper.js', express.static(path.join(__dirname, "node_modules", "popper.js", "dist", "umd")));
//不要忘了是 /assets 不是 assets.
app.use('/assets/vendor/feather-icons', express.static(path.join(__dirname, 'node_modules', 'feather-icons', 'dist')));

//Router function lists
app.use('/', indexRouter);
app.use('/notes', notesRouter);
app.use('/users', usersRouter);

//error handlers
//catch 404 and forward to error handler
app.use(handler404);
app.use(basicErrorHandler);




