/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/member-ordering */
import { Widgets, box } from "neo-blessed";
import { Logger } from "../../common/Logger";
import { Color } from "../../common/Color";
import { sprintf } from "sprintf-js";

const log = Logger("Widget");

export class Widget {
    private _box: Widgets.BoxElement;
    protected destroyed = false;
    _viewCount: number = -1;
    protected _aliasName: string = null;
    protected _disable: boolean = false;
    public tmpDirRemoveFunc = null;
    private _befClickData = { x: 0, y: 0, now: 0 };

    constructor( opts: Widgets.BoxOptions | any ) {
        if ( opts.parent && opts.parent instanceof Widget ) {
            this._box = box( { ...opts, parent: (opts.parent as any).box, tags: true } );
        } else {
            this._box = box( { ...opts, tags: true } );
        }
        this._viewCount = opts && opts.viewCount;
        this._aliasName = opts && opts.aliasName;
        (this._box as any)._widget = this;

        this.on("focus", () => {
            log.debug( "onFocus : [%s]", this );
        });

        this.on( "click", async (e) => {
            if ( this.checkDoubleClick(e) ) {
                this.emit( "widget.doubleclick", e);
            } else {
                this.emit( "widget.click", e);
            }
        });
        this.on( "prerender", () => {
            this.draw();
        });
        this.on("detach", () => {
            try {
                (this._box as any)._widget = null;
            // eslint-disable-next-line no-empty
            } catch( e ) {}
        });
    }

    checkDoubleClick(e) {
        let isDoubleClick = false;
        const clickTime = Date.now() - this._befClickData.now;
        if ( e.x === this._befClickData.x && e.y === this._befClickData.y && clickTime < 600 ) {
            isDoubleClick = true;
        }
        this._befClickData = { x: e.x, y: e.y, now: Date.now() };
        return isDoubleClick;
    }

    get aliasName() {
        return this._aliasName;
    }

    get screen() {
        return this.box && this.box.screen;
    }

    set disable( disable: boolean ) {
        this._disable = disable;
    }
    get disable() {
        return this._disable;
    }

    setBorderLine( isBorder: boolean ) {
        (this._box.border as any) = isBorder ? {
            type: "line",
            ch: " ",
            left: true,
            top: true,
            right: true,
            bottom: true
        } : null;
    }

    hasBorderLine(): boolean {
        return !!this._box.border;
    }

    setFront() {
        this._box.setFront();
    }

    setBack() {
        this._box.setBack();
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    draw(): void {}

    off() {
        this._box.removeAllListeners();
    }

    on(event: string | string[], listener: (...args: any[]) => void) {
        if ( Array.isArray( event ) ) {
            event.forEach( item => {
                this._box.on( item, listener );
            });
        } else {
            this._box.on( event, listener );
        }
    }

    emit( event: string, opt?: any ) {
        this._box.emit( event, opt || "" );
    }

    setFocus() {
        this._box.focus();
    }

    hasFocus(): boolean {
        // log.info( "hasFocus: %d", (this._box as any).focused );
        return (this._box as any).focused;
    }

    destroy() {
        if ( this.tmpDirRemoveFunc ) {
            this.tmpDirRemoveFunc();
            this.tmpDirRemoveFunc = null;
        }
        this._box.off();
        (this._box as any)._widget = null;
        this._box.destroy();
        this.destroyed = true;
    }

    render() {
        const startTime = Date.now();
        // log.debug( "WIDGET RENDER START [%s]", this.constructor.name );
        const result = this._box.render();
        if ( result ) {
            const item: any = (this._box.screen as Widgets.Screen);
            const start = Math.max( 0, Math.min(result.yi, result.yl) );
            const end = Math.min( Math.max(result.yi, result.yl), item.lines.length - 1 );

            this._box.screen.draw( start, end );
            log.debug( "WIDGET RENDER [%s] [%d,%d] - [%sms]", this.constructor.name, start, end, Date.now() - startTime );
        }
    }

    show() {
        this._box.show();
    }

    hide() {
        this._box.hide();
    }

    setContentFormat( ...args ) {
        // eslint-disable-next-line prefer-spread
        this.setContent( sprintf.apply( null, args ) );
    }

    setContent( text ) {
        // convert to NFC normalize from UTF8
        // UTF8 separation
        //log.debug( "%s - setContent - %s %s", this.aliasName, text, typeof(text) );
        this.box.setContent( text.normalize() );
    }

    setColor( color: Color ) {
        this._box.style = { bg: color.back, fg: color.font };
    }

    getCursor() {
        const screen: Widgets.Screen = this.box.screen;
        const box: any = this.box;
        const program = screen.program;
        const lpos = box.lpos;
        if (!lpos) return null;

        const y = program.y - (lpos.yi + box.itop);
        const x = program.x - (lpos.xi + box.ileft);

        return { x, y };
    }

    moveCursor( x, y ) {
        const screen: Widgets.Screen = this.box.screen;
        const box: any = this.box;
        const lpos = box.lpos;
        if (!lpos) {
            log.debug( "moveCursor : !lpo" );
            return;
        }
      
        let program = screen.program, line, cx, cy;
      
        line = Math.min(y, (lpos.yl - lpos.yi) - box.iheight - 1);      
        line = Math.max(0, line);
      
        cy = lpos.yi + box.itop + line;
        cx = lpos.xi + box.ileft + x;
      
        log.debug( "moveCursor: cx, cy (%d, %d)", cx, cy );
        program.cup(cy, cx);

        /*
        if (cy === program.y && cx === program.x) {
            log.debug( "moveCursor : cy === program.y && cx === program.x - (%d, %d)", cx, cy );
            return;
        }
      
        if (cy === program.y) {
            if (cx > program.x) {
                program.cuf(cx - program.x);
            } else if (cx < program.x) {
                program.cub(program.x - cx);
            }
        } else if (cx === program.x) {
            if (cy > program.y) {
                program.cud(cy - program.y);
            } else if (cy < program.y) {
                program.cuu(program.y - cy);
            }
        } else {
            program.cup(cy, cx);
        }
        */
    }

    get top() {
        return this._box.top;
    }
    set top( num ) {
        this._box.top = num;
    }
    get left() {
        return this._box.left;
    }
    set left( num ) {
        this._box.left = num;
    }
    get width() {
        return this._box.width;
    }
    set width(num) {
        this._box.width = num;
    }
    get height() {
        return this._box.height;
    }
    set height(num) {
        this._box.height = num;
    }
    set bottom(bottom) {
        this._box.bottom = bottom;
    }
    get bottom() {
        return this._box.bottom;
    }

    set parent( parent ) {
        this._box.parent = parent;
    }
    get parent() {
        return this._box.parent;
    }
    get box(): Widgets.BoxElement {
        return this._box;
    }
}
