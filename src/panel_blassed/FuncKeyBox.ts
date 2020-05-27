import { BlessedProgram, Widgets, box, text, line } from "neo-blessed";

import { Widget } from "./Widget";
import { ColorConfig } from "../config/ColorConfig";
import { sprintf } from "sprintf-js";
import { Color } from "../common/Color";
import { Logger } from "../common/Logger";

const log = Logger("FuncKeyBox");

export class FuncKeyBox {
    private textElement: Widgets.TextElement[] = [];
    private colorFunca: Color = null;
    private colorFunc: Color = null;

    constructor( parentElement: any, widgetOption: any = {} ) {

        this.colorFunca = ColorConfig.instance().getBaseColor("funca");
        this.colorFunc = ColorConfig.instance().getBaseColor("func");

        const width = Math.round((parentElement as Screen).width / 12);
        let pos = 0;

        const funcList = {
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

        const { fontHex: colorFuncaFontHex, backHex: colorFuncaBackHex } = this.colorFunca;
        const { fontHex, backHex } = this.colorFunc;

        line({
            parent: parentElement,
            orientation: "horizontal",
            tags: true,
            type: "bg",
            left: 0,
            top: 0,
            height: 1,
            width: "100%",
            bg: this.colorFunc.backHex
        });

        Object.keys(funcList).map( (key, i) => {
            let content = sprintf(`{bold}{%s-fg}{%s-bg}%s%d{/%s-fg}{%s-bg}%s{/bold}`, 
                            colorFuncaFontHex, colorFuncaBackHex, i === 0 ? "F" : "", i + 1, colorFuncaFontHex, colorFuncaBackHex, funcList[key] );
            // '\u2502'; // '│'
            content = (i > 0 ? "{black-fg}\u2502{/black-fg}" : "") + content;

            log.warn( content );
            this.textElement.push( text({
                parent: parentElement,
                tags: true,
                left: pos,
                top: 0,
                height: 1,
                width,
                fg: fontHex,
                bg: backHex,
                content
            }));
            pos += width;
        });

        this.textElement.map( (item, index) => {
            item.on( "prerender", () => {
                const width = (parentElement as Screen).width / 12;
                item.width = width;

                log.warn( "INDEX: %d - LEFT : %d, %d", index, item.left, item.width );
            });
        });
    }
}
