import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { Color } from "../common/Color";
import { sprintf } from "sprintf-js";

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

    setFront() {
        this._box.setFront();
    }

    setBack() {
        this._box.setBack();
    }

    draw(): void {}

    on(event: string, listener: (...args: any[]) => void) {
        this._box.on( event, listener );
    }

    setFocus() {
        this._box.focus();
    }

    hasFocus(): boolean {
        // log.info( "hasFocus: %d", (this._box as any).focused );
        return (this._box as any).focused;
    }

    destroy() {
        this._box.destroy();
    }

    render() {
        this._box.render();
    }

    setContentFormat( ...args ) {
        this.setContent( sprintf.apply( null, args ) );
    }

    setContent( text ) {
        // 맥에서 한글자모 분리 오류 수정(Unicode 정규화 방식)
        this.box.setContent( text.normalize() );
    }

    setColor( color: Color ) {
        this._box.style = { bg: color.back, fg: color.font };
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
