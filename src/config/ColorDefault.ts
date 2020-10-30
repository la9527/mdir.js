/*
 color number
 0:Black  1:Red    2:Green  3:Brown  4:Blue   5:Violet  6:Bluish green 7:White
 8:Gray   9:Orange 10:Yellowish green  11:Yellow 12:Sky Blue
 13:Pink 14:Light Blue  15:Bright White

 color setting: "font color, background color"
*/

export const ColorDefault = {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    version: require("../../package.json").version,
    base: {
        default: "7,-1",
        mcd: "15",
        mcd_line: "6",
        mcd_highlight: "2",
        dir: "9",
        drive: "3",
        line: "6",
        menuLine: "0,6",
        func: "15,6",
        funcA: "3,6", // 11
        funcSel: "7, 0",
        stat: "0,7",
        statA: "14,7",
        help: "15,4",
        quick: "15,4",
        quick_mcd: "15,4",
        dialog: "7,6",
        button: "4,7",
        buttonA: "4,11",
        buttonS: "3,12",
        buttonC: "7,5",
        button_disable: "0,8",
        radioA: "11,6",
        radio_disable: "7,8",
        input: "11,4",
        input_disable: "6,8",
        list: "7,4",
        listA: "11,4",
        edit: "7,-1",
        edit_info_a: "10,0",
        edit_info: "6,-1",
        property: "7,4",
        property_list: "7,-1",
        property_btn: "7,3"
    },
    file: {
        name: {
            14: "Makefile;makefile",
            12: "README;NEWS;COPYING;AUTHORS;INSTALL;TODO;ChangeLog;Doxyfile;",
            3: "package.json"
        },
        ext: {
            5: "a;so;la;so.1;so.0;exe;",
            6: [
                "txt;md;me;ini;cfg;log;am;in;conf;m4;po;spec;",
                "html;htm;xml;css;js;jsp;php;php3;asp;",
                "jsx;ts;tsx;",
                "c;cpp;cc;h;hh;pl;java;py;",
                "diff;diff3;"
            ],
            10: [
                "h;hh;",
                "json;sh;"
            ],
            12: [
                "xls;xlw;xlt;lwp;wps;ods;ots;sxc;stc;xls;csv;hwp;pdf;",
                "doc;dot;rtf;sdw;vor;pdb;odt;psw;sdw;pwd;jtd;jtt;",
                "wps;dif;dbf;odt;ott;sxw;odg;odp;ppt;",
                "pem;cer;p7b;der;",
                "xls;xlw;xlt;lwp;wps;ods;ots;sxc;stc;xls;csv;",
                "doc;dot;rtf;sdw;vor;pdb;odt;psw;sdw;pwd;jtd;jtt;",
                "wps;dif;dbf;odt;ott;sxw;odg;odp;ppt;"
            ],
            2: "bmp;tga;pcx;gif;jpg;jpeg;png;pbm;pgm;ppm;xbm;xpm;ico;svg;",
            13: [
                "tar;bz2;tbz;tgz;gz;zip;z;rpm;deb;alz;jar;iso;rar;lzh;cab;arj;xz;txz;",
                "develop"
            ],
            3: [
                "mp2;mp3;wav;aiff;voc;ogg;",
                "avi;mpg;mov;asf;mpeg;wmv;mp4;mkv;div;rm;amv;"
            ]
        }
    }
};
