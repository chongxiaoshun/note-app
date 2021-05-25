import util from 'util';
import {Note, AbstractNotesStore} from "./Notes.mjs";
import level from 'level';
import {default as DBG} from 'debug';
const debug = DBG('notes:notes-level');
const error = DBG('notes:error-level');

//把 db 定义在 global 作用域中，这样方便使用。
let db;

async function connectDB() {
    //如果已经有一个 db 对象设置了，那么就立即返回它。
    if (typeof db !== 'undefined' || db) return db;
    db = await level(
        process.env.LEVELDB_LOCATION || 'notes.level', {
            creatIfMissing: true,
            valueEncoding: "json"
        }
    );
    return db;
}

export default class LevelNotesStore extends AbstractNotesStore {
    async close() {
        //todo 为啥这里这样操作，不直接 db.close()
        const _db = db;
        db = undefined;
        return _db ? _db.close() : undefined;
    }
    async update(key, title, body) {return crupdate(key, title, body);}
    async create(key, title, body) {return crupdate(key, title, body);}
    async read(key) {
        const db = await connectDB(); //如果 database 已经连接，那么直接返回已经连接的 db。
        const note = Note.fromJSON(await db.get(key));
        return note;
    }
    async destroy(key) {
        const db = await connectDB();
        await db.del(key);
    }
    async keylist() {
        const db = await connectDB();
        const keyz = [];
        await new Promise(((resolve, reject) => {
            db.createKeyStream()
                .on('data', data => keyz.push(data))
                .on('error', err => reject(err))
                .on('end', () => resolve(keyz));
        }));
        return keyz;
    }
    async count() {
        const db = await connectDB();
        var total = 0;
        await new Promise(((resolve, reject) => {
            db.createKeyStream()
                .on('data', data => total++)
                .on('error', err => reject(err))
                .on('end', () => resolve(total));
        }));
        return total;
    }
}
async function crupdate(key, title, body) {
    const db = await connectDB();
    const note = new Note(key, title, body);
    await db.put(key, note.JSON);
    return note;
}



































