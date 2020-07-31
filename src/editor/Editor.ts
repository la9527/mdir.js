import { screen } from "neo-blessed/lib/widgets/screen";
import { strWidth } from "neo-blessed/lib/unicode";
import { DoData, EditorClipboard, STATE_CLIPBOARD } from "./EditorClipboard";
import { File } from "../common/File";
import fs from "fs";
import { Logger } from "../common/Logger";
import { StringUtils, StringLineToken } from "../common/StringUtils";
import { FileReader, convertAttrToStatMode } from "../panel/FileReader";
import { T } from "../common/Translation";
import * as jschardet from "jschardet";
import * as iconv from "iconv-lite";
import { message } from '../../@types/blessed';

const log = Logger( "editor" );

export interface IViewBuffer {
    textLine ?: number;       // Text Position
    viewLine ?: number;       // screen view position
    nextLineNum ?: number;    // if over the one line, line number.
    isNext ?: boolean;        // Is this line over the one line?
    text ?: string;
    selectInfo ?: {           // selected position
        all ?: boolean;         // selected line all
        start ?: number;        // selected start position 
        end ?: number;          // selected end position
    }
};

export interface IEditSelect {
    x1: number;
    y1: number; // select first position(x,y)
    x2: number; 
    y2: number; // select last position (x,y)
};

export enum EDIT_MODE {
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

    isInsert: boolean = false;
    isIndentMode: boolean = false;

    editMode: EDIT_MODE = EDIT_MODE.EDIT;
    editSelect: IEditSelect = { x1: 0, x2: 0, y1: 0, y2: 0 };

    tabSize: number = 8;

    isReadOnly: boolean = false;
    isDosMode: boolean = false;

    title: string = "";
    encoding: string = "utf8";
    file: File = null;

    isBackup: boolean = false;

    findStr: string = "";
    indexFindPosX: number = 0;
    indexFindPosY: number = 0;

    viewBuffers: IViewBuffer[];
    buffers: string[];
    doInfo: DoData[];
    lastDoInfoLength: number = 0;

    constructor() {
        
    }

    destory() {
        this.doInfo = [];
    }

    abstract postLoad(): void;
    abstract postUpdateLines( line?: number, height?: number ): void;

    abstract inputBox(title: string, text: string, inputedText ?: string, buttons ?: string[]): Promise<string[]>;
    abstract messageBox(title, text, buttons ?: string[]): Promise<string>;

    public selectSort(editSelect: IEditSelect) {
        if ( !editSelect ) return;

        let swap = ( obj: any, keyA: string, keyB: string ) => {
            let tmp = obj[keyA];
            obj[keyA] = obj[keyB];
            obj[keyB] = tmp;
        };

        if ( editSelect.y1 > editSelect.y2 ) {
            swap( editSelect, "y1", "y2" );
            swap( editSelect, "x1", "x2" );
        } else if ( editSelect.y1 === editSelect.y2 ) {
            if ( editSelect.x1 > editSelect.x2 ) {
                swap( editSelect, "y1", "y2" );
                swap( editSelect, "x1", "x2" );
            }
        }
    }

    public selectedDel() {
        if ( this.isReadOnly ) return;
        
        this.selectSort(this.editSelect);

        if ( this.editSelect.y2 >= this.buffers.length ) {
            this.editMode = EDIT_MODE.EDIT;
            return;
        }

        if ( this.editSelect.y1 === this.editSelect.y2 ) {
            let str = this.buffers[ this.editSelect.y1 ];

            this.doInfo.push( new DoData(this.curLine, this.curColumn, [ str ] ));

            let str1 = StringUtils.scrSubstr(str, 0, this.editSelect.x1);
            let str2 = StringUtils.scrSubstr(str, this.editSelect.x2, strWidth(str) - this.editSelect.x2 );
            this.buffers[ this.editSelect.y1 ] = str1 + str2;
        } else {
            let saveTexts = [];

            let str1 = this.buffers[ this.editSelect.y1 ];
            let str2 = this.buffers[ this.editSelect.y2 ];
            let str3 = StringUtils.scrSubstr(str1, 0, this.editSelect.x1);
            let str4 = StringUtils.scrSubstr(str2, this.editSelect.x2);
            let str = str3 + str4;

            for ( let y = this.editSelect.y1; y < this.editSelect.y2; ++y ) {
                if ( this.editSelect.y1 === y ) {
                    saveTexts.push( str1 );
                    this.buffers[this.editSelect.y1] = str;
                } else if ( this.editSelect.y2 === y ) {
                    saveTexts.push( str2 );
                    this.buffers[this.editSelect.y2] = str;
                    this.buffers.splice(this.editSelect.y1 + 1, 1);
                } else {
                    saveTexts.push( this.buffers[ this.editSelect.y1 + 1 ] );
                    this.buffers.splice(this.editSelect.y1 + 1, 1);
                }

            }

            this.postUpdateLines( this.editSelect.y1, this.editSelect.y2 - this.editSelect.y1 + 1 );

            this.doInfo.push( new DoData(this.editSelect.y1, this.editSelect.x1, saveTexts ));
        }

        this.curLine = this.editSelect.y1;
        this.curColumn = this.editSelect.x1;
        this.curColumnMax = this.curColumn;

        if ( this.curLine < this.firstLine ) this.firstLine = this.curLine - 10;
        this.editMode = EDIT_MODE.EDIT;

        if ( this.buffers.length === 0 ) {
            this.buffers.push( " " );
        }
    }

    public screenMemSave( line: number, column: number ) {
        if ( this.curLine > 0 ) {
            if ( this.curLine >= this.buffers.length) this.curLine = this.buffers.length - 1;
            if ( this.curLine <= this.firstLine ) this.firstLine = this.firstLine - 1;
            if ( this.firstLine <= 0 ) this.firstLine = 0;
            if ( this.lastLine - this.firstLine >= 10 && this.lastLine - this.curLine <= 0 ) {
                if ( this.viewBuffers.length >= this.line ) {
                    if ( this.firstLine <= this.buffers.length ) {
                        this.firstLine++;
                    }
                    if ( this.buffers.length <= this.line - 5 ) {
                        this.firstLine = 0;
                    }
                }
            }
        }

        let isInside = (start: number, end: number, pos: number) => {
            return (start <= pos && end >= pos);
        };

        let editSelect = { ...this.editSelect };
        this.selectSort(editSelect);

        log.debug( "screenMemSave: line [%d] column [%d]", line, column);
        
        for(;;) {
            let viewLine = this.firstLine;
            if (viewLine < 0) return;
    
            this.viewBuffers = [];
            let strLineToken = new StringLineToken();

            let isNext = false;
            for ( let t = 0; t < line; t++ ) {
                if ( line <= this.viewBuffers.length ) {
                    log.debug( "this.viewBuffers.length [%d] line [%d]", this.viewBuffers.length, line );
                    break;
                }

                if ( !strLineToken.next(true) ) {
                    if ( viewLine >= this.buffers.length ) break;
                    strLineToken.setString( this.buffers[viewLine++], column );
                }
                let { text: viewStr, pos, endPos } = strLineToken.getToken() || { text: "", pos: 0 };
                let lineInfo: IViewBuffer = {};
                lineInfo.viewLine = t;
                lineInfo.textLine = viewLine - 1;
                lineInfo.text = viewStr;
                lineInfo.isNext = strLineToken.next(true);
                lineInfo.nextLineNum = strLineToken.curLine;

                if ( this.editMode === EDIT_MODE.SELECT || this.editMode === EDIT_MODE.SHIFT_SELECT ) {
                    let selectInfo: any = {};
                    let { x1, y1, x2, y2 } = editSelect;
                    if ( y1 < lineInfo.textLine && y2 > lineInfo.textLine ) {
                        selectInfo.all = true;
                    } else if ( y1 === lineInfo.textLine && y2 === lineInfo.textLine ) {
                        if ( isInside(pos, endPos, x1) && isInside(pos, endPos, x2) ) {
                            selectInfo.start = x1 - pos;
                            selectInfo.end = x2 - pos;
                        } else if ( isInside(pos, endPos, x1) ) {
                            selectInfo.start = x1 - pos;
                            selectInfo.end = -1;
                        } else if ( isInside(pos, endPos, x2) ) {
                            selectInfo.start = -1;
                            selectInfo.end = x2 - pos;
                        } else if ( isInside(x1, x2, pos) && isInside(x1, x2, endPos) ) {
                            selectInfo.all = true;
                        }
                    } else if ( y1 === lineInfo.textLine ) {
                        if ( isInside(pos, endPos, x1) ) {
                            selectInfo.start = x1 - pos;
                            selectInfo.end = -1;
                        } else if ( x1 <= pos ) {
                            selectInfo.all = true;
                        }
                    } else if ( y2 === lineInfo.textLine ) {
                        if ( isInside(pos, endPos, x2) ) {
                            selectInfo.start = -1;
                            selectInfo.end = x2;
                        } else if ( x2 >= endPos ) {
                            selectInfo.all = true;
                        }
                    }
                    lineInfo.selectInfo = selectInfo;
                    /*
                    if ( typeof(lineInfo.selectInfo.start) === "number" ) {
                        log.debug( "SELECT1 [%d/%d] ~ [%d/%d] pos [%d/%d] selectInfo [%j] lineInfo [%j]", 
                                    editSelect.x1, editSelect.y1, editSelect.x2, editSelect.y2, 
                                    pos, endPos, 
                                    selectInfo,
                                    lineInfo );
                    }
                    */
                }
                this.viewBuffers.push( lineInfo );
                strLineToken.next();
            }

            this.lastLine = viewLine - 1;
            //log.debug( "this.viewBuffers.length [%d] this.lastLine [%d]", this.viewBuffers.length, this.lastLine );

            if ( this.viewBuffers.length > line - 3 ) {
                if ( this.lastLine === this.curLine && 
                    this.lastLine < this.viewBuffers.length && this.viewBuffers[this.lastLine].isNext ) {
                    this.firstLine++;
                    continue;
                }
                if ( this.lastLine < this.curLine ) {
                    this.firstLine++;
                    continue;
                }
            }
            break;
        }
    }
    
    setViewTitle( title = "" ) {
        this.title = title;
    }

    setEditor( backup: false ) {
        this.isBackup = backup;
    }

    getFile() {
        return this.file;
    }

    newFile( file: File ) {
        this.file = file;
        this.buffers = [ "" ];
        this.encoding = "utf8";
        this.firstLine = 0;
        this.curLine = 0;
        this.curColumn = 0;
        this.curColumnMax = 0;
        this.isInsert = true;        
        this.findStr = "";
        this.indexFindPosX = 0;
        this.indexFindPosY = 0;
        this.doInfo = [];
        if ( this.file ) {
            this.setViewTitle(this.file.fullname);
        }
    }

    load( file: File, isReadonly: boolean = false ): boolean {
        this.newFile(file);

        if ( file && file.size > 3000000 ) {
            throw new Error("file size is too large. " + file.size);
        }

        let fsData: Buffer = fs.readFileSync( file.fullname ) as any;
        if ( !fsData ) {
            return false;
        }

        const binaryRead = () => {
            this.buffers = [];
            for ( let i = 0; i < fsData.byteLength; i += 20 ) {
                this.buffers.push( fsData.slice(i, i+20).toString("hex") + "\t[" + fsData.slice(i, i+20).toString("ascii") + "]" );
            }
            this.encoding = "binary";
            this.isReadOnly = true;
        };

        let result = null;
        try {
            result = jschardet.detect( fsData );
        } catch ( e ) {
            log.error( e );
        }
        log.info( "jschardet: %j", result );
        try {
            let data = null;
            if ( result && result.encoding ) {
                this.encoding = result.encoding;
                if ( [ "utf8", "ascii" ].indexOf(this.encoding) > -1 ) {
                    data = fsData.toString("utf8");
                } else {
                    data = iconv.decode(fsData, this.encoding);
                }
                this.buffers = [];
                let dosMode = false;
                data.split("\n").map( (item) => {
                    let item2 = item.replace( new RegExp("\r"), "");
                    if ( item2 !== item ) {
                        dosMode = true;
                    }
                    this.buffers.push( item2 );
                });
                this.isDosMode = dosMode;
            } else {
                binaryRead();
            }
        } catch ( e ) {
            log.error( e );
            binaryRead();
        }

        this.postLoad();
        return true;
    }

    save( file: File, encoding: string = null, isBackup: boolean = false ): boolean {
        let fileName = file.fullname;
        if ( !fileName ) {
            return false;
        }

        let mode = convertAttrToStatMode(file) || 0o644;
        let tmpFileName = fileName + ".tmp";
        try {
            let saveData = this.buffers.join( this.isDosMode ? "\r\n" : "\n" );
            if ( this.encoding !== "utf8" ) {
                let bufSaveData: Buffer = iconv.encode(saveData, this.encoding);
                fs.writeFileSync( tmpFileName, bufSaveData, { mode });
            } else {
                fs.writeFileSync( tmpFileName, saveData, { 
                    encoding: encoding || "utf8",
                    mode
                });
            }
        } catch( e ) {
            log.error( e );
            return false;
        }

        if ( isBackup ) {
            try {
                fs.renameSync( fileName, fileName + ".back" );
            } catch( e ) {
                log.error( e );
            }
        }

        try {
            fs.renameSync( tmpFileName, fileName );
            fs.chmodSync( fileName, mode );
            log.debug( "SAVE - CHMOD [%s] [%d]", fileName, mode );
        } catch( e ) {
            log.error( e );
            return false;
        }
        return true;
    }

    keyLeft() {
        if ( this.curColumn > 0 ) {
            let text = StringUtils.scrSubstr(this.buffers[this.curLine], 0, this.curColumn);
            this.curColumn = strWidth(text.substr(0, text.length - 1));
        } else if ( this.curLine > 0) {
            this.curColumn = strWidth(this.buffers[ --this.curLine ]);
        }
        this.keyPressCommon();
    }

    keyRight() {
        let str = this.buffers[this.curLine];
        let strlen = strWidth(str);
        if ( strlen > this.curColumn ) {
            let text = StringUtils.scrSubstr(this.buffers[this.curLine], this.curColumn, strWidth("\t"));
            if ( text ) {
                this.curColumn += strWidth(text.substr(0, 1));
            }
        } else if ( strlen === this.curColumn && this.curLine !== this.buffers.length - 1 ) {
            this.curLine++;
            this.curColumn = 0;
        }
        this.keyPressCommon();
    }

    keyUp() {
        if ( this.curLine > 0 ) this.curLine--;

        if ( this.curColumnMax < this.curColumn ) {
            this.curColumnMax = this.curColumn;
        } else {
            this.curColumn = this.curColumnMax;
        }

        let strlen = strWidth(this.buffers[this.curLine]);
        if ( strlen < this.curColumn ) {
            this.curColumn = strlen;
        } else {
            this.keyRight();
            this.keyLeft();
        }

        this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;
        if ( this.editMode === EDIT_MODE.SHIFT_SELECT ) this.editMode = EDIT_MODE.EDIT;
    }

    keyDown() {
        if ( this.curLine < this.buffers.length - 1 ) this.curLine++;

        if ( this.curColumnMax < this.curColumn ) {
            this.curColumnMax = this.curColumn;
        } else {
            this.curColumn = this.curColumnMax;
        }

        let strlen = strWidth(this.buffers[this.curLine]);
        if ( strlen < this.curColumn ) {
            this.curColumn = strlen;
        } else {
            this.keyRight();
            this.keyLeft();
        }

        this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;
        if ( this.editMode === EDIT_MODE.SHIFT_SELECT ) this.editMode = EDIT_MODE.EDIT;
    }

    shiftMode( func: () => void ) {
        if ( this.editMode !== EDIT_MODE.SHIFT_SELECT ) {
            this.editSelect.x2 = this.curColumn;
            this.editSelect.y2 = this.curLine;
        }
        func();
        this.editMode = EDIT_MODE.SELECT;
    }

    keyShiftLeft() {
        this.shiftMode( () => this.keyLeft() );
    }
    keyShiftRight() {
        this.shiftMode( () => this.keyRight() );
    }
    keyShiftUp() {
        this.shiftMode( () => this.keyUp() );
    }
    keyShiftDown() {
        this.shiftMode( () => this.keyDown() );
    }

    keyInsert() {
        this.isInsert = !this.isInsert;
    }

    keyDelete() {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) {
            this.selectedDel();
            this.editMode = EDIT_MODE.EDIT;
        }

        let line = this.buffers[this.curLine];
        if ( this.curColumn < strWidth(line) ) {
            this.doInfo.push( new DoData(this.curLine, this.curColumn, [ line ]));

            let firstText = StringUtils.scrSubstr(line, 0, this.curColumn);
            let lastText = line.substr(firstText.length + 1);

            line = firstText + lastText;
            this.buffers[this.curLine] = line;
            this.postUpdateLines(this.curLine);
        } else if ( this.curLine + 1 < this.buffers.length ) {
            let line2 = this.buffers[this.curLine + 1];
            this.doInfo.push( new DoData(this.curLine, this.curColumn, [ line2 ] ));

            this.buffers[this.curLine] = line + line2;
            this.buffers.splice( this.curLine, 1 );
            this.postUpdateLines(this.curLine);
        }
        this.curColumnMax = this.curColumn;

        if ( this.buffers.length === 0 ) {
            this.buffers.push( "" );
        }
    }

    keyBS() {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) {
            this.selectedDel();
            this.editMode = EDIT_MODE.EDIT;

            this.curLine = this.editSelect.y1;
            this.curColumn = this.editSelect.x1;
            this.curColumnMax = this.curColumn;
        }

        if ( this.curLine === 0 && this.curColumn === 0 ) return;

        if ( this.buffers.length > this.curLine ) {
            let line = this.buffers[this.curLine];

            let line2 = "";
            if ( this.curColumn === 0 && this.buffers.length > 0 && this.curLine > 0 ) {
                line2 = this.buffers[this.curLine - 1];
                this.doInfo.push( new DoData(this.curLine - 1, this.curColumn, [ line2, line ] ));

                let tmpLine2Width = strWidth( line2 );
                this.buffers[ this.curLine - 1 ] = line2 + line;
                this.buffers.splice( this.curLine, 1 );

                this.postUpdateLines(this.curLine);
                this.keyUp();
                this.curColumn = tmpLine2Width;
            } else {
                let strSize = strWidth( this.buffers[ this.curLine ] );
                if ( this.curColumn <= strSize ) {
                    this.doInfo.push( new DoData(this.curLine, this.curColumn, [ line ] ));

                    let firstText = StringUtils.scrSubstr( this.buffers[this.curLine], 0, this.curColumn );
                    let lastText = this.buffers[this.curLine].substr(firstText.length);
                    firstText = firstText.substr(0, firstText.length - 1);
                    line2 = firstText + lastText;
                    this.curColumn = strWidth(firstText);
                }
                this.buffers[ this.curLine ] = line2;
                this.postUpdateLines( this.curLine );

                this.editSelect.x2 = this.curColumn;
                this.editSelect.y2 = this.curLine;
            }
        }
        this.curColumnMax = this.curColumn;
    }

    keyTab() {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) {
            this.selectSort( this.editSelect );

            let save: string[] = [];
            for ( let y = this.editSelect.y1; y <= this.editSelect.y2; y++ ) {
                save.push( this.buffers[ y ] );
            }
            this.doInfo.push( new DoData(this.editSelect.y1, 0, save, -1 ));
            
            for ( let y = this.editSelect.y1; y <= this.editSelect.y2; y++ ) {
                this.buffers[y] = "\t" + this.buffers[y];
            }
            this.postUpdateLines( this.editSelect.y1, this.editSelect.y2 - this.editSelect.y1 + 1);
        } else {
            this.inputData( "\t" );
        }
    }

    keyUntab() {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) {
            this.selectSort( this.editSelect );

            let save: string[] = [];
            for ( let y = this.editSelect.y1; y <= this.editSelect.y2; y++ ) {
                save.push( this.buffers[ y ] );
            }
            this.doInfo.push( new DoData(this.editSelect.y1, 0, save, -1 ));

            for ( let y = this.editSelect.y1; y <= this.editSelect.y2; y++ ) {
                if ( this.buffers[y].substr(0, 1) === "\t" ) {
                    this.buffers[y] = this.buffers[y].substr(1);
                }
            }
        } else {
            if ( this.buffers[this.curLine].substr(0, 1) === "\t" ) {
                this.buffers[this.curLine] = this.buffers[this.curLine].substr(1);
            }
        }
    }

    indentMode() {
        this.isIndentMode = !this.indentMode;
    }

    inputData( textStr: string ) {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) {
            this.selectedDel();
            this.editMode = EDIT_MODE.EDIT;
        }

        if ( this.curLine < this.buffers.length ) {
            let line = this.buffers[this.curLine] || "";
            this.doInfo.push( new DoData(this.curLine, this.curColumn, [line]) );

            if ( this.isInsert ) {
                line = StringUtils.scrSubstr( line, 0, this.curColumn) + textStr + StringUtils.scrSubstr( line, this.curColumn );
            } else {
                line = StringUtils.scrSubstr( line, 0, this.curColumn) + textStr + StringUtils.scrSubstr( line, this.curColumn + strWidth(textStr) );
            }
            this.buffers[this.curLine] = line;
            this.curColumn += strWidth(textStr);
        }
        this.curColumnMax = this.curColumn;
    }
        
    keyHome() {
        let line = this.buffers[this.curLine];
        let ne = 0, old = this.curColumn;
        for ( let n = 0; n < line.length; n++ ) {
            if (line[n] !== ' ' && line[n] !== "\t") {
                ne = n;
                break;
            }
        }
        this.curColumn = old === ne ? 0 : strWidth(line.substr(0, ne));
        this.keyPressCommon();
    }

    keyEnd() {
        if ( this.buffers[this.curLine] ) {
            this.curColumn = strWidth( this.buffers[this.curLine] );
        } else {
            this.curColumn = 0;
        }
        this.keyPressCommon();
    }

    keyPgUp() {
        let size = this.lastLine - this.firstLine;
        let cur = this.curLine - this.firstLine;

        if ( this.firstLine === 0 ) {
            this.curLine = 0;
        } else {
            this.firstLine = this.firstLine - size;
            if ( this.firstLine < 0 ) this.firstLine = 0;
            this.curLine = this.firstLine + cur;
            if ( this.curLine <= 0 ) this.curLine = 0;
        }

        if ( this.curColumnMax < this.curColumn ) {
            this.curColumnMax = this.curColumn;
        } else {
            this.curColumn = this.curColumnMax;
        }

        let strlen = strWidth(this.buffers[this.curLine]);
        if ( strlen < this.curColumn ) {
            this.curColumn = strlen;
        }
        
        this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;

        if ( this.editMode === EDIT_MODE.SHIFT_SELECT ) this.editMode = EDIT_MODE.EDIT;
    }

    keyPgDn() {
        let size = this.lastLine - this.firstLine;
        let cur = this.curLine - this.firstLine;

        if ( this.buffers.length < this.line - 1 ) {
            this.curLine = this.buffers.length - 1;
        } else if ( this.firstLine > this.buffers.length - this.line + 1 ) {
            this.curLine = this.buffers.length - 1;
        } else {
            this.curLine = this.firstLine + size + cur;
            this.firstLine = this.curLine - cur;

            if ( this.firstLine > this.buffers.length - this.line + 1 ) {
                this.firstLine = this.buffers.length - this.line + 1;
            }
            if ( this.buffers.length <= this.curLine ) {
                this.curLine = this.buffers.length - 1;
            }
        }

        if ( this.curColumnMax < this.curColumn ) {
            this.curColumnMax = this.curColumn;
        } else {
            this.curColumn = this.curColumnMax;
        }

        let strlen = strWidth(this.buffers[this.curLine]);
        if ( strlen < this.curColumn ) {
            this.curColumn = strlen;
        }

        this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;

        if ( this.editMode === EDIT_MODE.SHIFT_SELECT ) this.editMode = EDIT_MODE.EDIT;
    }
    
    keyEnter() {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) {
            this.selectedDel();
            this.editMode = EDIT_MODE.EDIT;
        }

        let line = this.buffers[this.curLine];
        let p1 = "";
        if ( this.indentMode ) {
            for ( let n = 0; n < line.length; n++ ) {
                if (line[n] !== ' ' && line[n] !== "\t") {
                    p1 = line.substr(0, n);
                    break;
                }
            }
        }

        this.doInfo.push( new DoData(this.curLine, this.curColumn, [line], 2) );

        if ( this.buffers.length > this.curLine ) {
            let firstLine = StringUtils.scrSubstr(line, 0, this.curColumn);
            let lastLine = p1 + line.substr(firstLine.length);
            this.buffers.splice( this.curLine, 0, lastLine );
            this.buffers[ this.curLine ] = firstLine;
            this.buffers[ this.curLine+1 ] = lastLine;
            this.postUpdateLines(this.curLine);
        } else {
            this.buffers.push(p1);
        }
        this.screenMemSave( this.line, this.column );
        this.curColumn = p1.length;
        this.curColumnMax = this.curColumn;

        log.debug( "CUR COL: [%d]", this.curColumn);
        this.keyDown();
    }

    keyMouse() {}
    
    async gotoLinePromise() {
        const [ text, button ] = await this.inputBox( T("EditorMsg.TITLE_GOTO_NUMBER"), T("EditorMsg.GOTO_NUMBER"), "", [ T("OK"), T("Cancel") ] );
        if ( button === T("Cancel") ) {
            return;
        }
        let number = -1;
        try {
            number = parseInt( text );
        } catch ( e ) {
            await this.messageBox( T("ERROR"), T("EditorMsg.GOTO_NUMBER_INVALID") );
        }
        if ( number > -1 && number < this.buffers.length ) {
            this.curLine = number - 1;
            if ( this.curLine <= 0 ) this.curLine = 0;
            this.firstLine = this.curLine - 10;
            if ( this.firstLine <= 0 ) this.firstLine = 0;
        } else {
            this.curLine = this.buffers.length - 1;
            this.firstLine = this.curLine - 10;
        }
        this.editMode = EDIT_MODE.EDIT;
    }

    gotoTop() {
        this.curLine = 0;
        this.firstLine = 0;
        this.editMode = EDIT_MODE.EDIT;
    }

    gotoLast() {
        this.curLine = this.buffers.length - 1;
        this.firstLine = this.curLine - 10;
        this.editMode = EDIT_MODE.EDIT;
    }
    
    copy() {
        if ( this.editMode === EDIT_MODE.EDIT ) return;

        this.selectSort( this.editSelect );

        if ( this.editSelect.y2 >= this.buffers.length ) {
            this.editMode = EDIT_MODE.EDIT;
            return;
        }

        let strTexts = [];

        if ( this.editSelect.y1 === this.editSelect.y2 ) {
            let str = StringUtils.scrSubstr(this.buffers[ this.editSelect.y1 ], this.editSelect.x1, this.editSelect.x2 - this.editSelect.x1 );
            strTexts.push( str );
        } else {
            for ( let y = this.editSelect.y1; y <= this.editSelect.y2; y++ ) {
                let str = "";
                if ( this.editSelect.y1 === y ) {
                    str = StringUtils.scrSubstr(this.buffers[y], this.editSelect.x1 );
                } else if ( this.editSelect.y2 === y ) {
                    str = StringUtils.scrSubstr(this.buffers[y], 0, this.editSelect.x2 );
                } else {
                    str = this.buffers[y];
                }
                strTexts.push( str );
            }
        }
        EditorClipboard.instance().set( strTexts, STATE_CLIPBOARD.Copy );

        this.curColumnMax = this.curColumn;
        this.editMode = EDIT_MODE.EDIT;
    }

    cut() {
        if ( this.editMode === EDIT_MODE.EDIT ) return;

        this.selectSort( this.editSelect );

        if ( this.editSelect.y2 >= this.buffers.length ) {
            this.editMode = EDIT_MODE.EDIT;
            return;
        }

        let strTexts = [];

        if ( this.editSelect.y1 === this.editSelect.y2 ) {
            let str = StringUtils.scrSubstr(this.buffers[ this.editSelect.y1 ], this.editSelect.x1, this.editSelect.x2 - this.editSelect.x1 );
            strTexts.push( str );
        } else {
            for ( let y = this.editSelect.y1; y <= this.editSelect.y2; y++ ) {
                let str = "";
                if ( this.editSelect.y1 === y ) {
                    str = StringUtils.scrSubstr(this.buffers[y], this.editSelect.x1 );
                } else if ( this.editSelect.y2 === y ) {
                    str = StringUtils.scrSubstr(this.buffers[y], 0, this.editSelect.x2 );
                } else {
                    str = this.buffers[y];
                }
                strTexts.push( str );
            }
        }
        EditorClipboard.instance().set( strTexts, STATE_CLIPBOARD.Cut );

        this.selectedDel();

        this.curColumnMax = this.curColumn;
        this.editMode = EDIT_MODE.EDIT;
    }

    paste() {
        if ( this.isReadOnly ) return;

        if ( this.editMode !== EDIT_MODE.EDIT ) this.selectedDel();

        let clips = EditorClipboard.instance().get();

        let str = this.buffers[this.curLine];
        let str1 = StringUtils.scrSubstr(str, 0, this.curColumn );
        let str2 = StringUtils.scrSubstr(str, this.curColumn );

        if ( clips.length === 1 ) {
            let clipStr = clips[0];
            
            this.doInfo.push( new DoData(this.curLine, this.curColumn, [this.buffers[this.curLine]]) );
            
            this.buffers[ this.curLine] = str1 + clips[0] + str2;
            this.curColumn += strWidth(clipStr);
            this.postUpdateLines( this.curLine );
        } else {
            this.doInfo.push( new DoData(this.curLine, this.curColumn, [ this.buffers[this.curLine] ], clips.length ) );

            for ( let y = 0; y < clips.length; y++ ) {
                if ( y === 0 ) {
                    this.buffers[ this.curLine ] = str + clips[y];
                } else if ( y === clips.length - 1 ) {
                    let clip = clips[y];
                    let clip2 = clip + str2;
                    this.buffers.splice( this.curLine + y, 0, clip2 );
                    this.curColumn = strWidth(clip2);
                    this.curLine += clips.length - 1;
                } else {
                    this.buffers.splice( this.curLine + y, 0, clips[y] );
                }
            }

            this.postUpdateLines( this.curLine, clips.length + 1 );
        }

        if ( this.curLine > this.lastLine ) {
            this.screenMemSave( this.curLine, this.curColumn );
        }
        this.curColumnMax = this.curColumn;
        this.editMode = EDIT_MODE.EDIT;
    }

    undo() {
        let doData: DoData = null;

        if ( !this.doInfo.length ) return;

        doData = this.doInfo[ this.doInfo.length - 1 ];
        if ( !doData ) return;

        let line = doData.line;

        if ( doData.delSize === -1 ) { // paste tab
            for ( let n = 0; n < doData.texts.length; n++ ) {
                this.buffers[ line + n ] = doData.texts[n];
            }
            this.postUpdateLines( line, doData.texts.length );
        } else if ( doData.delSize === 0 ) { // removed data (insert)
            for( let n = 0; n < doData.texts.length; n++ ) {
                if ( n === 0 ) {
                    this.buffers[line] = doData.texts[n];
                } else {
                    this.buffers.splice( line + n, 0, doData.texts[n] );
                }
            }
            this.postUpdateLines( line, doData.texts.length );

            if ( doData.texts.length > 0 ) {
                this.curLine = line + doData.texts.length - 1;
            }

            if ( this.curLine < this.firstLine ) {
                this.firstLine = this.curLine;
            }
        } else { // inputed data (delete)
            let delSize = doData.delSize;
            let str;

            if ( doData.texts.length === 1 ) {
                str = doData.texts[0];
            }

            for ( let y = line; y <= line+delSize; ++y ) {
                if ( line === y || line+delSize === y ) {
                    this.buffers[line] = str;
                } else {
                    this.buffers.splice( line + 1, 1 );
                }
            }
            this.curLine = doData.line;
            this.postUpdateLines( line );

            if ( this.curLine < this.firstLine ) {
                this.firstLine = this.curLine;
            }
        }

        this.curColumn = doData.column;
        this.doInfo.pop();

        this.curColumnMax = this.curColumn;
    }

    keyEscape() {
        if ( this.editMode !== EDIT_MODE.EDIT ) this.editMode = EDIT_MODE.EDIT;
    }

    select() {
        if ( this.editMode === EDIT_MODE.SELECT ) this.editMode = EDIT_MODE.EDIT;
        else this.editMode = EDIT_MODE.SELECT;

        this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;
        this.editSelect.x1 = this.curColumn;
        this.editSelect.y1 = this.curLine;
    }

    selectAll() {
        this.editMode = EDIT_MODE.SHIFT_SELECT;

        this.editSelect.x1 = 0;
        this.editSelect.y1 = 0;
        this.editSelect.x2 = strWidth( this.buffers[this.buffers.length - 1] );
        this.editSelect.y2 = this.buffers.length - 1;
    }

    blockSelect() {
        this.editMode = EDIT_MODE.BLOCK;
	    this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;
        this.editSelect.x1 = this.curColumn;
        this.editSelect.y1 = this.curLine;
    }

    async fileNewPromise(): Promise<boolean> {
        if ( this.isReadOnly ) {
            await this.messageBox( T("Error"), T("EditorMsg.READ_ONLY_CURRENT_FILE") );
            return false;
        }

        if ( this.lastDoInfoLength !== this.doInfo.length ) {
            let result = await this.messageBox( T("EditorMsg.NewFile"), T("EditorMsg.QUESTION_SAVE_FILE"), [ T("Yes"), T("No") ] );
            if ( result === T("Yes") ) {
                await this.fileSavePromise();
            }
        }

        let [ fileName, button ] = await this.inputBox( T("EditorMsg.NewFile"), T("EditorMsg.INPUT_FILENAME"), "", [ T("OK"), T("Cancel")] );
        if ( button === T("Cancel") ) {
            return false;
        }
        if ( !fileName ) {
            return false;
        }

        let file = FileReader.createFile( fileName, { virtualFile: true } );
        this.newFile( file );
        return true;
    }

    async fileSavePromise(): Promise<boolean> {
        if ( this.isReadOnly ) {
            await this.messageBox( T("Error"), T("EditorMsg.UNABLE_FILE_WRITE") );
            return false;
        }

        try {
            if ( this.save( this.file, this.encoding, this.isBackup ) ) {
                this.lastDoInfoLength = this.doInfo.length;
                return true;
            }
        } catch( e ) {
            log.error( e );
            await this.messageBox( T("Error"), T("EditorMsg.UNABLE_FILE_WRITE") + " " + e.message );
        }
        return false;
    }

    async fileSaveAsPromise(): Promise<boolean> {
        let [ fileName, button ] = await this.inputBox( T("EditorMsg.NewFile"), T("EditorMsg.INPUT_FILENAME"), "", [ T("OK"), T("Cancel")]);
        if ( button === T("Cancel")) {
            return false;
        }
        if ( !fileName ) {
            return false;
        }

        try {
            this.file = FileReader.createFile( fileName );
            if ( this.save( this.file, this.encoding, this.isBackup ) ) {
                this.lastDoInfoLength = this.doInfo.length;
            }
            this.setViewTitle(this.file.fullname);
        } catch( e ) {
            log.error( e );
            await this.messageBox( T("Error"), T("EditorMsg.UNABLE_FILE_WRITE") + " " + e.message );
        }
        return true;
    }

    async findPromise() {
        let find = this.findStr;
        let [ inputText, button ] = await this.inputBox( T("Find"), T("EditorMsg.INPUT_SEARCH_TEXT"), find, [ T("OK"), T("Cancel")] );
        if ( button === T("Cancel")) {
            return;
        }
        if ( !inputText ) {
            return;
        }

        this.findStr = inputText;
        this.indexFindPosX = 0;
        this.indexFindPosY = 0;
        await this.findNextPromise();
    }

    async findNextPromise() {
        if ( !this.findStr ) return;

        if ( this.editMode === EDIT_MODE.EDIT ) {
            this.indexFindPosX = 0;
            this.indexFindPosY = this.curLine;
        }

        for(;;) {
            for( let n = this.indexFindPosY; n < this.buffers.length; n++ ) {
                let idx = this.buffers[n].indexOf(this.findStr, this.indexFindPosX);
                if ( idx > -1 ) {
                    let textSize = strWidth(this.findStr);
                    this.indexFindPosX = idx + textSize;
                    this.indexFindPosY = n;
                    this.editMode = EDIT_MODE.SHIFT_SELECT;
                    this.editSelect.x1 = idx;
                    this.editSelect.y1 = n;
                    this.editSelect.x2 = idx + textSize;
                    this.editSelect.y2 = n;
                    this.curColumn = idx + textSize;
                    this.curLine = n;
                    this.curColumnMax = this.curColumn;
                    this.firstLine = this.curLine - 10;
                    return;
                }
                this.indexFindPosX = 0;
            }
            this.indexFindPosY = 0;

            let result = await this.messageBox( T("EditorMsg.FIND_NEXT"), T("EditorMsg.FIND_END_DOCUMENT"), [ T("Yes"), T("No") ] );
            if ( result === T("Yes") ) {
                break;
            }
        }
    }

    async filePreviousPromise() {
        if ( !this.findStr ) return;

        if ( this.editMode === EDIT_MODE.EDIT ) {
            this.indexFindPosX = 0;
            this.indexFindPosY = this.curLine;
        }

        this.indexFindPosX -= strWidth(this.findStr);

        for(;;) {
            for( let n = this.indexFindPosY; n >= 0; --n ) {
                let idx = this.buffers[n].lastIndexOf(this.findStr);
                if ( idx > -1 ) {
                    let textSize = strWidth(this.findStr);
                    this.indexFindPosX = idx;
                    this.indexFindPosY = n;
                    this.editMode = EDIT_MODE.SHIFT_SELECT;
                    this.editSelect.x1 = idx;
                    this.editSelect.y1 = n;
                    this.editSelect.x2 = idx + textSize;
                    this.editSelect.y2 = n;
                    this.curColumn = idx + textSize;
                    this.curLine = n;
                    this.curColumnMax = this.curColumn;
                    this.firstLine = this.curLine - 10;
                    return;
                }
                if ( n > 0 ) {
                    this.indexFindPosX = strWidth(this.buffers[n-1]);
                }
            }
            this.indexFindPosY = this.buffers.length - 1;

            let result = await this.messageBox( T("FIND_PREVIOUS"), T("EditorMsg.FIND_FIRST_DOCUMENT"), [ T("Yes"), T("No") ] );
            if ( result === T("Yes") ) {
                break;
            }
        }
    }

    async quitPromise(): Promise<boolean> {
        if ( this.isReadOnly ) {
            this.destory();
            return true;
        }

        log.debug( "DO INFO [%j]", this.doInfo );
        if ( this.lastDoInfoLength !== this.doInfo.length ) {
            let result = await this.messageBox( T("Save"), T("EditorMsg.QUIT_QUESTION_UNSAVED"), [ T("Yes"), T("No"), T("Cancel") ]);
            if ( result === T("Yes") ) {
                await this.fileSavePromise();
            } if ( result === T("No") ) {
                log.debug( T("No") );
            } else {
                return false;
            }
        }
        this.destory();
        return true;
    }

    isEditMode() {
        return this.editMode === EDIT_MODE.EDIT;
    }

    keyPressCommon() {
        this.editSelect.x2 = this.curColumn;
        this.editSelect.y2 = this.curLine;
        this.curColumnMax = this.curColumn;
        if ( this.editMode === EDIT_MODE.SHIFT_SELECT ) {
            this.editMode = EDIT_MODE.EDIT;
        }
    }
};
