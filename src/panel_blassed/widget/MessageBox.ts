import { Widgets, text, button } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";

import { Widget } from "./Widget";
import { ColorConfig } from "../../config/ColorConfig";
import { Logger } from "../../common/Logger";
import mainFrame from "../MainFrame";

const log = Logger("MessageBox");

export enum MSG_BUTTON_TYPE {
    AUTO = 0,
    HORIZONTAL = 1,
    VERTICAL = 2
}

interface IMessageOption {
    parent: Widget | Widgets.Screen;
    title: string;
    msg ?: string | any;
    button: string[];
    buttonType ?: MSG_BUTTON_TYPE;
    textAlign ?: string;
    buttonTextAlign ?: string;
    scroll ?: boolean;
    result?: (button: string, buttonPos ?: number ) => void;
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

    private buttonType: MSG_BUTTON_TYPE = MSG_BUTTON_TYPE.AUTO;

    constructor( messageOption: IMessageOption, opts: Widgets.BoxOptions | any ) {
        super( { parent: messageOption.parent, ...opts, top: "center", left: "center", width: "50%", height: "50%", border: "line", clickable: true });

        this.box.enableMouse();
        this.msgOption = messageOption;
        if ( this.msgOption.msg instanceof Error ) {
            this.msgOption.msg = this.msgOption.msg.message;
        } else if ( typeof(this.msgOption.msg) !== "string" ) {
            this.msgOption.msg = JSON.stringify(this.msgOption.msg, null, 2);
        }
        this.init();
    }

    resize() {
        const MIN_WIDTH = 50;
        const MAX_WIDTH = this.box.screen.width as number;

        const MIN_BUTTON_WIDTH = 12;
        this.buttonWidth = this.msgOption.button.reduce( (pre: number, item) => {
            let strWidth = this.box.strWidth(item);
            return pre < strWidth ? strWidth : pre;
        }, MIN_BUTTON_WIDTH);

        let buttonAllWidth = this.msgOption.button.length * (this.buttonWidth + 2);
        
        let widthTitle = Math.min( this.box.strWidth(this.msgOption.title), MAX_WIDTH );
        let msgLines = this.msgOption.msg ? this.msgOption.msg.split("\n") : [];
        let widthMsg = msgLines.reduce( (pre: number, cur: string ) => {
            log.debug( "MessageBox: [%s]", cur );
            return Math.min( Math.max(pre, this.box.strWidth(cur) + 4), MAX_WIDTH );
        }, MIN_WIDTH );

        log.debug( "widthMsg : %s MIN %d MAX %d ", widthMsg, MIN_WIDTH, MAX_WIDTH );

        this.buttonType = this.msgOption.buttonType || MSG_BUTTON_TYPE.AUTO;
        if ( this.buttonType === MSG_BUTTON_TYPE.AUTO ) {
            this.buttonType = buttonAllWidth < MAX_WIDTH ? MSG_BUTTON_TYPE.HORIZONTAL : MSG_BUTTON_TYPE.VERTICAL;
            log.debug( "%s", this.buttonType === MSG_BUTTON_TYPE.HORIZONTAL ? "MSG_BUTTON_TYPE.HORIZONTAL" : "MSG_BUTTON_TYPE.VERTICAL" );
        }

        if ( this.buttonType === MSG_BUTTON_TYPE.HORIZONTAL ) {
            this.box.width = Math.max( buttonAllWidth, Math.max(widthTitle, widthMsg) );
            this.box.height = Math.min((this.msgOption.msg ? (msgLines.length + 7) : 4), this.screen.height as number - 6);

            if ( this.textWidget ) {
                this.textWidget.width = this.box.width - 4;
                this.textWidget.height = Math.min(msgLines.length, this.box.height - 6);
            }

            log.debug( "RESIZE - HORIZONTAL %d (%d, %d)", msgLines.length, this.box.width, this.box.height );
        } else {
            this.buttonWidth = Math.max(this.buttonWidth, 20);
            this.box.width = Math.max( Math.max(widthTitle, widthMsg), this.buttonWidth + 4 );
            this.box.height = Math.min( (this.msgOption.msg ? (msgLines.length + 5) : 4) + this.msgOption.button.length + 2, this.screen.height as number - 6);
            log.debug( "RESIZE - VERTICAL %d (%d, %d)", msgLines.length, this.box.width, this.box.height );

            if ( this.textWidget ) {
                this.textWidget.width = this.box.width - 4;
                this.textWidget.height = Math.min(msgLines.length, this.box.height - 6);
            }
        }

        let len = this.msgOption.button.length;
        this.buttonWidgets.map( (item, i) => {
            if ( this.buttonType === MSG_BUTTON_TYPE.HORIZONTAL ) {
                let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
                item.bottom = 1;
                item.left = left;
                item.width = this.buttonWidth;
            } else {
                // VERITCAL
                let left = Math.floor((this.box.width as number) / 2) - Math.floor(this.buttonWidth / 2);
                let bottom = len - i;
                item.left = left - 1;
                item.bottom = bottom;
                item.width = this.buttonWidth;
            }
        });
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.btnColor = ColorConfig.instance().getBaseColor("dialog");

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


        log.debug( "init: %s", this.msgOption );

        if ( this.msgOption.msg ) {
            let scrollOption = this.msgOption.scroll ?
                {
                    alwaysScroll: true,
                    scrollable: true,
                    scrollbar: {
                        style: {
                            bg: "blue",
                            fg: "default"
                        },
                        track: this.color.blessedReverse
                    }
                } : {};

            this.textWidget = new Widget( { 
                parent: this.box, 
                top: 2, 
                left: 1,
                width: "100%-2", 
                tags: true, 
                // ignoreKeys: true,
                ...scrollOption,
                style: this.color.blessed, 
                height: 2, 
                content: this.msgOption.msg, 
                align: this.msgOption.textAlign || "center"
            } );

            log.debug( "this.msgOption.msg: %s", this.msgOption.msg );
        }

        log.debug( "buttonWidth : %d", this.buttonWidth);

        let len = this.msgOption.button.length;
        this.msgOption.button.map( (item, i) => {
            if ( this.buttonType === MSG_BUTTON_TYPE.HORIZONTAL ) {
                let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
                this.buttonWidgets.push( 
                    new Widget( {
                        parent: this, 
                        tags: true, 
                        content: "{center}" + item + "{/center}", 
                        align: this.msgOption.buttonTextAlign || "center",
                        left: left - 1,
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
                        content: item,
                        align: this.msgOption.buttonTextAlign || "center",
                        left: left - 1,
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

            if ( !this.msgOption.scroll ) {
                if ( keyInfo.name === "up" ) {
                    keyInfo.name = "left";
                } else if ( keyInfo.name === "down" ) {
                    keyInfo.name = "right";
                } else if ( [ "pageup" ].indexOf(keyInfo.name) > -1 ) {
                    this.focusBtnNum = 0;
                } else if ( [ "pagedown" ].indexOf(keyInfo.name) > -1 ) {
                    this.focusBtnNum = this.buttonWidgets.length - 1;
                }
            }
            if ( [ "tab", "right" ].indexOf(keyInfo.name) > -1 ) {
                this.focusBtnNum = ++this.focusBtnNum % this.buttonWidgets.length;
            } else if ( [ "left" ].indexOf(keyInfo.name) > -1 ) {
                this.focusBtnNum = --this.focusBtnNum;
                this.focusBtnNum = this.focusBtnNum < 0 ? this.buttonWidgets.length - 1 : this.focusBtnNum;
            } else if ( [ "up" ].indexOf(keyInfo.name) > -1 ) {
                this.textWidget.box.scroll(-1);
            } if ( [ "down" ].indexOf(keyInfo.name) > -1 ) {
                this.textWidget.box.scroll(1);
            } else if ( this.msgOption.scroll && [ "pageup" ].indexOf(keyInfo.name) > -1 ) {
                this.textWidget.box.scroll(-(this.textWidget.height as number - 1));
            } else if ( this.msgOption.scroll && [ "pagedown" ].indexOf(keyInfo.name) > -1 ) {
                this.textWidget.box.scroll(this.textWidget.height as number - 1);
            } else if ( [ "return", "space", "escape" ].indexOf(keyInfo.name) > -1 ) {
                this.destroy();
                if ( keyInfo.name === "escape" ) {
                    this.msgOption.result && this.msgOption.result( "", -1 );
                } else {
                    this.msgOption.result && this.msgOption.result( this.msgOption.button[this.focusBtnNum], this.focusBtnNum );
                }
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
        this.msgOption.msg && this.textWidget && this.textWidget.setContent( this.msgOption.msg );

        this.buttonWidgets.map( (i, n) => {
            i.box.style = (this.focusBtnNum === n ? this.btnColor.blessedReverse : this.btnColor.blessed);
            log.debug( "%d, %s %d", n, i.box.style, this.focusBtnNum );
        });
    }

    destroy() {
        mainFrame().keyLock = false;
        this.titleWidget.destroy();
        this.textWidget && this.textWidget.destroy();
        this.buttonWidgets.map( i => i.destroy() );
        super.destroy();
    }
}

export function messageBox( msgOpt: IMessageOption, opts: Widgets.BoxOptions = {}): Promise<string> {
    return new Promise(( resolve, reject ) => {
        const screen: any = msgOpt.parent.screen || opts.parent.screen || opts.parent;
        let messgaeBox = null;
        try {
            messgaeBox = new MessageBox({
                parent: screen,
                title: msgOpt.title, 
                msg: msgOpt.msg, button: msgOpt.button,
                buttonType: msgOpt.buttonType,
                textAlign: msgOpt.textAlign,
                buttonTextAlign: msgOpt.buttonTextAlign,
                scroll: msgOpt.scroll,
                result: (button, buttonPos) => {
                    screen.render();
                    resolve( button );
                }
            }, opts);
            screen.render();
        } catch( e ) {
            log.error( e );
            try {
                messgaeBox.destroy();
            } finally {};
            screen.render();
            reject(e);
        }
    });
}
