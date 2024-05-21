process.env.NODE_ENV = "test";

/* eslint-disable @typescript-eslint/no-unused-vars */
import blessed from "neo-blessed";
import { Widgets } from "neo-blessed";
import { Widget } from "../panel_blassed/widget/Widget.mjs";
import { widgetsEventListener } from "../panel_blassed/widget/WidgetsEventListener.mjs";
import { Logger } from "../common/Logger.mjs";
import { Color } from "../common/Color.mjs";
import { ColorConfig } from "../config/ColorConfig.mjs";
import { InputWidget } from "../panel_blassed/widget/InputWidget.mjs";
import { ButtonWidget } from "../panel_blassed/widget/ButtonWidget.mjs";
import { RadioWidget } from "../panel_blassed/widget/RadioWidget.mjs";
import { TabWidget } from "../panel_blassed/widget/TabWidget.mjs";
import { sprintf } from "sprintf-js";

const { text, line } = blessed;

const log = Logger("ConnectionManager");

export class ColorDemo extends Widget {
    private titleWidget: Widget = null;
    private elementsInfo: any[] = [];
    private eventElements: Widget[] = [];
    private color: Color = null;
    
    constructor( opts: Widgets.BoxOptions | any ) {
        super({
            ...(opts || {}),
            width: 100,
            height: 40,
            top: "center",
            left: "center",
            border: "line",
            clickable: true
        });
        this.init();
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        
        this.titleWidget = new Widget( { 
            parent: this, 
            top: 0, 
            width: "100%-2", 
            height: 1, 
            tags: true, 
            content: "COLOR DEMO", 
            style: this.color.blessedReverse, 
            align: "center" } );

        const commonOption = {
            parent: this.box,
            tags: true,
            style: this.color.blessed
        };

        const labelTextOption = {
            ...commonOption,
            left: 3,
            width: 20,
            height: 1
        };

        const inputOption = {
            ...commonOption,
            top: 2, 
            left: 25,
            width: 40,
            tags: false, 
            height: 1
        };

        const buttonOption = {
            ...commonOption,
            width: 20,
            height: 1
        };


        this.elementsInfo = [];
        this.elementsInfo.push( { top: 1, left: 6, width: 30, type: "label", align: "center", content: "[ DEFAULT COLOR ]", style: { fg: 15, bg: 0, bold: true } } );

        for ( let f = 0; f < 16; f++ ) {
            for ( let b = 0; b < 16; b++ ) {
                this.elementsInfo.push( { top: f + 2, left: 1 + (b * 6), width: 5, type: "label", align: "center", content: sprintf("%02d.%02d", f, b), style: { fg: f, bg: b } } );
            }
        }

        this.elementsInfo.push( { top: 18, left: 6, width: 30, type: "label", align: "center", content: "[ BOLD COLOR ]", style: { fg: 15, bg: 0, bold: true } } );

        for ( let f = 0; f < 16; f++ ) {
            for ( let b = 0; b < 16; b++ ) {
                this.elementsInfo.push( { top: f + 19, left: 1 + (b * 6), width: 5, type: "label", align: "center", content: sprintf("%02d.%02d", f, b), style: { fg: f, bg: b, bold: true } } );
            }
        }

        this.eventElements = [];
        this.elementsInfo.map( item => {
            if ( item.type === "input" ) {
                text({
                    ...labelTextOption,
                    top: item.top,
                    content: item.label
                });
                this.eventElements.push(new InputWidget({ ...inputOption, top: item.top, aliasName: item.name }, { defaultText: "" + (item.default || ""), passwordType: item.passwordType } ));
            } else if ( item.type === "button" ) {
                this.eventElements.push(new ButtonWidget({ ...buttonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name, content: item.label }));
            } else if ( item.type === "tab" ) {
                this.eventElements.push(new TabWidget({ ...buttonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name }, { text: item.label, defaultSelect: item.default } ));
            } else if ( item.type === "line" ) {
                line({ ...commonOption, ...item });
            } else if ( item.type === "label" ) {
                text({ ...labelTextOption, ...item });
            } else if ( [ "checkbox", "radiobox" ].indexOf(item.type) > -1 ) {
                this.eventElements.push(new RadioWidget(
                    { ...commonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name }, 
                    { text: item.label, isCheck: item.type === "checkbox", defaultCheck: item.default || false }));
            }
        });

        widgetsEventListener( this.eventElements, (widget: Widget, index: number, eventName: string, args: any[] ) => {
            this.onEventListener( widget, index, eventName, args );
        });

        this.initWidget();
    }

    destroy() {
        this.eventElements.map( item => {
            item.destroy();
        });
        super.destroy();
    }

    getAliasWidget( name: string ) {
        return this.eventElements.find( (item: Widget) => item.aliasName === name );
    }

    initWidget() {
        // initWidget
    }

    onEventListener( widget: Widget, index, eventName, args: any[] ) {
        log.debug( "aliasName: %s, eventName: %s, args: %j", widget.aliasName, eventName, args );
    }
}


const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    useBCE: true,
    ignoreDockContrast: true,
    // debug: true,
    //dump: true,
    //log: process.env.HOME + "/.m/m2.log"
});

const colorDemo = new ColorDemo({ parent: screen });

screen.key("q", () => {
    process.exit(0);
});

screen.render();
