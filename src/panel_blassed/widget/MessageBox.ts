import { Widget } from './Widget';
import { Widgets, text, button } from 'neo-blessed';
import { ColorConfig } from '../../config/ColorConfig';

interface IMessageOption {
    title: string;
    msg: string;
    button: string[];
}

export class MessageBox extends Widget {    
    private textWidget = null;
    private titleWidget = null;
    private buttonWidgets = [];
    private msgOption: IMessageOption = null;

    constructor( messageOption: IMessageOption, opts: Widgets.BoxOptions | any ) {
        super( { ...opts, top: "center", left: "center", width: "50%", height: "50%", border: "line", style: { bg: "blue" } } );
        this.msgOption = messageOption;
    }

    setMessageOption( msgOption ) {
        this.msgOption = msgOption;
    }

    draw() {
        const color = ColorConfig.instance().getBaseColor("SelectBox");
        const btnFontcolor = ColorConfig.instance().getBaseColor("Dialog").blessed.fg;
	    const btnBackcolor = ColorConfig.instance().getBaseColor("Func").blessed.bg;

        this.titleWidget = text( { parent: this.box, top: 1, width: "100%", height: 1, tags: true, content: "{center}" + this.msgOption.title + "{/center}", style: color.blessed } );
        this.textWidget = text( { parent: this.box, top: 2, width: "100%", height: 5, tags: true, content: "{center}" + this.msgOption.msg + "{/center}", style: color.blessed } );

        let len = this.msgOption.button.length;
        this.msgOption.button.map( (item, i) => {
            let left = Math.round(((i+1)/(len+1)) * 100) + "%";
            this.buttonWidgets.push( button( { parent: this.box, content: "{center}" + item + "{/center}", left, bottom: 2, width: 12, style: { fg: btnFontcolor, bg: btnBackcolor } } ) );
        });
    }

    destroy() {
        
    }
}
