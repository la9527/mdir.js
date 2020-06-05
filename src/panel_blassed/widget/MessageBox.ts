import { Widget } from './Widget';
import { Widgets, text, button } from 'neo-blessed';
import { ColorConfig } from '../../config/ColorConfig';
import { Logger } from "../../common/Logger";
import { toUnicode } from 'punycode';
import { strWidth } from "neo-blessed/lib/unicode";
import { Z_BEST_COMPRESSION } from 'zlib';

const log = Logger("MessageBox");

interface IMessageOption {
    title: string;
    msg: string;
    button: string[];
    result?: (button) => void;
}

export class MessageBox extends Widget {    
    private textWidget: Widget = null;
    private titleWidget: Widget = null;
    private buttonWidgets: Widget[] = [];
    private msgOption: IMessageOption = null;
    private color = null;
    private btnColor = null;
    private focusBtnNum: number = 0;

    constructor( messageOption: IMessageOption, opts: Widgets.BoxOptions | any ) {
        super( { ...opts, top: "center", left: "center", width: "50%", height: "50%", border: "line", clickable: true });

        this.box.enableMouse();
        this.msgOption = messageOption;

        this.init();
    }

    resize() {
        const MIN_WIDTH = 50;
        const MAX_WIDTH = this.box.screen.width as number;
        
        let widthTitle = Math.min( strWidth(this.msgOption.title), MAX_WIDTH );
        let msgLines = this.msgOption.msg.split("\n");
        let widthMsg = msgLines.map( i => strWidth(i) ).reduce( (pre: number, cur: string ) => {
            return Math.min( Math.max(pre, strWidth(cur)), MAX_WIDTH );
        }, MIN_WIDTH );
        this.box.width = Math.max(widthTitle, widthMsg);
        this.box.height = Math.min(msgLines.length + 7, 14);

        log.debug( "%d %d, %d", msgLines.length, this.box.width, this.box.height );
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.btnColor = ColorConfig.instance().getBaseTwoColor("dialog", "func");

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

        this.resize();

        const buttonWidth = 12;
        let len = this.msgOption.button.length;
        this.msgOption.button.map( (item, i) => {
            let left = (Math.round((this.box.width as number) / (len+1)) * (i+1)) - Math.round(buttonWidth / 2);
            this.buttonWidgets.push( 
                new Widget( {
                    parent: this, 
                    tags: true, 
                    content: "{center}" + item + "{/center}", 
                    left, 
                    clickable: true,
                    bottom: 1, 
                    height: 1, 
                    width: buttonWidth,
                    style: i === 0 ? this.btnColor.blessedReverse : this.btnColor.blessed
                })
            );
        });

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
                    this.focusBtnNum = Math.abs(--this.focusBtnNum) % this.buttonWidgets.length;
            } else if ( [ "return", "space" ].indexOf(keyInfo.name) > -1 ) {
                this.destroy();
                this.msgOption.result && this.msgOption.result( this.msgOption.button[this.focusBtnNum] );
                return;
            }
            this.render();
            this.box.screen.render();
        });
        this.setFocus();
    }

    setMessageOption( msgOption ) {
        this.msgOption = msgOption;
    }

    viewBoxUpdate() {
        
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
        this.titleWidget.destroy();
        this.textWidget.destroy();
        this.buttonWidgets.map( i => i.destroy() );
        super.destroy();
    }
}
