import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";
import { Widget } from "./Widget";
import { File } from "../common/File";
import { sprintf } from "sprintf-js";
import { StringUtils } from "../common/StringUtils";
import { Logger } from "../common/Logger";
import { BlessedPanel } from "./BlessedPanel";
import { scrstrncpy } from "./ScreenUtils";

const log = Logger("filebox");

export class PanelFileBox extends Widget {
    public fileViewType: number = 0;

    private _viewFocus: boolean = false;
    private _file: File = null;
    private _positionNo: number = -1;
    
    constructor( opts: Widgets.BoxOptions, fileViewType: number ) {
        super({
            ...opts,
            wrap: false
        });
        this.fileViewType = fileViewType;
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

    drawTypeOne() {
        const d = this._file.mtime;
        const date = [d.getFullYear(), ("0" + (d.getMonth() + 1)).slice(-2), ("0" + d.getDate()).slice(-2)].join("-");
        const time = [("0" + (d.getHours() + 1)).slice(-2), ("0" + (d.getMinutes() + 1)).slice(-2)].join(":");

        const tailview = this.convertFileSize();
        const { fontHex, backHex } = this._file.color;

        const textFileName = this.convertFilename(this.width as number - 39);
        // log.info( textFileName );
        
        let viewText = null;
        if ( this._viewFocus ) {
            viewText = sprintf(`%10s %10s %5s %s %10s`, this._file.attr, date, time, textFileName, tailview);
            // log.info( "view position : filebox [%d] [%s]", textFileName.length, this._file.name );
        } else {
            // viewText = sprintf(`%10s %10s %5s %s %10s`, this._file.attr, date, time, textFileName, tailview);
            viewText = sprintf(`%10s %10s %5s {${fontHex}-fg}%s %10s{/${fontHex}-fg}`, this._file.attr, date, time, textFileName, tailview);
        }
        //log.info( viewText );
        this.box.setContent(viewText);
    }

    drawTypeTwo() {
        const { fontHex, backHex } = this._file.color;

        const textFileName = this.convertFilename(this.width as number - 12);
        const tailview = this.convertFileSize();

        let viewText = null;
        if ( this._viewFocus ) {
            viewText = sprintf(`%s %10s`, textFileName, tailview);
            // log.info( "view position : filebox [%d] [%s]", textFileName.length, this._file.name );
        } else {
            viewText = sprintf(`{${fontHex}-fg}%s %10s{/${fontHex}-fg}`, textFileName, tailview);
        }
        log.info( viewText );
        this.box.setContent(viewText);
    }

    drawTypeThree() {
        const { fontHex, backHex } = this._file.color;

        const textFileName = this.convertFilename(this.width as number);

        let viewText = null;
        if ( this._viewFocus ) {
            viewText = sprintf(` %s`, textFileName);
        } else {
            viewText = sprintf(` {${fontHex}-fg}%s{/${fontHex}-fg}`, textFileName);
        }
        log.info( viewText );
        this.box.setContent(viewText);
    }

    draw() {
        if ( !this._file ) {
            return;
        }

        const { font, back } = this._file.color;
        if ( this._viewFocus ) {
            this.box.style.bg = font;
            this.box.style.fg = back === -1 ? 0 : back;
        }

        switch ( this.fileViewType ) {
            case 0: {
                if ( this.width > 50 ) {
                    this.drawTypeOne();
                } else if ( this.width > 30 ) {
                    this.drawTypeTwo();
                } else {
                    this.drawTypeThree();
                }
                break;
            }
            case 1:
                this.drawTypeOne();
                break;
            case 2:
                this.drawTypeTwo();
                break;
            case 3:
            default:
                this.drawTypeThree();
                break;
        }
    }
}
