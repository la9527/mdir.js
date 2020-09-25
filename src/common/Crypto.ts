import * as os from "os";
import * as crypto from "crypto";
import { machineIdSync } from "node-machine-id";
import { Logger } from "./Logger";

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

const log = Logger("Crypto");

export class Crypto {
    private static getKey() {
        if ( !(global as any)._MACHINE_ID ) {
            (global as any)._MACHINE_ID = machineIdSync();
        }
        const keySha256 = crypto.createHash("sha512").update((global as any)._MACHINE_ID).digest("hex");
        if ( keySha256.length > ALGORITHM.KEY_BYTE_LEN ) {
            return keySha256.substr(0, ALGORITHM.KEY_BYTE_LEN);
        }
        return null;
    }

    public static encrypt(messagetext: string): string {
        try {
            const iv = crypto.randomBytes(ALGORITHM.IV_BYTE_LEN);
            const cipher = crypto.createCipheriv("aes-256-gcm", Crypto.getKey(), iv, { authTagLength: ALGORITHM.AUTH_TAG_BYTE_LEN });
            
            let encryptedMessage = cipher.update(messagetext);
            encryptedMessage = Buffer.concat([encryptedMessage, cipher.final()]);
            return Buffer.concat([iv, encryptedMessage, cipher.getAuthTag()]).toString("base64");
        } catch( e ) {
            log.error( e );
            return null;
        }
    }

    public static decrypt(cipherBase64: string): string {
        try {
            const ciphertext = Buffer.from(cipherBase64, "base64");
            const authTag = ciphertext.slice(-16);
            const iv = ciphertext.slice(0, 12);
            const encryptedMessage = ciphertext.slice(12, -16);
            const decipher = crypto.createDecipheriv("aes-256-gcm", Crypto.getKey(), iv, {
                authTagLength: ALGORITHM.AUTH_TAG_BYTE_LEN
            });
            decipher.setAuthTag(authTag);
            const messagetext = decipher.update(encryptedMessage);
            return Buffer.concat([messagetext, decipher.final()]).toString("utf8");
        } catch( e ) {
            log.error( e );
            return null;
        }
    }  
}
