import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";

const log = Logger("main");

export class Widget {
    private _box: Widgets.BoxElement;

    constructor( opts: Widgets.BoxOptions | any ) {
        if ( opts.parent && (opts.parent as any).box ) {
            this._box = box( { ...opts, parent: (opts.parent as any).box, tags: true } );
        } else {
            this._box = box( { ...opts, tags: true } );
        }

        this._box.on("prerender", () => {
            this.draw();
        });
    }

    draw(): void {}

    on(event: string, listener: (...args: any[]) => void) {
        this._box.on( event, listener );
    }

    setFocus() {
        this._box.focus();
    }

    hasFocus(): boolean {
        log.info( "hasFocus: %d", (this._box as any).focused );
        return (this._box as any).focused;
    }

    destroy() {
        this._box.destroy();
    }

    render() {
        this._box.render();
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
    get box() {
        return this._box;
    }
}
