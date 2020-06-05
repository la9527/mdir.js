import { BlessedProgram, Widgets, box, text, line, widget } from "neo-blessed";

import { Widget } from "./widget/Widget";
import { ColorConfig } from "../config/ColorConfig";
import { sprintf } from "sprintf-js";
import { Color } from "../common/Color";
import { Logger } from "../common/Logger";

const log = Logger("FuncKeyBox");

export class FuncKeyBox extends Widget {
    private textElement: Widget[] = [];
    private colorFunca: Color = null;
    private colorFunc: Color = null;
    private funcList = {};

    constructor( opt: Widgets.BoxOptions ) {
        super( { left: 0, top: 0, width: "100%", height: 1, ...opt } );
        this.colorFunca = ColorConfig.instance().getBaseColor("funcA");
        this.colorFunc = ColorConfig.instance().getBaseColor("func");

        this.funcList = {
            F1: "Help",
            F2: "Rename",
            F3: "Editor",
            F4: "Vim",
            F5: "Refresh",
            F6: "Remote",
            F7: "Mkdir",
            F8: "Remove",
            F9: "Size",
            F10: "MCD",
            F11: "QCD",
            F12: "Menu",
        };
    }

    setFuncList( funcList ) {
        this.funcList = funcList;
    }

    draw() {
        const width = Math.round( (this.box.width as number) / 12);
        
        this.box.style = this.colorFunc.blessed;
        this.textElement.forEach( i => i.destroy() );
        this.textElement = [];

        let pos = 0;
        Object.keys(this.funcList).map( (key, i) => {
            let content = sprintf( "{bold}%s%s%s{/bold}", this.colorFunca.hexBlessFormat( i === 0 ? "F" : ""), key.substr(1), this.funcList[key] );
            // '\u2502'; // '│'
            content = (i > 0 ? "{black-fg}\u2502{/black-fg}" : "") + content;
            // log.warn( content );
            let widget = new Widget({
                parent: this,
                left: pos,
                top: 0,
                height: 1,
                width,
                style: this.colorFunc.blessed
            });
            widget.setContent( content );
            this.textElement.push( widget );
            pos += width;
        });
    }
}
