import { Widget } from "./Widget";
import { Panel } from "../../panel/Panel";
import { Widgets } from "neo-blessed";
import { Reader } from "../../common/Reader";
import { File } from "../../common/File";
import { strWidth } from "neo-blessed/lib/unicode";
import { scrstrncpy } from "../ScreenUtils";
import { sprintf } from "sprintf-js";
import { StringUtils } from "../../common/StringUtils";
import { Logger } from "../../common/Logger";
import { messageBox } from "./MessageBox";
import { T } from "../../common/Translation";
import { ColorConfig } from "../../config/ColorConfig";
import { RefreshType } from "../../config/KeyMapConfig";
import * as fs from "fs";

const log = Logger("FileListWidget");

export class FileBox extends Widget {
    private _file: File = null;
    private _positionNo: number = -1;
    private _viewFocus: boolean = false;
    private connectionListWidget: ConnectionListWidget = null;
    
    constructor( parent: ConnectionListWidget, opts: Widgets.BoxOptions ) {
        super({
            ...opts,
            clickable: true,
            wrap: false
        });
        this.connectionListWidget = parent;

        this.on("focus", () => {
            this.connectionListWidget.setFocus();
        });
    }

    getPosNo() {
        return this._positionNo;
    }

    getFile() {
        return this._file;
    }

    setFileFocus( focus: boolean ) {
        this._viewFocus = focus;
    }

    setFile( file: File, focus: boolean, position: number ) {
        this._file = file;
        this._viewFocus = focus;
        this._positionNo = position;
    }

    convertFilename(filenameMaxSize: number) {
        let fileName = this._file.name;
        if ( this._file.link ) {
            fileName = this._file.name + " -> " + (this._file.link.file ? this._file.link.file.fullname : this._file.link.name);
        }
        // 맥에서 한글자모 분리 오류 수정(Unicode 정규화 방식)
        fileName = fileName.normalize();

        const repeatSize = filenameMaxSize - strWidth(fileName);
        let textFileName = fileName;
        if ( repeatSize > 0 ) {
            textFileName = fileName + " ".repeat(repeatSize);
        } else if ( repeatSize < 0 ) {
            textFileName = scrstrncpy( fileName, 0, filenameMaxSize - 1) + "~";
        }
        return textFileName;
    }

    convertFileSize() {
        let tailview = "[ SubDir ]";
        if ( !this._file.dir ) {
            if ( this._file.size >= 1000000000) {
                tailview = sprintf("%9.2f{yellow-fg}G{/yellow-fg}", this._file.size / 1073741824);
            } else if ( this._file.size >= 10000000) {
                tailview = sprintf("%9.2f{yellow-fg}M{/yellow-fg}", this._file.size / 1048576);
            } else {
                tailview = sprintf("%10s", StringUtils.toregular(this._file.size));
            }
        }
        return tailview;
    }

    convertName( name, nameMaxSize, preSpace: boolean = false ) {
        const repeatSize = nameMaxSize - strWidth(name);
        let textFileName = name;
        if ( repeatSize > 0 ) {
            if ( preSpace ) {
                textFileName = " ".repeat(repeatSize) + name;
            } else {
                textFileName = name + " ".repeat(repeatSize);
            }
        } else if ( repeatSize < 0 ) {
            textFileName = scrstrncpy( name, 0, nameMaxSize - 1) + "~";
        }
        return textFileName;
    }

    drawTypeTwo() {
        const { fontColorName, backColorName } = this._file.color;
        const { name, host, port } = this._file.extendInfo || {};
        
        let viewText = null;
        if ( name && host && port ) {
            const textName = this.convertName(name, 20);
            const textHost = this.convertName(host, 20);
            const textPort = this.convertName(port + "", 5, true);
            const select = this._file.select ? "{white-fg}*{/}" : " ";
            viewText = sprintf("%s%s %10s %5s", select, textName, textHost, textPort);
        } else {
            const textFileName = this.convertFilename(this.width as number - 12);
            const tailview = this.convertFileSize();
            const select = this._file.select ? "{white-fg}*{/}" : " ";
            viewText = sprintf("%s%s %10s", select, textFileName, tailview);
        }
        log.debug( viewText );
        this.box.setContent(viewText);
    }

    draw() {
        if ( !this._file ) {
            return;
        }

        const listColor = ColorConfig.instance().getBaseColor("list");
        const listAColor = ColorConfig.instance().getBaseColor("listA");

        if ( this.connectionListWidget.hasFocus() && this._viewFocus ) {
            this.box.style = listAColor.blessedReverse;
        } else {
            this.box.style = this._viewFocus ? listColor.blessedReverse : listColor.blessed;
        }
        this.drawTypeTwo();
    }
}

export class ConnectionListWidget extends Panel {
    private keylock: boolean = false;
    public fileBox: FileBox[] = [];
    public baseWidget: Widget = null;
    private basePath: string = null;
    
    constructor( opts: Widgets.BoxOptions | any, reader: Reader = null) {
        super( reader );
        this.baseWidget = new Widget(opts);
        this.init();
    }

    get aliasName() {
        return this.baseWidget.aliasName;
    }

    get screen() {
        return this.box && this.box.screen;
    }

    set disable( disable: boolean ) {
        this.baseWidget.disable = disable;
    }
    get disable() {
        return this.baseWidget.disable;
    }

    setFront() {
        this.box.setFront();
    }

    setBack() {
        this.box.setBack();
    }

    off() {
        this.box.removeAllListeners();
    }

    on(event: string | string[], listener: (...args: any[]) => void) {
        if ( Array.isArray( event ) ) {
            event.forEach( item => {
                this.box.on( item, listener );
            });
        } else {
            this.box.on( event, listener );
        }
    }

    emit( event: string, opt?: any ) {
        this.box.emit( event, opt );
    }

    get box() {
        return this.baseWidget.box;
    }

    set height( height: number ) {
        this.baseWidget.box.height = height;
    }

    get height() {
        return this.baseWidget.box.height as number;
    }

    set width( width: number ) {
        this.baseWidget.box.width = width;
    }

    get width() {
        return this.baseWidget.box.width as number;
    }

    getWidget() {
        return this.baseWidget;
    }

    hasFocus() {
        return this.baseWidget.hasFocus();
    }

    setFocus() {
        log.debug( "ConnectionListWidget focus !!!");
        this.baseWidget.setFocus();
    }

    init() {
        this.initRender();

        this.baseWidget.on("keypress", async (ch, keyinfo) => {
            log.debug( "FileList KEY: [%s] [%j]", ch, keyinfo );
            await this.listener(ch, keyinfo);
        });

        this.baseWidget.on( "widget.doubleclick", async () => {
            await this.keyEnterPromise();
            this.box.screen.render();
        });

        this.baseWidget.on( "widget.click", () => {
            this.setFocus();
            this.box.screen.render();
        });

        this.box.style = ColorConfig.instance().getBaseColor("input").blessed;
    }

    initRender() {
        log.info("initRender : fileBox.size : %d", this.fileBox.length);
        this.baseWidget.on("prerender", () => {
            const startTime = Date.now();
            log.debug("Panel prerender !!! - Start %d", this.baseWidget._viewCount);
            this.resize();
            this.beforeRender();
            log.debug("BlessedPanel prerender !!! - End %d - [%dms]", this.baseWidget._viewCount, Date.now() - startTime);
        });
    
        this.baseWidget.on("detach", () => {
            log.debug("panel detach !!! - %d", this.baseWidget._viewCount);
        });
    }

    viewName() {
        return "FileListPanel";
    }

    getReader(): Reader {
        return this.reader;
    }

    setReader(reader: Reader) {
        super.setReader(reader);
    }

    hide() {
        this.baseWidget.hide();
    }

    show() {
        this.baseWidget.show();
    }

    destroy() {
        this.fileBox.map(item => {
            item.destroy();
        });        
        this.baseWidget.destroy();
        this.baseWidget = null;
    }

    keyUp() {        
        if ( this.currentPos > 0 ) {
            this.currentPos = this.currentPos - 1;
        } else if ( this.currentPos === 0 ) {
            this.keyShiftTab();
        }
    }

    keyDown() {
        if ( this.currentPos < this.dirFiles.length - 1 ) {
            this.currentPos = this.currentPos + 1;
        } else if ( this.currentPos === this.dirFiles.length - 1 ) {
            this.keyTab();
        }
    }

    keyTab() {  
        this.emit( "widget.tab" );
    }

    keyShiftTab() {
        this.emit( "widget.shifttab" );
    }

    keySpace() {
        this.toggleSelect();
    }

    async keyEnterPromise(): Promise<any> {
        const result = await super.keyEnterPromise();
        if (!result) {
            const currentFile: File = this.dirFiles[this.currentPos];
            log.debug( currentFile );
            this.emit( "widget.return", currentFile );
        }
        return RefreshType.ALL;
    }

    setBasePath( fullPath: string ) {
        this.basePath = fullPath;
    }

    getViewJsonFiles() {
        return this.dirFiles.filter(item => item.extname === ".json" );
    }

    async read(path: string | File, throwMsgBoxShow: boolean = true): Promise<void> {
        try {
            await super.read(path);

            log.warn("this._currentDir.fullname: [%s][%s]", this._currentDir.fullname, this.basePath);
            this.dirFiles = this.dirFiles.filter( (item) => {
                if ( this._currentDir.fullname === this.basePath && item.name === ".." ) {
                    return false;
                }
                return true;
            });
        } catch (e) {
            log.error("READ FAIL - [%s] [%s]", path, e.stack);
            if ( throwMsgBoxShow ) {
                await messageBox({ parent: this.baseWidget, title: T("Error"), msg: e.toString(), button: [ T("OK") ] });
            } else {
                throw e;
            }
        }
    }

    filter( file: File ): boolean {
        if ( file.dir ) {
            return true;
        }

        log.debug( "file: [%s] [%s]", file.fullname, file.extname );
        if ( !file.dir && file.extname === ".json" ) {
            const text = fs.readFileSync( file.fullname, { encoding: "utf8" } );
            if ( !text ) {
                return false;
            }
            try {
                file.extendInfo = JSON.parse(text);
                if ( file.extendInfo.name && file.extendInfo.host ) {
                    return true;
                }
            } catch( e ) {
                log.debug( e );
                return false;
            }
        }
        return false;
    }

    resize() {
        // const MAX_COLUMN = 6;
        const dirLength = this.dirFiles.length;
        const viewHeight = this.baseWidget.height as number - 2;
        
        this.column = 1;
        const row = Math.round((dirLength + this.column - 1) / this.column);
        if (row <= (this.baseWidget.height as number) - 2) {
            this.row = row;
        } else {
            this.row = this.baseWidget.height as number - 2;
        }
        if (this.column !== 0 && this.row !== 0) {
            this.page = Math.floor(this.currentPos / (this.column * this.row));
        }
        this.fileBox.map(item => {
            item.destroy();
        });
        this.fileBox = [];
        for (let n = 0; n < this.row; n++) {
            this.fileBox.push(new FileBox( this, { parent: this.baseWidget as any, focusable: true }));
        }
        log.info("init Render : COL:%d, ROW:%d, PAGE:%d, currentPos:%d fileBoxLen: %d - viewHeight: %d", this.column, this.row, this.page, this.currentPos, this.fileBox.length, viewHeight);
    }

    beforeRender() {
        log.info("BlessedPanel beforeRender() - COL: %d, ROW: %d", this.column, this.row);

        let curPos = this.row * this.page;
        
        let num = 0;
        for (let row = 0; row < this.row; row++) {
            const fileBox = this.fileBox[num++];
            fileBox.height = 1;
            fileBox.width = this.baseWidget.width;
            fileBox.top = row;
            // fileBox.left = col * (itemWidth + 2);
            fileBox.left = 0;
            if (curPos < this.dirFiles.length) {
                log.debug( "SET_POS: %d, CUR_POS: %d", curPos, this.currentPos );
                fileBox.setFile(this.dirFiles[curPos], curPos === this.currentPos, curPos);
            } else {
                fileBox.setFile(null, false, -1);
            }
            curPos++;
        }
        log.info("FileBox: CUR: %d SIZE: %d", this.currentPos, this.fileBox.length);
    }

    render() {
        this.resize();
        this.beforeRender();
    }

    async listener(ch, key) {
        if ( !this.hasFocus() ) {
            return;
        }

        if ( this.keylock ) {
            return;
        }
        this.keylock = true;
        const keyRelease = (render = false) => {
            if ( render && this.box ) {
                this.render();
                this.box.screen.render();
            }
            this.keylock = false;
        };

        const camelize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, "");
        };

        if ( key && key.name ) {
            const methodName = camelize("key " + key.name);
            if ( this[methodName] ) {
                log.debug( "FileListWidget.%s()", methodName );
                this[methodName]();
                keyRelease(true);
                return;
            } else if ( this[methodName + "Promise"] ) {
                log.debug( "FileListWidget.%sPromise()", methodName );
                await this[methodName + "Promise"]();
                keyRelease(true);
                return;
            }
        }
        keyRelease(false);
    }
}
