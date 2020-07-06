import { IDecPrivateModes } from "panel_blassed/xterm/common/Types";
import { DoData } from "./EditorClipboard";
import { File } from "../common/File";
import fs from "fs";

interface IEditorBuffer {
    textLine: number;       // Text Position
    viewLine: number;       // screen view position
    nextLineNum: number;    // if over the one line, line number.
    isNext: boolean;        // Is this line over the one line?
    text: string;
};

interface IEditSelect {
    x1: number;
    y1: number; // select first position(x,y)
    x2: number; 
    y2: number; // select last position (x,y)
};

enum EDIT_MODE {
    EDIT,            /// Edit Mode
    SELECT,            /// Select Mode
    BLOCK,            /// Block Select Mode
    SHIFT_SELECT    /// Shift Mode
};

export abstract class Editor {
    line: number = 0;
    column: number = 0;
    curColumnMax: number = 0;

    firstLine: number = 0;
    lastLine: number = 0;
    viewCol: number = 0;
    viewLine: number = 0;

    curLine: number = 0;
    curColumn: number = 0;

    isLineNumView: boolean = false;
    isInsert: boolean = false;
    isIndentMode: boolean = false;

    editMode: EDIT_MODE = EDIT_MODE.EDIT;
    editSelect: IEditSelect = null;

    lineWidth: number = 0;
    tabSize: number = 8;

    isReadOnly: boolean = false;
    isDosMode: boolean = false;

    title: string = "";
    encoding: string = "utf8";
    fileName: string = null;

    isBackup: boolean = false;

    findStr: string = "";
    indexFindPosX: number = 0;
    indexFindPosY: number = 0;

    viewBuffers: IEditorBuffer[];
    buffers: string[];
    doInfo: DoData[];

    constructor() {
        
    }

    destory() {
        this.doInfo = null;
    }

    abstract postLoad(): void;
    abstract postUpdateLines( line: number, height: number ): void;

    public selectSort( editSelect: IEditSelect ) {

    }

    public selectDel() {

    }

    public screenMemSave( line: number, column: number ) {

    }
    
    setViewTitle( title = "" ) {
        this.title = title;
    }

    setEditor( tabSize: 8, backup: false, isLineNumView: boolean ) {
        this.tabSize = tabSize;
        this.isBackup = backup;
        this.isLineNumView = isLineNumView;
    }

    newFile( fileName: string ) {
        this.fileName = fileName;
        this.buffers = [];
        this.encoding = "utf8";
        this.firstLine = 0;
        this.curLine = 0;
        this.curColumn = 0;
        this.curColumnMax = 0;
        this.isInsert = true;        
        this.findStr = "";
        this.indexFindPosX = 0;
        this.indexFindPosY = 0;
        this.doInfo = null;
    }

    load( file: string | File, isReadonly: boolean = false ): boolean {
        let fileName = (file instanceof File) ? file.fullname : file;
        if ( !fileName ) {
            return false;
        }

        this.newFile(fileName);

        let fsData = fs.readFileSync( fileName, this.encoding );
        if ( !fsData ) {
            return false;
        }
        let dosMode = false;
        fsData.split("\n").map( (item) => {
            item = this.tabToEdit( item, "\t", this.tabSize );
            let item2 = item.replace( new RegExp("\r"), "");
            if ( item2 !== item ) {
                dosMode = true;
            }
            this.buffers.push( item2 );
        });
        this.isDosMode = dosMode;
        this.postLoad();
        return true;
    }

    save( file: string | File, encoding: string = null, backup: boolean = false ) {

    }

    tabToEdit( text: string, tabChar: string, tabSize: number ): string {
        return text.replace( new RegExp(tabChar, "g"), tabChar.repeat(tabSize) );
    }

    editToTab( text: string, tabChar: string, tabSize: number ): string {
        return text.replace( new RegExp(tabChar, "g"), tabChar.repeat(tabSize) );
    }

    lineNumberView() {
        this.isLineNumView = !this.isLineNumView;
    }

    keyLeft() {}
    keyRight() {}
    keyUp() {}
    keyDown() {}
    keyShiftLeft() {}
    keyShiftRight() {}
    keyShiftUp() {}
    keyShiftDown() {}

    keyInsert() {
        this.isInsert = !this.isInsert;
    }

    keyDelete() {
        
    }

    keyBS() {
        
    }

    keyTab() {

    }

    keyUntab() {

    }

    indentMode() {
        this.isIndentMode = !this.indentMode;
    }

    inputData( textStr: string ) {

    }
        
    keyHome() {}
    keyEnd() {}
    keyPgUp() {}
    keyPgDn() {}
    keyEnter() {}
    keyMouse() {}
    gotoLine() {}
    gotoFirst() {}
    gotoEnd() {}
    
    copy() {

    }

    cut() {

    }

    paste() {

    }

    undo() {
        
    }

    keyEscape() {

    }

    select() {

    }

    selectAll() {

    }

    blockSelct() {

    }

    fileNew() {

    }

    fileSave() {

    }

    fileSaveAs() {

    }

    find() {

    }

    findNext() {

    }

    filePrevios() {

    }

    quit() {

    }

    isEditMode() {
        return this.editMode === EDIT_MODE.EDIT;
    }
};