import { BlessedProgram, Widgets, box, text, colors } from "blessed";
import { Widget } from "./Widget";
import { File } from "../common/File";
import { sprintf } from "sprintf-js";
import { StringUtils } from "../common/StringUtils";
import { Logger } from "../common/Logger";

const log = Logger("filebox");

export class PanelFileBox extends Widget {
    public fileViewType: number = 0;
    public drawType: number = 0;

    private _viewFocus: boolean = false;
    private _file: File = null;
    private _positionNo: number = -1;

    constructor( opts: Widgets.BoxOptions ) {
        super({
            ...opts,
            wrap: false
        });
    }

    setFile( file: File, focus: boolean, position: number ) {
        this._file = file;
        this._viewFocus = focus;
        this._positionNo = position;
    }

    draw() {
        if ( !this._file ) {
            return;
        }

        const d = this._file.mtime;
        const date = [d.getFullYear(), ("0" + (d.getMonth() + 1)).slice(-2), ("0" + d.getDate()).slice(-2)].join("-");
        const time = [("0" + (d.getHours() + 1)).slice(-2), ("0" + (d.getMinutes() + 1)).slice(-2)].join(":");

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
        const width = this.width as number - 39;
        const { font, back, fontHex, backHex } = this._file.color;

        if ( this._viewFocus ) {
            this.box.style.bg = font;
            this.box.style.fg = back === -1 ? 0 : back;
        }

        if ( this._viewFocus ) {
            const item = sprintf(`%10s %10s %5s %-${width}s %10s`, this._file.attr, date, time, this._file.name, tailview);
            log.info( item );
            this.box.setContent(item);
        } else {
            const item = sprintf(`%10s %10s %5s {${fontHex}-fg}%-${width}s %10s{/${fontHex}-fg}`, this._file.attr, date, time, this._file.name, tailview);
            this.box.setContent(item);
        }

        /*
        const item = (this.box as any)._clines;
        log.debug( "data %j, %d, %d", item, item.width, this.box.width );
        */
    }
}
