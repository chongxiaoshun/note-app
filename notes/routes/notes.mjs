import express from 'express';
import { NotesStore as notes } from '../models/notes-store.mjs';
export const router = express.Router();
import {ensureAuthenticated} from "./users.mjs";
import {emitNoteTitles} from './index.mjs';
import {io} from '../app.mjs';
import {
    postMessage, destroyMessage, recentMessage, emitter as msgEvents
} from "../models/messages-sequelize.mjs";
import DBG from 'debug';
const debug = DBG('notes:home');
const error = DBG('notes:error-home');

//attention here, /add handler is not an async.
router.get('/add',ensureAuthenticated, (req, res, next) => {
    res.render('noteedit', {
        title: "Add a Note",
        docreate: true,
        notekey: '',
        user: req.user, note: undefined,
    })
});

//this save handler is an async.
//attention!! here is router.post, not get!
router.post('/save',ensureAuthenticated, async (req, res, next) => {
    try {
        let note;
        if (req.body.docreate === "create") {
            note = await notes.create(req.body.notekey,
                req.body.title, req.body.body);
        } else {
            note = await notes.update(req.body.notekey,
                req.body.title, req.body.body);
        }
        res.redirect(`/notes/view?key=${req.body.notekey}`);
        console.log(note);
    } catch (err) {
        next(err);
    }
});

router.get('/view', async (req, res, next) => {
    try {
        let note = await notes.read(req.query.key);
        //render the messages on the server.
        //当请求页面的时候，调用 recentMessage 方法获取近期消息，然后 res.render。
        const messages = await recentMessage('/notes', req.query.key);
        res.render('noteview', {
            title: note ? note.title : "",
            user: req.user ? req.user : undefined,
            notekey: req.query.key, note: note,
            messages
        });
    } catch (err) { next(err); }
});

//edit
//这里一定要分清楚 req 和 res，当点击 edit 按钮地时候，浏览器向 express 发送一个 /edit 请求，这个就是个 req, 注意这个 req 链接中通过 ?key= 传递了 keynote 地信息。res 就是 express 将 render 中地第二个参数对象发送给浏览器，浏览器通过这些参数信息渲染 noteedit 页面。 
router.get('/edit',ensureAuthenticated, async (req, res, next) => {
    try {
        const note = await notes.read(req.query.key);
        res.render('noteedit', {
            title: note ? ("Edit " + note.title) : "Add a note",
            docreate: false,
            user: req.user,
            notekey: req.query.key, note: note,
        });
    } catch (err) { next(err); }
});

router.get('/destroy',ensureAuthenticated, async (req, res, next) => {
    try {
        const note = await notes.read(req.query.key); //这里是一个 bug，之前是 await (req.query.key),这样就没有办法向 notedestroy 发送 note 对象。
        res.render('notedestroy', {
            title: note ? `Delete ${note.title}` : "",
            notekey: req.query.key, note: note,
            user: req.user
        });
    } catch (err) { next(err); }
});

//really delete note
//注意这里是 post 方法，post 请求中 req.body 中携带地就是 json 格式的页面信息。
//这里的 post req.body 里面是 input 中 hidden 类型的 notekey.
router.post('/destroy/confirm',ensureAuthenticated, async (req, res, next) => {
    try {
        await notes.destroy(req.body.notekey);
        res.redirect('/');
    } catch (err) { next(err); }
});

export function init() {
    //如果连接到这个 /notes 命名空间，那么判断是否有查询 key，如果有 key,那么就将这个连接加入到 room 中。
    /**
     * 这个之前是监听从 /notes/view 页面发来的连接的，一旦监听到从 /notes 页面发来的连接，就将其中的 key 提取出来
     * 然后将 socket 连接切换到 notes 命名空间的 key room 中，实现对 key room 的监听。这样的话，对于每一个
     * note 展示页面都可以进行监听，只要获得响应的 key 即可。
     *
     * 现在，这里加了两个监听器，这两个监听器是在确定 key room 的时候才会注册，换言之，就是在打开 note 单个页面的时候。
     * 这两个监听器是监听浏览器的，当浏览器执行 io.of('/notes').to(note.key).emit('create-message') 的时候
     * 这里的监听器就可以监听到响应的事件，因为这里的 server side io.of().on() 和上面的 io 是在同一个通道中。
     *
     * 另外一个有趣的是：socket.on() 中的回调函数不仅接受从发射端发送来的数据 newmsg，还携带了一个 fn 回调函数，
     * 这个回调函数是 socketio client 确定的，在 client 一侧，
     * io.of('/namespace').to(room).emit('event-name',
     *      {event-data},
     *      function (result) {
     *          ...acknowledagement action...
     *      });
     * 在 server 一侧：
     * socket.on('event-name', async (event-data, fn) => {
     *     ...
     *     fn('ok');
     * });
     *在服务器端，我们 .on 响应的事件，当事件触发的时候，执行回调函数，这个回调函数不仅携带了发送端的数据作为参数，
     * 还可以携带第二个参数 fn，这个 fn 就代替了发送端的 emit() 的第三个参数--回调函数。任何传入 fn 中的数据都
     * 将作为 function 的参数，这里的 fn('ok'), 中的参数是字符串 ok，这个字符串就会作为参数传递到 function 中
     * 作为 result 参数。
     *
     * 另外一个需要注意的是：这里的消息的路径：首先浏览器在一定的条件下 emit 事件，然后 router/notes.mjs 接收到
     * 事件，接着 notes.mjs 中对数据库进行 create or destroy 操作，然后数据库完成操作后 emit 响应事件，然后
     * router/notes.mjs 中的 init() 接收到事件，然后将事件发送到所有的浏览器中。
     *
     * 对于之前的 note 的操作就不是这样，当 create/update/destroy note 的时候，都会向 router 发送响应的请求，
     * 然后 router 根据响应的请求对数据库进行操作，同时完成 emit 事件，位于 index or note.mjs 的 init() 方法
     * 监听到事件之后，再次将事件发送到浏览器。
     *
     * 所以注意这两个的区别，一个是通过浏览器发送事件到 note.mjs 从而执行数据库操作，一个是通过 express router 的
     * get or post 方法对数据库进行操作。
     * 共同点在于，数据库操作之后，都会 emit 一个事件，然后 index/notes.mjs 接收事件，并将事件再次发送给浏览器。
     */
    io.of('/notes').on('connect', socket => {
        let notekey = socket.handshake.query.key;
        if (notekey) {
            //socket.join(roomName) 使得这个连接加入到 room 中。
            socket.join(notekey);

            socket.on('create-message', async (newmsg, fn) => {
                try {
                    await postMessage(
                        newmsg.from, newmsg.namespace, newmsg.room,
                        newmsg.message
                    );
                    fn('ok');
                } catch(err) {
                    error(`Fall to create message ${err.stack}`);
                }
            });

            socket.on('delete-message', async (data) => {
                try {
                    await destroyMessage(data.id);
                } catch(err) {
                    error(`Fall to delete message ${err.stack}`);
                }
            });

        }
    });
    //给 noteupdated and notedestroyed 事件添加监听器。
    //io.of('/namespace').to(roomName).emit(...);
    notes.on('noteupdated', note => {
        //在这里，我们必须将 note 转化为匿名对象，这样 socketio 就不会向浏览器传送空对象。
        const toemit = {
            key: note.key, title: note.title, body: note.body
        };
        io.of('/notes').to(note.key).emit('noteupdated', toemit);
        //因为这是对 /notes 做的改变，所以我们还需要调用 emitNoteTitles() 做出改变，
        //对首页进行改变。
        emitNoteTitles();
    });
    notes.on('notedestroyed', key => {
        io.of('/notes').to(key).emit('notedestroyed', key);
        emitNoteTitles();
    });

    /**
     * 注意这里和上面的不同：上面的 notes对象式继承于 EventEmitter 类的，所以 note.on() 就会注册相应的事件，
     * init() 在 app.mjs 中在实例化数据库对象的时候就执行了。所以 note.on() 也在很早的时候就开始执行，一直监听
     * 相应的事件。
     * 这里我们 import 了 emitter，这是个 EventEmitter 的实例对象，所以同样具有 .on() 方法去注册事件。
     * 这里我们注册了事件并对事件监听，一旦监听到了相应的事件，就将事件发送到相应的 namespace and room。
     *
     * 这里还需要思考一点：为什么我们不在 models/messages-sequelize.mjs 中直接 io.of().to().emit()？
     * 如果在 models/messages-sequelize.mjs 中直接使用io.of().to().emit() 发送事件到浏览器，那么就不需要
     * 在这里中转一下了，这里的代码是监听从 models/messages-sequelize.mjs 发来的事件，一旦监听到，就立刻
     * 将事件转发到浏览器。如果没有这个中转，直接在 models/messages-sequelize.mjs 发送事件到浏览器，就会少了一步
     * 那么就会更加高效，但是需要考虑到下面的方面：
     * 1. 虽然更加高效，但是代码的结构被打破。在 model 中，我们需要做的就是和数据库交互，而在 controller 中，
     * 我们需要做的是根据请求的连接和类型，将请求中的数据通过数据库 api 传递到数据库，然后将处理后的数据放到响应
     * 中。controller 就是一个分拣和中转的地方，这正好可以用来存放消息中转的代码。如果将消息处理代码方法 model 中，
     * 就会打破 model, controller, view 的相互分离的状态。
     * 2. 在 model 中，我们放了一个 EventEmitter, 调用 emit 方法，就像是一个消息发送的最开始的总结点，这样做有一个好处
     * 就是，在未来拓展代码的时候，就在需要拓展的地方直接调用 EventEmitter 的 on 方法进行监听，然后回调函数
     * 中将受到的事件再次转发出去。所以，这里的中转的好处就体现出来了，就是利于以后代码的拓展。
     */
    msgEvents.on('newmessage', newmsg => {
        io.of(newmsg.namespace).to(newmsg.room).emit('newmessage', newmsg);
    });
    msgEvents.on('destroymessage', data => {
        io.of(data.namespace).to(data.room).emit('destroymessage', data);
    });
}