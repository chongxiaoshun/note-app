import {default as DEG} from 'debug';
const debug = DEG('notes:notes-store');
const error = DEG('notes:error-store');

var _NotesStore;

export async function useModel(model) {
    try {
        let NotesStoreModule = await import(`./notes-${model}.mjs`);
        let NotesStoreClass = NotesStoreModule.default;
        _NotesStore = new NotesStoreClass;
        return _NotesStore;
    } catch(err) {
        throw new Error(`No recognized NoteStore in ${model} because ${err}`);
    }
}

export  { _NotesStore as NotesStore};