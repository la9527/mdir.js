import { Logger } from "../../common/Logger";
import { Widget } from "./Widget";
import { InputWidget } from "./InputWidget";

const log = Logger("Widget");

export const widgetsEventListener = ( widgets: Widget[], callback?: (widget: Widget, index: number, eventName, args?: any[] ) => void ) => {
    const updateCursor = (widget: Widget) => {
        const program = widget.box.screen.program;
        if ( widget instanceof InputWidget && program.cursorHidden ) {
            log.debug( "showCursor !!!");
            program.showCursor();
        } else if ( !(widget instanceof InputWidget) && !program.cursorHidden ) {
            log.debug( "hideCursor !!!");
            program.hideCursor();
        }
    };

    const getNextWidget = (idx) => {
        let num = idx;
        do {
            num++;
            if ( num >= widgets.length ) {
                num = 0;
            }
        } while( widgets[num].disable );
        return widgets[num];
    };

    const getPreviousWidget = (idx) => {
        let num = idx;
        do {
            num--;
            if ( num < 0 ) {
                num = widgets.length - 1;
            }
        } while( widgets[num].disable );
        return widgets[num];
    };

    const result = (eventName, idx, widget) => {
        return ( ...args: any[] ) => {
            if ( eventName === "widget.tab" ) {
                const nextWidget = getNextWidget( idx );
                nextWidget.setFocus();
                updateCursor( nextWidget );
            } else if ( eventName === "widget.shifttab" ) {
                const previousWidget = getPreviousWidget( idx );
                previousWidget.setFocus();
                updateCursor( previousWidget );
            }
            log.debug( `${widget.aliasName} - ${eventName}` );
            callback && callback( widget, idx, eventName, args );
        };
    };

    [ "widget.tab", "widget.shifttab", "widget.escape", "widget.return", "widget.changeradio" ].forEach( eventName => {
        widgets.forEach( (widget: Widget, idx: number) => {
            widget.on( eventName, result(eventName, idx, widget) );
        });
    });
};
