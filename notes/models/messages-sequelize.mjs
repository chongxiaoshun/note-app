import Sequelize from 'sequelize';
import {
    connectDB as connectSequlz,
    close as closeSequlz
} from "./sequlz.mjs";
import EventEmitter from 'events';
class MessagesEmitter extends EventEmitter{}
export const emitter = new MessagesEmitter();

import DBG from 'debug';
const debug = DBG('notes:model-messages');
const error = DBG('notes:error-messages');

let sequelize;
export class SQMessage extends Sequelize.Model {}

async function connectDB() {
    if (sequelize) return;
    sequelize = await connectSequlz(); //连接数据库

    /**
     * 创建 message schema.
     * namespce and room 共同决定了消息是属于哪一个 note page 的。目前我们有 /home
     * /notes 两个命名空间，但是后期可能会有其他的消息空间，比如 /private-message 用来
     * 传递 private 消息，所以为了拓展性，这里加入了 namespace and room 两个属性。
     */
    SQMessage.init({
        id: {type: Sequelize.INTEGER, autoIncrement:true, primaryKey: true},
        from: Sequelize.STRING,
        namespace: Sequelize.STRING,
        room: Sequelize.STRING,
        message: Sequelize.STRING(1024),
        timestamp: Sequelize.DATE
    }, {
        /**
         * 先前的方法是在创建 message 的时候，首先将其保存到数据库中，然后使用 emit
         * 方法发送事件:
         * SequelizeNotesStore extends AbstractNotesStore，AbstractNotesStore extends EventEmitter class
         * 因此就有了在 AbstractNotesStore 中定义的 emit 方法，在 SequelizeNotesStore 的 CRUD 方法
         * 中添加了相应的 emit 方法发送事件。
         *
         * 但是这里的 sequelize 提供了不同的方法: hooks
         * hooks 对象中是一系列的函数，与具体的事件发生绑定的函数，这里的 afterCreate and afterDestroy 函数是在
         * 新的 message 创建或删除之后触发的函数，这两个函数都携带了一个 SQMessage 实例对象作为参数，在 sequelize
         * 中，我们知道一个 Model 就是一个表，而一个 Model 实例对象则是表中的一行。
         */
        hooks: {
            afterCreate(message, options) {
                const toEmit = sanitizedMessage(message);
                emitter.emit('newmessage', toEmit);
            },
            afterDestroy(message, options) {
                emitter.emit('destroymessage', {
                    id: message.id,
                    namespace: message.namespace,
                    room: message.room
                });
            }
        },
        sequelize,
        modelName: "SQMessage"
    });
    await SQMessage.sync(); //建表。
}

//把 Sequelize Model instance object 中有用的信息提取出来。
function sanitizedMessage(message) {
    return {
        id: message.id,
        from: message.from,
        namespace: message.namespace,
        room: message.room,
        message: message.message,
        timestamp: message.timestamp
    };
}

//创建一个消息，保存到数据库中，并且触发 hook 函数，发送 newmessage 事件。
//注意这里传入的没有 id 值，因为 id 值是自增长的。
/**
 * 创建新的消息。注意这个创建函数不同于 createNote，在 createNote 中，我们调用了 emit 方法发送事件，
 * 但是这里我们没有这么做，而是在创建表的时候，在 Model.init() 中添加了 hooks 对象，在 hooks 对象中
 * 我们调用 afterCreate 方法，在这个方法中 emit "newmessage" 事件。通过使用 hooks 函数，我们可以
 * 总是确定在创建新的消息时发送事件。
 * @param from
 * @param namespace
 * @param room
 * @param message
 * @returns {Promise<void>}
 */
export async function postMessage(from, namespace, room, message) {
    await connectDB();
    const newmsg = await SQMessage.create({
        from, namespace, room, message, timestamp: new Date()
    });
}

export async function destroyMessage(id) {
    await connectDB();//注意这个的 bug conncetDB 拼错了。。
    const msg = await SQMessage.findOne({where: {id}});
    if (msg) {
        await msg.destroy();
    }
}

export async function recentMessage(namespace, room) {
    await connectDB();
    //Sequelize 还是很强大的，可以对结果进行排序和分页。
    //注意 order 的值是一个数组，数组中包含了数组去描述排序。
    const messages = await SQMessage.findAll({
        where: {namespace, room},
        order: [['timestamp', 'DESC']],
        limit: 20
    });
    const msgs = messages.map(message => {
        return sanitizedMessage(message);
    });
    return (msgs && msgs.length >= 1) ? msgs : undefined;
}
