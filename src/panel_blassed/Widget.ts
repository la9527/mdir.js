import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { Color } from "../common/Color";
import { sprintf } from "sprintf-js";

const log = Logger("main");

export class Widget {
    private _box: Widgets.BoxElement;
    _viewCount: number = -1;

    constructor( opts: Widgets.BoxOptions | any ) {
        if ( opts.parent && (opts.parent as any).box ) {
            this._box = box( { ...opts, parent: (opts.parent as any).box, tags: true } );
        } else {
            this._box = box( { ...opts, tags: true } );
        }
        this._viewCount = opts?.viewCount;
        this._box.on( "prerender", () => {
            this.draw();
        });
    }

    setFront() {
        this._box.setFront();
    }

    setBack() {
        this._box.setBack();
    }

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

    setFocus() {
        this._box.focus();
    }

    hasFocus(): boolean {
        log.info( "hasFocus: %d", (this._box as any).focused );
        return (this._box as any).focused;
    }

    destroy() {
        this._box.off();
        this._box.destroy();
    }

    render() {
        this._box.render();
    }

    show() {
        this._box.show();
    }

    hide() {
        this._box.hide();
    }

    setContentFormat( ...args ) {
        this.setContent( sprintf.apply( null, args ) );
    }

    setContent( text ) {
        // fixed korean(Hangle) alphabet separation (Unicode normalize)
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

        let y = program.y - (lpos.yi + box.itop);
        let x = program.x - (lpos.xi + box.ileft);

        return { x, y };
    }

    moveCursor( x, y ) {
        const screen: Widgets.Screen = this.box.screen;
        if (screen.focused !== this.box) {
            log.debug( "moveCursor : screen.focused !== this.box" );
            return;
        }
        const box: any = this.box;
        const lpos = box.lpos;
        if (!lpos) {
            log.debug( "moveCursor : !lpo" );
            return;
        }
      
        let program = screen.program
          , line
          , cx
          , cy;
      
        line = Math.min(y, (lpos.yl - lpos.yi) - box.iheight - 1);      
        line = Math.max(0, line);
      
        cy = lpos.yi + box.itop + line;
        cx = lpos.xi + box.ileft + x;
      
        log.debug( "moveCursor: (%d, %d)", cx, cy );
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
    get width(): string | number {
        return this._box.width;
    }
    set width(num: string | number) {
        this._box.width = num;
    }
    get height() {
        return this._box.height;
    }
    set height(num: string | number) {
        this._box.height = num;
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
