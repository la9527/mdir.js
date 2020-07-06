export enum STATE_CLIPBOARD {
    Copy,
    Cut,
    None
};

let gEditorClipboard: EditorClipboard = null;

export class EditorClipboard {
    clips: string[];
    clipStatus: STATE_CLIPBOARD;

    set( texts: string[], clipStatus: STATE_CLIPBOARD = STATE_CLIPBOARD.None ) {
        this.clips = texts;
        this.clipStatus = clipStatus;
    }

    get() {
        return this.clips;
    }
    
    static instance() {
        if ( !gEditorClipboard ) {
            gEditorClipboard = new EditorClipboard();
        }
        return gEditorClipboard;
    }
};

/// Undo, Redo information save class
export class DoData {
    line: number;
    column: number;
    texts: string[];
    delSize: number;

    constructor( line: number, column: number, texts: string[], delSize: number = 0 ) {
        this.line = line;
        this.column = column;
        this.texts = texts;
        this.delSize = delSize; 
    }
}
