import { IConfigure } from "./Configure";

export const ConfigureDefault: IConfigure = {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Version: require("../../package.json").version,
    Option: {
        supportBgColorTransparent: false
    },
    OpensshOption: {
        // https://github.com/mscdex/ssh2
        readyTimeout: 10000,
        keepaliveInterval: 0,
        keepaliveCountMax: 3,
        proxyDefaultTimeout: 10000,
        // https://github.com/mscdex/ssh2-streams
        algorithms: { 
            kex: [ 
                "diffie-hellman-group1-sha1",
                "diffie-hellman-group14-sha1", 
                "ecdh-sha2-nistp256",
                "ecdh-sha2-nistp384",
                "ecdh-sha2-nistp521",
                "diffie-hellman-group-exchange-sha256",
                "diffie-hellman-group14-sha256",
                "diffie-hellman-group16-sha512",
                "diffie-hellman-group18-sha512",
                "diffie-hellman-group14-sha1" 
            ],
            serverHostKey: [ 
                "ssh-ed25519",
                "ecdsa-sha2-nistp256",
                "ecdsa-sha2-nistp384",
                "ecdsa-sha2-nistp521",
                "ssh-rsa",
                "ssh-dss" 
            ],
            cipher: [ 
                "aes128-ctr",
                "aes192-ctr",
                "aes256-ctr",
                "aes128-gcm",
                "aes128-gcm@openssh.com",
                "aes256-gcm",
                "aes256-gcm@openssh.com", 
                "3des-cbc", 
                "blowfish-cbc",
                /*
                "aes256-cbc",
                "aes192-cbc",
                "aes128-cbc",
                "arcfour256",
                "arcfour128",
                "cast128-cbc",
                "arcfour"
                */
            ],
            hmac: [ 
                "hmac-sha2-256", 
                "hmac-sha2-512", 
                "hmac-sha1", 
                "hmac-md5",
            ],
            compress: [ 
                "none", 
                "zlib@openssh.com", 
                "zlib" 
            ]
        }
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
            image: [ "bmp;tga;pcx;pbm;pgm;ppm;xbm;xpm;ico;svg;" ],
            editor: [ 
                "txt;me;ini;cfg;log;am;in;conf;m4;po;spec;",
                "html;htm;xml;",
                "css;jsp;php;php3;asp;sh;",
                "js;ts;tsx;jsx;json;",
                "c;cpp;cc;h;hh;pl;java;py;mm;"
            ],
            movie: [ "avi;mpg;mov;asf;mpeg;wmv;mp4;mkv;div;rm;amv;" ],
            audio: [ "mp2;mp3;wav;ogg;wma;flac;" ],
            internalArchive: "tar;bz2;tbz;tgz;gz;zip;jar;txz;xz;",
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
        editor: [ "<Editor>", "<VIM> %1", "<Open> %1 %B" ],
        makefile: [ "<Editor>", "<VIM> %1", "make", "<Open> %1" ],
        etc: [ "<Open> %1 %W", "<Editor>", "<VIM> %1" ]
    }
};
