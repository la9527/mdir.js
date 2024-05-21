import { Widget } from "./Widget.mjs";
import blessed from "neo-blessed";
import { Widgets } from "neo-blessed";
import { ColorConfig } from "../../config/ColorConfig.mjs";
import { Logger } from "../../common/Logger.mjs";
import mainFrame from "../MainFrame.mjs";
import { StringUtils } from "../../common/StringUtils.mjs";

const { progressbar } = blessed;

const log = Logger("MessageBox");

export interface IProgressOpt {
    title: string;
    msg?: string;
    cancel?: () => void;
}

export class ProgressBox extends Widget {
    private color = null;
    private btnColor = null;
    
    private titleWidget: Widget = null;
    private leftWidget: Widget = null;
    private rightWidget: Widget = null;
    private progressBox: Widgets.ProgressBarElement = null;
    private cancelButton: Widget = null;

    private progressOpt: IProgressOpt = null;
    private leftMessage: string = "";
    private rightMessage: string = "";
    private progress = 0;
    private canceled = false;

    constructor( progressOpt: IProgressOpt, opts: Widgets.BoxOptions | any ) {
        super( { ...opts, top: "center", left: "center", width: "50%", height: 8, border: "line", clickable: true });

        this.box.enableMouse();
        this.progressOpt = progressOpt;
        this.leftMessage = progressOpt.msg;
        this.progress = 0;
        
        this.init();
        log.debug( "ProgressBox (%j)", this.progressOpt );
    }

    getCanceled() {
        return this.canceled;
    }

    resize() {
        const MIN_WIDTH = 50;
        if ( this.box.screen.width as number < MIN_WIDTH ) {
            this.box.width = MIN_WIDTH;
        }
    }

    updateProgress( leftText: string, rightText: string, currentPos: number, endPos: number ) {
        try {
            this.leftMessage = StringUtils.ellipsis( leftText, this.width as number - 36 );
            this.rightMessage = rightText;
            this.progress = Math.round((currentPos * 100) / endPos);
            this.screen.render();
        } catch( e ) {
            log.error( e );
        }
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.btnColor = ColorConfig.instance().getBaseTwoColor("dialog", "func");

        log.debug( "this.color : %s", this.color);

        this.box.style = { ...this.color.blessed, border: this.color.blessed };
        this.titleWidget = new Widget( { 
            parent: this, 
            top: 0, 
            width: "100%-2", 
            height: 1, 
            tags: true, 
            content: this.progressOpt.title, 
            style: this.color.blessedReverse, 
            align: "center" } );

        this.leftWidget = new Widget({
            parent: this,
            top: 3, 
            left: 2,
            width: (this.width as number) - 26,
            tags: true, 
            height: 1, 
            content: this.leftMessage, 
            style: this.color.blessed, 
            align: "left" 
        });

        this.rightWidget = new Widget({
            parent: this,
            top: 3, 
            right: 2,
            width: 26,
            tags: true, 
            height: 1, 
            content: this.rightMessage, 
            style: this.color.blessed, 
            align: "right" 
        });

        this.progressBox = progressbar({
            parent: this.box,
            top: 2,
            left: 2,
            width: (this.width as number) - 6,
            height: 1,
            filled: 0,
            pch : " ",
            orientation: "horizontal",
            style: { bar: { fg: "white", bg: "red" }, bg: "black"  },
            keys: false,
            mouse: false
        });

        this.cancelButton = new Widget( {
            parent: this, 
            tags: true, 
            left: "center",
            align: "center",
            content: "Cancel", 
            clickable: true,
            bottom: 0, 
            height: 1, 
            width: 12,
            style: this.btnColor.blessedReverse
        });

        this.resize();

        this.box.off("keypress", null);
        this.box.on("element click", () => {
            this.destroy();
            this.box.emit("cancel");
        });
        this.box.on("keypress", async (ch, keyInfo) => {
            log.info( "KEYPRESS [%s]", keyInfo.name );
            if ( "enter" === keyInfo.name ) {
                return;
            }

            if ( [ "return", "space" ].indexOf(keyInfo.name) > -1 ) {
                this.destroy();
                this.box.emit("cancel");
                return;
            }
            this.render();
            this.box.screen.render();
        });

        this.on("cancel", () => {
            this.canceled = true;
            this.progressOpt && this.progressOpt.cancel && this.progressOpt.cancel();
        });

        mainFrame().lockKey("progressBar", this);
        this.on("detach", () => {
            mainFrame().lockKeyRelease("progressBar");
        });

        this.setFocus();
        this.box.screen.render();
    }

    draw() {
        this.resize();

        this.titleWidget.setContent( this.progressOpt.title );
        this.leftWidget.setContent( this.leftMessage );
        this.rightWidget.setContent( this.rightMessage );
        log.debug( "PROGRESS DRAW : %d", this.progress );
        this.progressBox.setProgress( this.progress );
    }

    destroy() {
        if ( this.destroyed ) {
            return;
        }
        this.cancelButton.destroy();
        this.titleWidget.destroy();
        this.leftWidget.destroy();
        this.rightWidget.destroy();
        this.progressBox.destroy();
        super.destroy();
        this.destroyed = true;
    }
}
