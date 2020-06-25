import { BlessedProgram, Widgets, box, text, line, widget } from "neo-blessed";

import { Widget } from "./widget/Widget";
import { ColorConfig } from "../config/ColorConfig";
import { sprintf } from "sprintf-js";
import { Color } from "../common/Color";
import { Logger } from "../common/Logger";
import mainFrame from "./MainFrame";
import { functionKeyInfo } from "../config/KeyMapConfig";

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
    }

    draw() {
        const width = Math.round( (this.box.width as number) / 12);
        
        this.box.style = this.colorFunc.blessed;
        this.textElement.forEach( i => i.destroy() );
        this.textElement = [];

        this.funcList = { ...functionKeyInfo(mainFrame()), ...functionKeyInfo( mainFrame().activePanel() ) };

        let pos = 0;
        for ( let i = 1; i <= 12; i++ ) {
            let content = sprintf( "{bold}%s%s{/bold}", this.colorFunca.hexBlessFormat( (i === 1 ? "F" : "") + i), (this.funcList['F' + i] || "") );
            // '\u2502'; // '│'
            content = (i > 1 ? "{black-fg}\u2502{/black-fg}" : "") + content;
            log.warn( content );
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
        }
    }
}
