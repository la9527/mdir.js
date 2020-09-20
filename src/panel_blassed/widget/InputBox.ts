import { Widget } from "./Widget";
import { widgetsEventListener } from "./WidgetsEventListener";
import { Widgets } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";
import { ColorConfig } from "../../config/ColorConfig";
import { Logger } from "../../common/Logger";
import mainFrame from "../MainFrame";
import { InputWidget } from "./InputWidget";
import { ButtonWidget } from "./ButtonWidget";

const log = Logger("InputBox");

interface InputBoxOption {
    parent: Widget | Widgets.Screen;
    title: string;
    defaultText?: string;
    button: string[];
    result?: (text, button) => void;
}

const MIN_WIDTH = 50;
const MIN_HEIGHT = 14;
const MIN_BUTTON_WIDTH = 12;

export class InputBox extends Widget {
    private inputWidget: InputWidget = null;
    private titleWidget: Widget = null;
    private buttonWidgets: ButtonWidget[] = [];
    private widgetElements: Widget[] = [];

    private value: string = "";
    private cursorPos = 0;
    private keylock = false;

    private color = null;
    private inputColor = null;
    private btnColor = null;
    private focusBtnNum: number = -1;
    private buttonWidth = 0;

    private inputBoxOption: InputBoxOption = null;

    constructor( inputBoxOpts: InputBoxOption, opts: Widgets.BoxOptions ) {
        super( { parent: inputBoxOpts.parent, ...(opts || {}), top: "center", left: "center", width: MIN_WIDTH, height: MIN_HEIGHT, border: "line", clickable: true });

        this.inputBoxOption = inputBoxOpts;
        
        const defaultColor = ColorConfig.instance().getBaseColor("mcd");
        this.box.style = defaultColor.blessed;

        mainFrame().lockKey("inputBox", this);
        this.on("detach", () => {
            mainFrame().lockKeyRelease("inputBox");
            log.debug( "detach !!!" );
            this.box.screen.program.hideCursor();
        });

        this.init();
    }

    setFocus() {
        super.setFocus();
    }

    resize() {
        const maxWidth = this.box.screen.width as number;
        this.buttonWidth = this.inputBoxOption.button.reduce( (pre, item) => pre < strWidth(item) + 2 ? strWidth(item) + 2 : pre, MIN_BUTTON_WIDTH);

        const buttonAllWidth = this.inputBoxOption.button.length * (this.buttonWidth + 2);
        
        const width = Math.min( Math.max(strWidth(this.inputBoxOption.title), buttonAllWidth), maxWidth );
        this.buttonWidth = Math.max(this.buttonWidth, MIN_BUTTON_WIDTH);

        this.box.width = Math.max( width, MIN_WIDTH);
        this.box.height = Math.min( 6 + this.inputBoxOption.button.length, MIN_HEIGHT);
        log.debug( "RESIZE - (%d, %d)", this.box.width, this.box.height );

        const len = this.inputBoxOption.button.length;
        this.buttonWidgets.map( (item, i) => {
            const left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
            item.bottom = 0;
            item.left = left;
            item.width = this.buttonWidth;
        });
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.inputColor = ColorConfig.instance().getBaseColor("input");
        this.btnColor = ColorConfig.instance().getBaseTwoColor("dialog", "func");

        this.box.style = { ...this.color.blessed, border: this.color.blessed };
        this.titleWidget = new Widget( { 
            parent: this, 
            top: 0, 
            width: "100%-2", 
            height: 1, 
            tags: true, 
            content: this.inputBoxOption.title, 
            style: this.color.blessedReverse, 
            align: "center" } );

        this.inputWidget = new InputWidget( { 
            parent: this, 
            top: 2, 
            left: "center",
            width: "100%-4",
            tags: false, 
            height: 1, 
            style: this.inputColor.blessed, 
            align: "left" 
        }, { defaultText: this.inputBoxOption.defaultText || "" });

        const len = this.inputBoxOption.button.length;
        this.inputBoxOption.button.map( (item, i) => {
            const left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
            this.buttonWidgets.push( 
                new ButtonWidget( {
                    parent: this, 
                    content: item, 
                    left, 
                    align: "center",
                    bottom: 0, 
                    height: 1, 
                    width: this.buttonWidth,
                    aliasName: item
                })
            );
        });

        this.resize();

        widgetsEventListener( [
            this.inputWidget,
            ...this.buttonWidgets
        ], ( widget, index, eventName ) => {
            if ( widget instanceof InputWidget && eventName === "widget.return") {
                this.inputBoxOption.result( this.inputWidget.getValue(), this.buttonWidgets[0].aliasName );
            } else if ( widget instanceof ButtonWidget && eventName === "widget.return") {
                this.inputBoxOption.result( this.inputWidget.getValue(), widget.aliasName );
            }
        });
        this.inputWidget.setFocus();
    }

    draw() {
        this.resize();
        this.titleWidget.setContent( this.inputBoxOption.title );
    }

    destroy() {
        super.destroy();
    }
}

export function inputBox( msgOpt: InputBoxOption, opts: Widgets.BoxOptions = {} ): Promise<string[]> {
    return new Promise(( resolve ) => {
        const screen = msgOpt.parent.screen || opts.parent.screen;
        const input = new InputBox({
            parent: msgOpt.parent,
            title: msgOpt.title, 
            defaultText: msgOpt.defaultText, 
            button: msgOpt.button,
            result: (text, button) => {
                process.nextTick( () => {
                    input.destroy();
                    resolve( [ text, button ] );
                    screen.render();
                });
            }
        }, opts);
        screen.render();
    });
}
