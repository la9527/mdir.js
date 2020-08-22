import { IConfigure } from "./Configure";

export const ConfigureDefault: IConfigure = {
    Version: require("../../package.json").version,
    Option: {
        
    },
    MimeTypeAlias: {
        name: {
            makefile: "makefile"
        },
        ext: {
            office: [ 
                "xls;xlw;xlt;lwp;wps;ods;ots;sxc;stc;xls;csv;",
                "doc;dot;rtf;sdw;vor;pdb;odt;psw;sdw;pwd;jtd;jtt;",
                "wps;dif;dbf;odt;ott;sxw;odg;odp;ppt;"
            ],
            hwp: "hwp",
            pdf: "pdf",
            supportImage: "gif;jpg;jpeg;png;",
            image: [ "bmp;tga;pcx;pbm;pgm;ppm;xbm;xpm;ico;" ],
            editor: [ 
                "txt;me;ini;cfg;log;am;in;conf;m4;po;spec;",
                "html;htm;xml;",
                "css;jsp;php;php3;asp;sh;",
                "js;ts;tsx;jsx;json;",
                "c;cpp;cc;h;hh;pl;java;py;mm;"
            ],
            movie: [ "avi;mpg;mov;asf;mpeg;wmv;mp4;mkv;div;rm;amv;" ],
            audio: [ "mp2;mp3;wav;ogg;wma;flac;" ],
            internalArchive: "tar;bz2;tbz;tgz;gz;zip;jar;",
            archive: "z;rpm;deb;alz;iso;rar;lzh;cab;",
            certification: "der;pem;",
            package: "apk"
        }
    },
    ProgramService: {
        Open: { // execution a program registered on system mime type.
            name: "Configure.Open",
            command: {
                win32: "@chcp 65001 >nul & cmd /s/c",
                darwin: "open",
                linux: "xdg-open"
            }
        },
        TerminalImageViewer: { // internal simple terminal image viewer
            name: "Configure.TerminalImageViewer",
            method: "Common.imageViewPromise"
        },
        Archive: {
            name: "Configure.Archive",
            method: "Common.archivePromise"
        },
        Editor: {
            name: "Configure.Editor",
            method: "Common.editorPromise"
        },
        VIM: {
            name: "Configure.VIM",
            command: "vim",
            mterm: true
        }
    },
    ProgramMatching: {
        /**
            %1,%F	filename.ext (ex. test.txt)
            %N 	    filename (ex. test)
            %E	    file extension name (ex. .ext)
            %S	    selected files (a.ext b.ext)
            %A	    current directory name(bin)
            %D	    execute MCD
            %Q	    ask before running
            %P      command text string edit before a script execution.
            %W	    Waiting after script execution.
            %B	    background execution
            %T      execution over inside terminal
            %R      root execution - linux, mac osx only (su - --command= )
            %%	    %
            <{ProgramServiceName}> : 
         */
        office: [ "<Open> %1 %B" ],
        hwp: [ "<Open> %1 %B" ],
        pdf: [ "<Open> %1 %B" ],
        supportImage: [ "<TerminalImageViewer>", "<Open> %1 %B" ],
        image: "<Open> %1 %B",
        movie: "<Open> %1 %B",
        audio: "<Open> %1 %B",
        internalArchive: [ "<Archive>", "<Open> %1 %B" ],
        archive: "<Open> %1 %B",
        certification: "<Open> %1 %B",
        package: [ "<Open> %1 %B", "adb install %1" ],
        editor: [ "<Editor>", "<VIM>", "<Open> %1 %B" ],
        makefile: [ "<Editor>", "<VIM>", "make", "<Open> %1" ],
        etc: [ "<Open> %1 %W", "<Editor>", "<VIM>" ]
    }
};