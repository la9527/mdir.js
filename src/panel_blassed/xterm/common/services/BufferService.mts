/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService } from "./Services.mjs";
import { BufferSet } from "../buffer/BufferSet.mjs";
import { IBufferSet, IBuffer } from "../buffer/Types.mjs";
import { EventEmitter, IEvent } from "../EventEmitter.mjs";
import { Disposable } from "../Lifecycle.mjs";

export const MINIMUM_COLS = 2; // Less than 2 can mess with wide chars
export const MINIMUM_ROWS = 1;

export class BufferService extends Disposable implements IBufferService {
    public serviceBrand: any;

    public cols: number;
    public rows: number;
    public buffers: IBufferSet;
    /** Whether the user is scrolling (locks the scroll position) */
    public isUserScrolling: boolean = false;

    private _onResize = new EventEmitter<{ cols: number; rows: number }>();
    public get onResize(): IEvent<{ cols: number; rows: number }> { return this._onResize.event; }

    public get buffer(): IBuffer { return this.buffers.active; }

    constructor(
        @IOptionsService private _optionsService: IOptionsService
    ) {
        super();
        this.cols = Math.max(_optionsService.options.cols, MINIMUM_COLS);
        this.rows = Math.max(_optionsService.options.rows, MINIMUM_ROWS);
        this.buffers = new BufferSet(_optionsService, this);
    }

    public dispose(): void {
        super.dispose();
        this.buffers.dispose();
    }

    public resize(cols: number, rows: number): void {
        this.cols = cols;
        this.rows = rows;
        this.buffers.resize(cols, rows);
        this.buffers.setupTabStops(this.cols);
        this._onResize.fire({ cols, rows });
    }

    public reset(): void {
        this.buffers.dispose();
        this.buffers = new BufferSet(this._optionsService, this);
        this.isUserScrolling = false;
    }
}
