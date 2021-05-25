import express from 'express';
import { NotesStore as notes } from '../models/notes-store.mjs';
export const router = express.Router();
import {io} from '../app.mjs';
import DBG from 'debug';
const debug = DBG('notes:router');

// router.get('/', async (req, res, next) => {
//   try {
//     const keylist = await notes.keylist();
//     //console.log(`keylist ${util.inspect(keylist)}`);
//     const keyPromises = keylist.map(key => {
//       return notes.read(key); // since read() is a async function, keyPromises is an array of Promises.
//     });
//     const notelist = await Promise.all(keyPromises);
//     res.render('index', {
//       title: 'Notes',
//       notelist: notelist,
//       user: req.user ? req.user : undefined
//     });
//   } catch (err) {
//     next(err);
//   }
// });

router.get('/', async (req, res, next) => {
  try {
    const notelist = await getKeyTitlesList();
    res.render('index', {
      title: 'Notes', notelist: notelist,
      user: req.user ? req.user : undefined
    });
  } catch(e) {next(e);}
});

//返回一个数组，数组中是所有的 note 对象。
//将获取数据数组的函数单独拆出来是因为这个函数即要使用在 router 中，又要使用在 socket.io 中。
async function getKeyTitlesList() {
  const keylist = await notes.keylist();
  const keyPromises = keylist.map(key => notes.read(key)); //注意这里，因为 read 是一个异步函数，所以需要使用 Promise.all 等到全部完成。
  const notelist = await Promise.all(keyPromises);
  //注意这里的返回值变了，之前是 note 对象的数组，现在是匿名对象的数组。
  //这是因为：当给 Socket.io 提供 Note 对象的数组时，Socket.io 会给浏览器发送空对象数组，而使用匿名对象的数组就会正确的发送
  //这个是 Socket.io 的一个使用特点。记住即可。
  return notelist.map(note => {
    return {key: note.key, title: note.title};
  });
};

//获取 keylist, io.of() 创建一个 home 命名空间，在这个命名空间中触发事件 notetitles
//我们只需要向特定的页面广播消息，这就是 io.of('/home') 的作用，在本例中，我们瞄准的是访问 /home 的浏览器的 notetitles 事件。
export const emitNoteTitles = async () => {
  const notelist = await getKeyTitlesList();
  console.log('**** notetitles event emit ****')
  io.of('/home').emit('notetitles', {notelist});
};

//注意这个 init() 是在创建 NoteStore 实例的时候就执行了
export function init() {
  io.of('/home').on('connect', socket => {
    debug('socketio connect on /home');
  });
  notes.on('notecreated', emitNoteTitles);
  notes.on('noteupdated', emitNoteTitles);
  notes.on('notedestroyed', emitNoteTitles);
}