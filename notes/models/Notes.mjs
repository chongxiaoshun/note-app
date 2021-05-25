import EventEmiter from 'events';

/**
 * 这里就是 class 隐藏成员变量的方法，我们不希望外部的代码
 * 可以直接获取到类中的变量，所以我们可以将类中的 key 值都
 * 设置为 Symbol 的实例，这样的话，从外部通过 classname[
 * key] 的时候，由于外部创建了一个 Symbol 实例，因为其唯一性
 * 的存在，class[key] 是不会得到对应的 value, 也因为此，使用
 * classname[key] 修改 value 值也是不可能的。
 * 当外部代码想要获得 value 的时候，可以使用 note.key()
 * 或者 note.__note_key 获得这个时候会自动地调用 key get()，
 * 返回 note.__note_key 值。
 */
const _note_key = Symbol('key');
const _note_title = Symbol('title');
const _note_body = Symbol('body');

export class Note {
    constructor(key, title, body) {
        this[_note_key] = key;
        this[_note_title] = title;
        this[_note_body] = body;
    }

    get key() { return this[_note_key]; }
    get title() { return this[_note_title]; }
    get body() { return this[_note_body]; }

    set title(newTitle) { this[_note_title] = newTitle; }
    set body(newBody) { this[_note_body] = newBody; }

    //convert the Note objects into or from JSON-formatted text.
    get JSON() {
        return JSON.stringify({
            key: this.key, title: this.title, body: this.body
        });
    }

    static fromJSON(json) {
        const data = JSON.parse(json);
        if (typeof data !== 'object'
            || !data.hasOwnProperty('key')
            || typeof data.key !== 'string'
            || !data.hasOwnProperty('title')
            || typeof data.title !== 'string'
            || !data.hasOwnProperty('body')
            || typeof data.body !== 'string') {
            throw new Error(`Not a Note: ${json}`);
        }
        const note = new Note(data.key, data.title, data.body);
        return note;
    }
}

//make AbstractNotesStore extends EventEmiter class, add some methods to emit events.
export class AbstractNotesStore extends EventEmiter{
    async close() { }
    async update(key, title, body) { }
    async create(key, title, body) { }
    async read(key) { }
    async destroy(key) { }
    async keylist() { }
    async count() { }

    emitCreated(note) {this.emit('notecreated', note);}
    emitUpdate(note) {this.emit('noteupdated', note);}
    emitDestroyed(key) {this.emit('notedestroyed', key);}
}