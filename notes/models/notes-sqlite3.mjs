import util from 'util';
import {Note, AbstractNotesStore} from "./Notes.mjs";
import {default as sqlite3} from 'sqlite3';
import {default as DBG} from 'debug';
const debug = DBG('notes:notes-sqlite3');
const error = DBG('notes:error-sqlite3');

let db;

async function connectDB() {
    if (db) return db;
    const dbfile = process.env.SQLITE_FILE || "notes.sqlite3";
    await new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbfile, //connecting to a disk file database.
            //It means that if the database does not exist,
            //the new database will be created and is ready for read and write.
            sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
            //with a callback, error object as the first parameter.
            //if has an err, reject the Promise with err.
            //if do not has an error, resolve Promise with db object wrap in it.
            err => {
                if (err) reject(err);
                resolve(db);
            });
    });
    return db;
}

export default class SQLITE3NotesStore extends AbstractNotesStore {
    async close() {
        const _db = db;
        return _db ?
            new Promise((resolve, reject) => {
                _db.close(err => {
                    if (err) reject(err);
                    else resolve();
                });
            }) : undefined;
    }

    //因为 sql 语句中，update and insert 是不同的，所以需要分别写 update and create 方法。
    async update(key, title, body) {
        const db = await connectDB();
        const note = new Note(key, title, body);
        //这里其实可以仔细的研究，可以很好的理解回调函数。
        //db.run 是一个执行 sql 语句的方法，这个方法有一个回调函数，回调函数的参数是 error。
        //db.run 的含义就是，首先执行 sql 语句，语句执行完毕之后，调用回调函数。
        //如果有 error，那么就在回调函数中调用 reject(err)，将最外层的 Promise 对象拒绝掉。
        //如果没有 error，说明 sql 语句成功执行，那么调用 resolve(note)，用一个 note 对象
        //满足 Promise。其实 resolve 里面包啥不重要，重要的是 sql 语句的成功执行。
        //这里就可以很好的体会回调函数：它在一个事件完成之后被调用，如果事情执行失败，会传一个 error 对象给
        //回调函数。
        await new Promise((resolve, reject) => {
            db.run("UPDATE notes " + "SET title=?, body=? WHERE notekey=?",
                [title, body, key], err => {
                if(err) return reject(err);
                resolve(note);
                });
        });
        return note;
    }

    async create(key, title, body) {
        const db = await connectDB();
        const note = new Note(key, title, body);
        await new Promise((resolve, reject) => {
            db.run("INSERT INTO notes (notekey, title, body) " + "VALUES (?, ?, ?);",
                [key, title, body], err => {
                if (err) return reject(err);
                resolve(note);
                });
        });
        return note;
    }

    async read(key) {
        const db = await connectDB();
        const note = await new Promise((resolve, reject) => {
            //这里注意，db.get() 在执行完 sql 之后，会给回调函数传递 err, row 两个对象。
            db.get("SELECT * FROM notes WHERE notekey=?", [key], (err, row) => {
                if (err) return reject(err);
                const note = new Note(row.notekey, row.title, row.body);
                resolve(note);
            });
        });
        return note;
    }

    //为啥每次都把 destroy 拼错为 destory 导致删除不掉。
    async destroy(key) {
        const db = await connectDB();
        return await new Promise((resolve, reject) => {
            db.run("DELETE FROM notes WHERE notekey=?;", [key], err => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async keylist() {
        const db = await connectDB();
        const keyz = await new Promise((resolve, reject) => {
            db.all("SELECT notekey FROM notes", (err, rows) => {
                if(err) return reject(err);
                resolve(rows.map(row => {
                    return row.notekey;
                }));
            });
        });
        return keyz;
    }

    async count() {
        const db = await connectDB();
        const count = await new Promise((resolve, reject) => {
            db.get("select count(notekey) as count from notes", (err, row) => {
                if(err) return reject(err);
                resolve(row.count);
            });
        });
        return count;
    }
}