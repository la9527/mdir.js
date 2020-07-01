import { Widget } from "./widget/Widget";
import { Widgets } from "neo-blessed";
import mainFrame from './MainFrame';
import { IHintInfo, keyHumanReadable, methodToKeyname, TerminalAllowKeys } from '../config/KeyMapConfig';
import { strWidth } from "neo-blessed/lib/unicode";
import { Logger } from '../common/Logger';
import { Color } from "../common/Color";
import { BlessedXterm } from "./BlessedXterm";
import { T } from "../common/Translation";

const log = Logger("HintBox");

export class HintBox extends Widget {
    constructor( opts: Widgets.BoxOptions | any ) {
        super( { left: 0, bottom: 1, width: "100%", height: 1, tags: true, ...opts } );
    }

    hintInfo() {
        let item: IHintInfo[] = [];
        let activePanel = mainFrame().activePanel();

        const addHintInfo = (view: any) => {
            if ( view.hintInfo && view.keyInfo ) {
                for ( let method of Object.keys(view.hintInfo) ) {
                    let { humanKeyName, key } = methodToKeyname(view, method) || {};
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
        let width = this.box.screen.width;
        let hintText = T("HINT") + ": ";
        let colorHintText = hintText;
        this.hintInfo().map( (item: IHintInfo) => {
            if ( item.key ) {
                let keyHint = `${item.key}-${item.hint}`;
                if ( strWidth(hintText + " " + keyHint) < width ) {
                    hintText += keyHint;
                    colorHintText += `{cyan-fg}${item.key}{/}-${item.hint} `;
                }
            }
        });
        this.setContent( colorHintText.trim() );
    }
}
