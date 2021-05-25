import {Note, AbstractNotesStore} from "./Notes.mjs";
import mongodb from 'mongodb';
const MongoClient = mongodb.MongoClient;
import DBG from 'debug';
const debug = DBG("notes:notes-mongodb");
const error = DBG("notes:error-mongodb");

let client;

//connectDB() 返回一个 database client object.
const connectDB = async () => {
    if (!client) client = await MongoClient.connect(process.env.MONGO_URL, {useUnifiedTopology:
            true });
}

//db() 函数的作用就是把 client object 包裹在函数内，并且获取指定的 database.
//client.db() 通过参数返回指定的 DB instance, 代表了指定的 database.
//因此，对响应数据库的操作可以 db().collection();
//Create a new Db instance sharing the current socket connections.
const db = () => {return client.db(process.env.MONGO_DBNAME);};

export default class MongoDBNotesStore extends AbstractNotesStore {
    async close() {
        if (client) client.close();
        client = undefined;
    }
    async update(key, title, body) {
        await connectDB();
        const note = new Note(key, title, body);

        //这里对 DB instance 调用了 collection() 方法，获取指定数据库中指定的表。
        // Mongodb 中 collection 就是一个表。
        // Mongodb 中的 document 就是表中的一行。
        //Fetch a specific collection (containing the actual collection information). If the application does not use strict mode you
        // can use it without a callback in the following way: const collection = db.collection('mycollection');
        const collection = db().collection('notes');

        //Update a single document in a collection
        //parameters: filter, update, options, callback
        // return a Promise.
        await collection.updateOne({notekey: key},
            {$set: {title: title, body: body}});
        return note;
    }
    async create(key, title, body) {
        await connectDB();
        const note = new Note(key, title, body);
        const collection = db().collection('notes');
        await collection.insertOne({
            notekey: key, title: title, body: body
        });
        return note;
    }
    async read(key) {
        await connectDB();
        const collection = db().collection('notes');

        //注意这里 findOne 返回的是一个 Promise 对象，里面包含了找到的第一个 document 对象。
        // 但是这里的返回值是不能直接使用的，因为 database 里面的字段是 notekey, 而 Note 里面是 key.
        //所以这里需要一步提取，将 doc 里面的 notekey, title, body 提取出来放到 Note constructor 中。
        //todo 这里忘了加 await 导致不能正常运行。
        const doc = await collection.findOne({notekey: key});
        const note = new Note(doc.notekey, doc.title, doc.body);
        debug("read done...")
        return note;
    }
    async destroy(key) {
        await connectDB();
        const collection = db().collection('notes');
        //todo 这里忘了加 await 导致不能正常运行。
        const dc = await collection.findOne({notekey: key});
        if (!dc) {
            throw new Error(`No note found for ${key}`);
        } else {
            await collection.findOneAndDelete({notekey: key});
            // this.emitDestroyed(key);
        }
    }
    async keylist() {
        await connectDB();
        const collection = db().collection('notes');
        const keyz = await new Promise((resolve, reject) => {
            const keyz = [];
            //find() Creates a cursor for a query that can be used to iterate over results from MongoDB
            //因为返回的是一个 Cursor 对象，所以我们必须将 find() 包在一个 Promise 中执行。
            //Cursor.forEach() Iterates over all the documents for this cursor using the iterator, callback pattern.
            //为了方便 Promise 的书写，forEach() 第一个参数是普通的迭代操作，第二个参数是 callback，参数是 error.
            //第二个回调函数是在所有的迭代操作完成之后，通知 Promise 是 resolve or reject.
            collection.find({}).forEach(
                note => {keyz.push(note.notekey);},
                err => {
                    if (err) reject(err);
                    else resolve(keyz);
                }
            );
        });
        debug("keylist done ....")
        return keyz;
    }
    async count() {
        await connectDB();
        const collection = db().collection('notes');
        const count = await collection.count({});
        return count;
    }
}