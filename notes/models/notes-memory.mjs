import { Note, AbstractNotesStore } from './Notes.mjs';

//注意这里地 notes 是一个 private array, 它存在于这个 module 地命名空间，所以可以被 class 使用，但是不存在与外部 module 。
const notes = [];

export default class InMemoryNotesStore extends AbstractNotesStore {
    async close() { }

    async update(key, title, body) {
        notes[key] = new Note(key, title, body);
        return notes[key];
    }

    async create(key, title, body) {
        notes[key] = new Note(key, title, body);
        return notes[key];
    }

    async read(key) {
        if (notes[key]) return notes[key];
        else throw new Error(`Note ${key} not exist`);
    }

    async destroy(key) {
        if (notes[key]) {
            delete notes[key];
        } else throw new Error(`Note ${key} not exist`);
    }

    async keylist() {
        return Object.keys(notes);
    }

    async count() {
        return notes.length;
    }
}