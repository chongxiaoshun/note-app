import {Note, AbstractNotesStore} from "./Notes.mjs";
import Sequelize from "sequelize";
import {
    connectDB as connectSequlz,
    close as closeSequlz
} from "./sequlz.mjs";
import DBG from 'debug';
const debug = DBG('notes:notes-sequelize');
const error = DBG('notes:error-sequelize');

let sequelize;
export class SQNote extends Sequelize.Model {} //通过 SQNote 类建立一个表，SQNote.init() 继承方法。

async function connectDB() {
    if (sequelize) return; //如果 sequlize 已经存在，那么就立即返回。
    sequelize = await connectSequlz();
    //Model.init() 第一个参数就是对 schema 的描述，第二个参数是 administrative data.
    //注意之类只是定义一个表。
    SQNote.init({ //属性名
        notekey: {type: Sequelize.DataTypes.STRING, primaryKey:true, unique:true},
        title: Sequelize.DataTypes.STRING,
        body: Sequelize.DataTypes.TEXT // TEXT not limited length
    }, {
        sequelize, //连接好的 database
        modelName: 'SQNote' //表名
        }
    );
    //todo Sync this Model to the DB, that is create the table.
    //这里才是创建表。
    await SQNote.sync();
    debug('SQNote table created...');
}

export default class SequelizeNotesStore extends AbstractNotesStore {
    async close() {
        closeSequlz();
        sequelize = undefined;
    }
    async update(key, title, body) {
        await connectDB();
        const note = await SQNote.findOne({where: {notekey: key}});
        if (!note) {
            throw new Error(`No note found for ${key}`);
        } else {
            await SQNote.update({title, body}, {where: {notekey: key}});
            //add the emitUpdate method.
            const note = await this.read(key);
            this.emitUpdate(note);
            return note;
        }
    }
    async create(key, title, body) {
        await connectDB();
        const sqnote = await SQNote.create({ //create() 返回一个 Promise，里面是 SQNote 实例对象, 一个 Model instance 就是一行。
            notekey: key, title, body
        });
        //add the emitCreated method.
        const note = new Note(sqnote.notekey, sqnote.title, sqnote.body);
        this.emitCreated(note);
        return note;
    }
    async read(key) {
        await connectDB();
        //注意这里的 note 返回的一个 Promise<SQNote> 对象，而不是 Note 实例对象。
        //所以最后 return 的时候，我们返回的不是 note，而是使用 SQNote 实例对象构造一个 Note 实例。
        const note = await SQNote.findOne({where: {notekey: key}});
        if (!note) {
            throw new Error(`no note found for ${key}`);
        } else {
            return new Note(note.notekey, note.title, note.body);
        }
    }
    async destroy(key) {
        await connectDB();
        await SQNote.destroy({where: {notekey: key}});
        //add emitDestroyed method.
        this.emitDestroyed(key);
    }
    async keylist() {
        await connectDB();
        //这里的返回值：Promise<Array<Model>>. 也就是说，notes 是一个数组，里面是多个 Model 实例对象。一个 Model 实例对象就是一行数据。
        const notes = await SQNote.findAll({attributes: ['notekey']});
        debug('find all key list...');
        //一个测试，看看 notes 长啥样。
        // console.log(notes, notes[0]);
        const notekeys = notes.map(note => note.notekey);
        return notekeys;
    }
    async count() {
        await connectDB();
        const count = await SQNote.count();
        return count;
    }
}

/*
* the return value of Model.findAll();
* [
  SQNote {
    dataValues: { notekey: 'second' },
    _previousDataValues: { notekey: 'second' },
    _changed: Set(0) {},
    _options: {
      isNewRecord: false,
      _schema: null,
      _schemaDelimiter: '',
      raw: true,
      attributes: [Array]
    },
    isNewRecord: false
  },
  SQNote {
    dataValues: { notekey: 'third' },
    _previousDataValues: { notekey: 'third' },
    _changed: Set(0) {},
    _options: {
      isNewRecord: false,
      _schema: null,
      _schemaDelimiter: '',
      raw: true,
      attributes: [Array]
    },
    isNewRecord: false
  },
  SQNote {
    dataValues: { notekey: 'this is first note from sequlize' },
    _previousDataValues: { notekey: 'this is first note from sequlize' },
    _changed: Set(0) {},
    _options: {
      isNewRecord: false,
      _schema: null,
      _schemaDelimiter: '',
      raw: true,
      attributes: [Array]
    },
    isNewRecord: false
  }
]
* */