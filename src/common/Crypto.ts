import * as os from "os";
import * as crypto from "crypto";

const ALGORITHM = {
    // 128 bit auth tag is recommended for GCM
    AUTH_TAG_BYTE_LEN: 16,
    // NIST recommends 96 bits or 12 bytes IV for GCM to promote interoperability, efficiency, and simplicity of design
    IV_BYTE_LEN: 12,
    // NOTE: 256 (in algorithm name) is key size (block size for AES is always 128)
    KEY_BYTE_LEN: 32,
    // to prevent rainbow table attacks
    SALT_BYTE_LEN: 16
};

export class Crypto {
    private static getKey() {
        const keyInfo = Object.values(os.networkInterfaces()).map( item => item[0].mac.replace(/:/g,"") ).filter( item => item !== "000000000000" ).join("");
        if ( keyInfo.length > ALGORITHM.KEY_BYTE_LEN ) {
            return keyInfo.substr(0, ALGORITHM.KEY_BYTE_LEN);
        }
        let result = "";
        do {
            result += keyInfo;
        } while( result.length < ALGORITHM.KEY_BYTE_LEN );
        return keyInfo.substr(0, ALGORITHM.KEY_BYTE_LEN);
    }

    public static encrypt(messagetext: string): Buffer {
        const iv = crypto.randomBytes(ALGORITHM.IV_BYTE_LEN);
        const cipher = crypto.createCipheriv("aes-256-gcm", Crypto.getKey(), iv, { authTagLength: ALGORITHM.AUTH_TAG_BYTE_LEN });
        
        let encryptedMessage = cipher.update(messagetext);
        encryptedMessage = Buffer.concat([encryptedMessage, cipher.final()]);
        return Buffer.concat([iv, encryptedMessage, cipher.getAuthTag()]);
    }

    public static decrypt(ciphertext: Buffer): string {
        const authTag = ciphertext.slice(-16);
        const iv = ciphertext.slice(0, 12);
        const encryptedMessage = ciphertext.slice(12, -16);
        const decipher = crypto.createDecipheriv("aes-256-gcm", Crypto.getKey(), iv, {
            authTagLength: ALGORITHM.AUTH_TAG_BYTE_LEN
        });
        decipher.setAuthTag(authTag);
        const messagetext = decipher.update(encryptedMessage);
        return Buffer.concat([messagetext, decipher.final()]).toString("utf8");
    }  
}
