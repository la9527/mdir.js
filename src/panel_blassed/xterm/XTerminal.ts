import { CoreTerminal } from "./common/CoreTerminal";
import { ICoreTerminal, CharData, ITerminalOptions } from "./common/Types";
import { EventEmitter, IEvent, forwardEvent } from "./common/EventEmitter";
import { IBuffer } from "./common/buffer/Types";
import { DEFAULT_ATTR_DATA } from "./common/buffer/BufferLine";
import { C0 } from "./common/data/EscapeSequences";

export class XTerminal extends CoreTerminal {
    private _onTitleChange = new EventEmitter<string>();
    public get onTitleChange(): IEvent<string> { return this._onTitleChange.event; }

    private _onRefreshRows = new EventEmitter<number, number>();
    public get onRefreshRows(): IEvent<number, number> { return this._onRefreshRows.event; }

    private _onCursorMove = new EventEmitter<void>();
    public get onCursorMove(): IEvent<void> { return this._onCursorMove.event; }

    constructor( options: ITerminalOptions ) {
        super( options );

        this._setup();

        this.register(forwardEvent(this._inputHandler.onTitleChange, this._onTitleChange));
        // (this as any).register(this._inputHandler.onRequestBell(() => this.bell()));
        this.register(this._inputHandler.onRequestRefreshRows((num1, num2) => this._onRefreshRows.fire(num1, num2)));
        this.register(this._inputHandler.onRequestReset(() => this.reset()));
        this.register(this._inputHandler.onRequestScroll((eraseAttr, isWrapped) => this.scroll(eraseAttr, isWrapped || undefined)));
        // (this as any).register(this._inputHandler.onRequestWindowsOptionsReport(type => this._reportWindowsOptions(type)));
        this.register(forwardEvent(this._inputHandler.onCursorMove, this._onCursorMove));
    }

    public dispose(): void {
        super.dispose();
        this.write = () => { };
    }

    public get buffer(): IBuffer {
        return this.buffers.active;
    }

    write( data ) {
        super.write( data );
    }

    focus() {
        if (this._coreService.decPrivateModes.sendFocus) {
            this._coreService.triggerDataEvent(C0.ESC + '[I');
        }
        this._showCursor();
    }

    blur() {
        if (this._coreService.decPrivateModes.sendFocus) {
            this._coreService.triggerDataEvent(C0.ESC + '[O');
            this._onRefreshRows.fire(this.buffer.y, this.buffer.y);
        }
    }

    clear() {
        this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y)!);
        this.buffer.lines.length = 1;
        this.buffer.ydisp = 0;
        this.buffer.ybase = 0;
        this.buffer.y = 0;
        for (let i = 1; i < this.rows; i++) {
          this.buffer.lines.push(this.buffer.getBlankLine(DEFAULT_ATTR_DATA));
        }
    }

    private _showCursor(): void {
        if (!this._coreService.isCursorInitialized) {
            this._coreService.isCursorInitialized = true;
            this._onRefreshRows.fire(this.buffer.y, this.buffer.y);
        }
    }
}
