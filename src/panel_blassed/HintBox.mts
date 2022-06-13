/* eslint-disable @typescript-eslint/no-unused-vars */
import { Widget } from "./widget/Widget.mjs";
import { Widgets } from "neo-blessed";
import mainFrame from "./MainFrame.mjs";
import { IHintInfo, methodToKeyname, TerminalAllowKeys } from "../config/KeyMapConfig.mjs";
import { strWidth } from "neo-blessed/lib/unicode.js";
import { Logger } from "../common/Logger.mjs";
import { BlessedXterm } from "./BlessedXterm.mjs";
import { T } from "../common/Translation.mjs";

const log = Logger("HintBox");

export class HintBox extends Widget {
    constructor( opts: Widgets.BoxOptions | any ) {
        super( { left: 0, bottom: 1, width: "100%", height: 1, tags: true, ...opts } );
    }

    hintInfo() {
        const item: IHintInfo[] = [];
        const activePanel = mainFrame().activePanel();

        const addHintInfo = (view: any) => {
            if ( view.hintInfo && view.keyInfo ) {
                for ( const method of Object.keys(view.hintInfo) ) {
                    const { humanKeyName, key } = methodToKeyname(view, method) || {};
                    if ( activePanel instanceof BlessedXterm && TerminalAllowKeys.indexOf(key) === -1 ) {
                        continue;
                    }
                    if ( humanKeyName ) {
                        view.hintInfo[ method ].key = humanKeyName;
                    }
                    item.push( view.hintInfo[method] );
                }
            }
        };

        addHintInfo(mainFrame());
        addHintInfo(activePanel);

        item.sort( (a, b) => a.order - b.order );
        // log.debug( item );
        return item;
    }

    draw() {
        const width = this.box.screen.width;
        let hintText = T("HINT") + ": ";
        let colorHintText = hintText;
        this.hintInfo().map( (item: IHintInfo) => {
            if ( item.key ) {
                let hint = item.hint;
                if ( item.func ) {
                    hint = item.func();
                }
                const keyHint = `${item.key}-${hint}`;
                if ( strWidth(hintText + " " + keyHint) < width ) {
                    hintText += keyHint;
                    colorHintText += `{cyan-fg}${item.key}{/}-${hint} `;
                }
            }
        });
        this.setContent( colorHintText.trim() );
    }
}
