import { Widget } from './Widget';
import { Widgets, text, button } from 'neo-blessed';
import { ColorConfig } from '../../config/ColorConfig';
import { Logger } from "../../common/Logger";
import { strWidth } from "neo-blessed/lib/unicode";
import mainFrame from '../MainFrame';

const log = Logger("MessageBox");

interface IMessageOption {
    title: string;
    msg: string;
    button: string[];
    result?: (button) => void;
}

enum VIEW_TYPE {
    HORIZONTAL,
    VERTICAL
}

export class MessageBox extends Widget {
    private textWidget: Widget = null;
    private titleWidget: Widget = null;
    private buttonWidgets: Widget[] = [];
    private msgOption: IMessageOption = null;
    private color = null;
    private btnColor = null;
    private focusBtnNum: number = 0;
    private buttonWidth = 0;

    private buttonViewType: VIEW_TYPE = VIEW_TYPE.HORIZONTAL;

    constructor( messageOption: IMessageOption, opts: Widgets.BoxOptions | any ) {
        super( { ...opts, top: "center", left: "center", width: "50%", height: "50%", border: "line", clickable: true });

        this.box.enableMouse();
        this.msgOption = messageOption;

        this.init();
    }

    resize() {
        const MIN_WIDTH = 50;
        const MAX_WIDTH = this.box.screen.width as number;

        const MIN_BUTTON_WIDTH = 12;
        this.buttonWidth = this.msgOption.button.reduce( (pre, item) => pre < item.length + 2 ? item.length + 2 : pre, MIN_BUTTON_WIDTH);

        let buttonAllWidth = this.msgOption.button.length * (this.buttonWidth + 2);
        
        let widthTitle = Math.min( strWidth(this.msgOption.title), MAX_WIDTH );
        let msgLines = this.msgOption.msg.split("\n");
        let widthMsg = msgLines.map( i => strWidth(i) ).reduce( (pre: number, cur: string ) => {
            return Math.min( Math.max(pre, strWidth(cur)), MAX_WIDTH );
        }, MIN_WIDTH );

        if ( buttonAllWidth < MAX_WIDTH ) {
            this.buttonViewType = VIEW_TYPE.HORIZONTAL;            

            this.box.width = Math.max( buttonAllWidth, Math.max(widthTitle, widthMsg) );
            this.box.height = Math.min(msgLines.length + 7, 14);

            log.debug( "RESIZE - HORIZONTAL %d (%d, %d)", msgLines.length, this.box.width, this.box.height );
        } else {
            this.buttonViewType = VIEW_TYPE.VERTICAL;
            this.buttonWidth = Math.max(this.buttonWidth, 20);

            this.box.width = Math.max(widthTitle, widthMsg);
            this.box.height = Math.min(msgLines.length + 5 + this.msgOption.button.length, 14);
            log.debug( "RESIZE - VERTICAL %d (%d, %d)", msgLines.length, this.box.width, this.box.height );
        }

        let len = this.msgOption.button.length;
        this.buttonWidgets.map( (item, i) => {
            if ( this.buttonViewType === VIEW_TYPE.HORIZONTAL ) {
                let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
                item.bottom = 1;
                item.left = left;
                item.width = this.buttonWidth;
            } else {
                // VERITCAL
                let left = Math.round((this.box.width as number) / 2) - Math.round(this.buttonWidth / 2);
                let bottom = len - i - 1;
                item.left = left;
                item.bottom = bottom;
                item.width = this.buttonWidth;
            }
        });
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
            content: this.msgOption.title, 
            style: this.color.blessedReverse, 
            align: "center" } );

        this.textWidget = new Widget( { 
            parent: this, 
            top: 2, 
            width: "100%-2", 
            tags: true, 
            height: 2, 
            content: this.msgOption.msg, 
            style: this.color.blessed, 
            align: "center" 
        } );

        log.debug( "buttonWidth : %d", this.buttonWidth);

        let len = this.msgOption.button.length;
        this.msgOption.button.map( (item, i) => {
            if ( this.buttonViewType === VIEW_TYPE.HORIZONTAL ) {
                let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
                this.buttonWidgets.push( 
                    new Widget( {
                        parent: this, 
                        tags: true, 
                        content: "{center}" + item + "{/center}", 
                        left, 
                        clickable: true,
                        bottom: 1, 
                        height: 1, 
                        width: this.buttonWidth,
                        style: i === 0 ? this.btnColor.blessedReverse : this.btnColor.blessed
                    })
                );
            } else {
                // VERITCAL
                let left = Math.round((this.box.width as number) / 2) - Math.round(this.buttonWidth / 2);
                let bottom = len - i - 1;
                this.buttonWidgets.push( 
                    new Widget( {
                        parent: this, 
                        tags: true, 
                        content: "{center}" + item + "{/center}", 
                        left, 
                        clickable: true,
                        bottom,
                        height: 1, 
                        width: this.buttonWidth,
                        style: i === 0 ? this.btnColor.blessedReverse : this.btnColor.blessed
                    })
                );
            }
        });

        this.resize();

        this.box.off("keypress");
        this.box.on("element click", (el, name) => {
            const number = this.buttonWidgets.findIndex( i => el === i.box );
            if ( number > -1 ) {
                this.destroy();
                this.msgOption.result && this.msgOption.result( this.msgOption.button[number] );
            }
        });
        this.box.on("keypress", async (ch, keyInfo) => {
            log.info( "KEYPRESS [%s]", keyInfo.name );
            if ( "enter" === keyInfo.name ) {
                return;
            }

            if ( [ "tab", "right", "down" ].indexOf(keyInfo.name) > -1 ) {
                this.focusBtnNum = ++this.focusBtnNum % this.buttonWidgets.length;
            } else if ( [ "left", "up" ].indexOf(keyInfo.name) > -1 ) {
                    this.focusBtnNum = --this.focusBtnNum;
                    this.focusBtnNum = this.focusBtnNum < 0 ? this.buttonWidgets.length - 1 : this.focusBtnNum;
            } else if ( [ "return", "space" ].indexOf(keyInfo.name) > -1 ) {
                this.destroy();
                this.msgOption.result && this.msgOption.result( this.msgOption.button[this.focusBtnNum] );
                return;
            }
            this.render();
            this.box.screen.render();
        });

        mainFrame().keyLock = true;
        this.setFocus();
        this.box.screen.render();
    }

    setMessageOption( msgOption ) {
        this.msgOption = msgOption;
    }

    draw() {
        this.resize();

        this.titleWidget.setContent( this.msgOption.title );
        this.textWidget.setContent( this.msgOption.msg );

        this.buttonWidgets.map( (i, n) => {
            i.box.style = (this.focusBtnNum === n ? this.btnColor.blessedReverse : this.btnColor.blessed);
            log.debug( "%d, %s %d", n, i.box.style, this.focusBtnNum );
        });
    }

    destroy() {
        mainFrame().keyLock = false;
        this.titleWidget.destroy();
        this.textWidget.destroy();
        this.buttonWidgets.map( i => i.destroy() );
        super.destroy();
    }
}

export function messageBox( msgOpt: IMessageOption, opts: Widgets.BoxOptions ): Promise<string> {
    return new Promise(( resolve, reject ) => {
        new MessageBox({
            title: msgOpt.title, 
            msg: msgOpt.msg, button: msgOpt.button,
            result: (button) => {
                opts.parent.screen.render();
                resolve( button );
            }
        }, opts);
        opts.parent.screen.render();
    });
}
