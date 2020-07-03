import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";
import { Widget } from "./widget/Widget";
import { File } from "../common/File";
import { sprintf } from "sprintf-js";
import { StringUtils } from "../common/StringUtils";
import { Logger } from "../common/Logger";
import { BlessedPanel } from "./BlessedPanel";
import { scrstrncpy } from "./ScreenUtils";
import { T } from "../common/Translation";

const log = Logger("filebox");

export class PanelFileBox extends Widget {
    public fileViewType: number = 0;

    private _viewOwner: boolean = false;
    private _viewFocus: boolean = false;
    private _file: File = null;
    private _positionNo: number = -1;    
    
    constructor( opts: Widgets.BoxOptions, fileViewType: number, viewOwner: boolean ) {
        super({
            ...opts,
            wrap: false
        });
        this.fileViewType = fileViewType;
        this._viewOwner = viewOwner;
    }

    getPosNo() {
        return this._positionNo;
    }

    getFile() {
        return this._file;
    }

    getFocus() {
        return this._viewFocus;
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
        let tailview = T("[ SubDir ]");
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
        const tailview = this.convertFileSize();
        const { fontColorName, backColorName } = this._file.color;
        const { owner, group, uid, gid } = this._file;

        const select = this._file.select ? "{white-fg}*{/}" : " ";
        const attrLen = this._file.attr.length;        
        const textFileName = this.convertFilename(this.width as number - (29 + attrLen));
        let viewText = null;

        let viewDateTime = "";
        if ( this._viewOwner ) {
            viewDateTime = sprintf("%8s %7s", owner ? owner.substr(0,7) : uid, group ? group.substr(0,7) : gid );
        } else {
            const d = this._file.mtime;
            const date = [d.getFullYear(), ("0" + (d.getMonth() + 1)).slice(-2), ("0" + d.getDate()).slice(-2)].join("-");
            const time = [("0" + (d.getHours() + 1)).slice(-2), ("0" + (d.getMinutes() + 1)).slice(-2)].join(":");
            viewDateTime = sprintf("%10s %5s", date, time);
        }

        if ( this._viewFocus ) {
            viewText = sprintf(`%-${attrLen}s %16s%s%s %10s`, this._file.attr, viewDateTime, select, textFileName, tailview);
        } else {
            viewText = sprintf(`%-${attrLen}s %16s%s{${fontColorName}-fg}%s %10s{/}`, this._file.attr, viewDateTime, select, textFileName, tailview);
        }
        // log.debug( viewText );
        this.box.setContent(viewText);
    }

    drawTypeTwo() {
        const { fontHex, backHex } = this._file.color;

        const textFileName = this.convertFilename(this.width as number - 12);
        const tailview = this.convertFileSize();
        const select = this._file.select ? "{white-fg}*{/}" : " ";

        let viewText = null;
        if ( this._viewFocus ) {
            viewText = sprintf(`%s%s %10s`, select, textFileName, tailview);
        } else {
            viewText = sprintf(`%s{${fontHex}-fg}%s %10s{/${fontHex}-fg}`, select, textFileName, tailview);
        }
        this.box.setContent(viewText);
    }

    drawTypeThree() {
        const { fontColorName, backColorName } = this._file.color;

        const select = this._file.select ? "{white-fg}*{/}" : " ";
        const textFileName = this.convertFilename(this.width as number);

        let viewText = null;
        if ( this._viewFocus ) {
            viewText = sprintf(`%s%s`, select, textFileName);
        } else {
            viewText = sprintf(`%s{${fontColorName}-fg}%s{/}`, select, textFileName);
        }
        this.box.setContent(viewText);
    }

    draw() {
        if ( !this._file ) {
            return;
        }

        if ( this._viewFocus ) {
            const { font, back } = this._file.color;
            this.box.style.bg = font;
            this.box.style.fg = back === -1 ? 0 : back;
        } else {
            this.box.style = { fg: 7 };
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
