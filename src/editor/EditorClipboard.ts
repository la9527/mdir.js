export enum STATE_CLIPBOARD {
    Copy,
    Cut,
    None
}

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
    
    static instance(): EditorClipboard {
        if ( !(global as any).editorClipboard ) {
            (global as any).editorClipboard = new EditorClipboard();
        }
        return (global as any).editorClipboard;
    }
}

/// Undo, Redo Implement
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
